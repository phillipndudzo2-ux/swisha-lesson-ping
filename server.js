const express = require('express');
const webpush = require('web-push');
const cors = require('cors');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// Load .env if it exists
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, 'utf8');
  env.split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
  });
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ========== DATA STORAGE (simple JSON files) ==========
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const SUBS_FILE = path.join(DATA_DIR, 'subscriptions.json');
const LESSONS_FILE = path.join(DATA_DIR, 'lessons.json');

function loadJSON(file, fallback = []) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {}
  return fallback;
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

let subscriptions = loadJSON(SUBS_FILE, []);
let lessons = loadJSON(LESSONS_FILE, []);

// Seed with demo lesson only if empty
if (lessons.length === 0) {
  const now = new Date();
  const demoStart = new Date(now.getTime() + 10 * 60 * 1000);
  lessons.push({
    id: uuidv4(),
    title: 'Demo Lesson (Google Meet)',
    startTime: demoStart.toISOString(),
    joinUrl: 'https://meet.google.com/gmc-ekpq-cqc?hs=224',
    availableForMinutes: 60,   // link stays 60 minutes after start
    notified: false
  });
  saveJSON(LESSONS_FILE, lessons);
  console.log('📌 Demo lesson created (starts in ~10 minutes, link stays 60 min)');
}

// ========== VAPID SETUP ==========
const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT || 'mailto:you@school.edu';

if (publicKey && privateKey) {
  webpush.setVapidDetails(subject, publicKey, privateKey);
  console.log('✅ VAPID keys loaded');
} else {
  console.warn('⚠️  No VAPID keys found. Run: npm run generate-vapid');
}

// ========== API ROUTES ==========

app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: publicKey || null });
});

// Subscribe – any student who enables notifications joins the shared list
app.post('/api/subscribe', (req, res) => {
  const sub = req.body;
  if (!sub || !sub.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription' });
  }

  const exists = subscriptions.find(s => s.endpoint === sub.endpoint);
  if (!exists) {
    subscriptions.push(sub);
    saveJSON(SUBS_FILE, subscriptions);
    console.log('🔔 New subscriber. Total:', subscriptions.length);
  }
  res.json({ success: true, totalSubscribers: subscriptions.length });
});

app.post('/api/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  subscriptions = subscriptions.filter(s => s.endpoint !== endpoint);
  saveJSON(SUBS_FILE, subscriptions);
  res.json({ success: true });
});

// Get lessons that are still relevant (upcoming OR still within the "available" window)
app.get('/api/lessons', (req, res) => {
  const now = new Date();

  const visible = lessons.filter(lesson => {
    const start = new Date(lesson.startTime);
    const availableMinutes = lesson.availableForMinutes || 60;
    const expiresAt = new Date(start.getTime() + availableMinutes * 60 * 1000);
    return expiresAt > now;   // still show if within the join window
  });

  // Sort: currently joinable first, then upcoming
  visible.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  res.json(visible);
});

// Add a new lesson – this will notify EVERYONE who has subscribed
app.post('/api/lessons', (req, res) => {
  const { title, startTime, joinUrl, availableForMinutes } = req.body;
  if (!title || !startTime || !joinUrl) {
    return res.status(400).json({ error: 'title, startTime and joinUrl are required' });
  }

  const mins = parseInt(availableForMinutes, 10);
  const lesson = {
    id: uuidv4(),
    title,
    startTime: new Date(startTime).toISOString(),
    joinUrl,
    availableForMinutes: isNaN(mins) || mins < 5 ? 60 : mins,  // default 60 min
    notified: false
  };
  lessons.push(lesson);
  saveJSON(LESSONS_FILE, lessons);
  console.log('📚 New lesson added:', title, '| Link stays for', lesson.availableForMinutes, 'min after start');
  res.json(lesson);
});

// Delete a lesson
app.delete('/api/lessons/:id', (req, res) => {
  lessons = lessons.filter(l => l.id !== req.params.id);
  saveJSON(LESSONS_FILE, lessons);
  res.json({ success: true });
});

// Manual test push to ALL subscribers
app.post('/api/test-push', async (req, res) => {
  if (!publicKey) return res.status(500).json({ error: 'VAPID keys missing' });
  if (subscriptions.length === 0) return res.status(400).json({ error: 'No subscribers yet' });

  const payload = JSON.stringify({
    title: 'Test – Swisha Lesson Ping 🎓',
    body: 'This is a test. The Join button works!',
    url: 'https://meet.google.com/gmc-ekpq-cqc?hs=224'
  });

  let sent = 0;
  for (const sub of [...subscriptions]) {
    try {
      await webpush.sendNotification(sub, payload);
      sent++;
    } catch (err) {
      console.error('Push failed:', err.message);
      if (err.statusCode === 410 || err.statusCode === 404) {
        subscriptions = subscriptions.filter(s => s.endpoint !== sub.endpoint);
      }
    }
  }
  saveJSON(SUBS_FILE, subscriptions);
  res.json({ sent, total: subscriptions.length });
});

// ========== SCHEDULER – check every minute ==========
// Sends the 5-minute warning to ALL subscribers
cron.schedule('* * * * *', async () => {
  if (!publicKey || subscriptions.length === 0) return;

  const now = new Date();
  const fiveMinFromNow = new Date(now.getTime() + 5 * 60 * 1000);
  const sixMinFromNow = new Date(now.getTime() + 6 * 60 * 1000);

  for (const lesson of lessons) {
    if (lesson.notified) continue;

    const start = new Date(lesson.startTime);
    // Send if lesson starts between 5 and 6 minutes from now
    if (start >= fiveMinFromNow && start < sixMinFromNow) {
      console.log('⏰ Sending reminder for:', lesson.title, '→ to', subscriptions.length, 'devices');

      const payload = JSON.stringify({
        title: `📚 ${lesson.title}`,
        body: 'Starts in 5 minutes! Tap Join to enter.',
        url: lesson.joinUrl
      });

      for (const sub of [...subscriptions]) {
        try {
          await webpush.sendNotification(sub, payload);
        } catch (err) {
          console.error('Failed to send to one subscriber:', err.message);
          if (err.statusCode === 410 || err.statusCode === 404) {
            subscriptions = subscriptions.filter(s => s.endpoint !== sub.endpoint);
          }
        }
      }
      saveJSON(SUBS_FILE, subscriptions);

      lesson.notified = true;
      saveJSON(LESSONS_FILE, lessons);
    }
  }

  // Clean up very old lessons (older than 24h past their available window)
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const before = lessons.length;
  lessons = lessons.filter(lesson => {
    const start = new Date(lesson.startTime);
    const availableMinutes = lesson.availableForMinutes || 60;
    const expiresAt = new Date(start.getTime() + availableMinutes * 60 * 1000);
    return expiresAt > oneDayAgo;
  });
  if (lessons.length !== before) {
    saveJSON(LESSONS_FILE, lessons);
  }
});

// Serve the app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Swisha Module2 Lesson Ping running at http://localhost:${PORT}`);
  console.log(`   Open that URL on your phone/computer to install & subscribe.\n`);
});
