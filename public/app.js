// ========== SERVICE WORKER REGISTRATION ==========
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(reg => console.log('SW registered', reg.scope))
    .catch(err => console.error('SW registration failed', err));
}

// ========== STATE ==========
let vapidPublicKey = null;

// ========== HELPERS ==========
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function showStatus(el, msg, type = 'ok') {
  el.style.display = 'block';
  el.className = 'status ' + type;
  el.textContent = msg;
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ========== TABS ==========
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
  });
});

// ========== INSTALL PROMPT ==========
let deferredPrompt = null;
const installBanner = document.getElementById('installBanner');
const installBtn = document.getElementById('installBtn');
const iosHint = document.getElementById('iosHint');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBanner.classList.add('show');
  installBtn.style.display = 'block';
});

installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') {
    installBanner.classList.remove('show');
  }
  deferredPrompt = null;
});

// Detect iOS
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
if (isIOS && !isStandalone) {
  installBanner.classList.add('show');
  iosHint.style.display = 'block';
}

// ========== LOAD VAPID KEY ==========
async function loadVapidKey() {
  try {
    const res = await fetch('/api/vapid-public-key');
    const data = await res.json();
    vapidPublicKey = data.publicKey;
    if (!vapidPublicKey) {
      showStatus(document.getElementById('status'),
        'Server is missing VAPID keys. Run “npm run generate-vapid” first.', 'err');
    }
  } catch (e) {
    console.error(e);
  }
}

// ========== SUBSCRIBE ==========
const subscribeBtn = document.getElementById('subscribeBtn');
const statusEl = document.getElementById('status');
const testBtn = document.getElementById('testBtn');

subscribeBtn.addEventListener('click', async () => {
  if (!vapidPublicKey) {
    showStatus(statusEl, 'VAPID key not loaded yet. Is the server running?', 'err');
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showStatus(statusEl, 'Permission denied. Please allow notifications.', 'err');
      return;
    }

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();

    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });
    }

    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub)
    });
    const data = await res.json();

    showStatus(statusEl, `✅ You will receive lesson alerts! (${data.totalSubscribers || ''} people subscribed)`, 'ok');
    subscribeBtn.textContent = 'Notifications Enabled';
    subscribeBtn.disabled = true;
    testBtn.style.display = 'block';
  } catch (err) {
    console.error(err);
    showStatus(statusEl, 'Error: ' + err.message, 'err');
  }
});

// Test push
testBtn.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/test-push', { method: 'POST' });
    const data = await res.json();
    if (data.error) {
      showStatus(statusEl, data.error, 'err');
    } else {
      showStatus(statusEl, `Test sent to ${data.sent} device(s)`, 'ok');
    }
  } catch (e) {
    showStatus(statusEl, 'Failed to send test', 'err');
  }
});

// ========== LOAD LESSONS ==========
async function loadLessons() {
  const list = document.getElementById('lessonList');
  try {
    const res = await fetch('/api/lessons');
    const lessons = await res.json();

    if (!lessons.length) {
      list.innerHTML = '<div class="empty">No upcoming or active lessons.</div>';
      return;
    }

    const now = new Date();

    list.innerHTML = lessons.map(l => {
      const start = new Date(l.startTime);
      const availableMinutes = l.availableForMinutes || 60;
      const expiresAt = new Date(start.getTime() + availableMinutes * 60 * 1000);
      const hasStarted = start <= now;
      const isJoinable = hasStarted && expiresAt > now;
      const isUpcoming = start > now;

      let statusBadge = '';
      if (isJoinable) {
        statusBadge = '<span style="background:#d1fae5; color:#065f46; font-size:0.75rem; font-weight:600; padding:3px 8px; border-radius:6px;">JOIN NOW</span>';
      } else if (isUpcoming) {
        statusBadge = '<span style="background:#ede9fe; color:#5b21b6; font-size:0.75rem; font-weight:600; padding:3px 8px; border-radius:6px;">UPCOMING</span>';
      }

      return `
        <div class="lesson">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <div class="lesson-title">${escapeHtml(l.title)}</div>
            ${statusBadge}
          </div>
          <div class="lesson-time">${formatTime(l.startTime)}</div>
          <div style="font-size:0.8rem; color:#6b7280; margin-top:2px;">
            Link available until ${formatTime(expiresAt.toISOString())}
          </div>
          <a class="lesson-join" href="${escapeHtml(l.joinUrl)}" target="_blank" rel="noopener">
            🔗 Join meeting
          </a>
        </div>
      `;
    }).join('');
  } catch (e) {
    list.innerHTML = '<div class="empty">Could not load lessons.</div>';
  }
}

// ========== ADD LESSON (shared with everyone) ==========
document.getElementById('lessonForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('title').value.trim();
  const startTime = document.getElementById('startTime').value;
  const joinUrl = document.getElementById('joinUrl').value.trim();
  const availableForMinutes = document.getElementById('availableForMinutes').value;
  const adminStatus = document.getElementById('adminStatus');

  try {
    const res = await fetch('/api/lessons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, startTime, joinUrl, availableForMinutes })
    });
    if (!res.ok) throw new Error('Failed to save');
    showStatus(adminStatus, '✅ Lesson saved! Everyone who enabled notifications will be alerted 5 min before, and the Join link will stay available for the time you chose.', 'ok');
    document.getElementById('title').value = '';
    loadLessons();
  } catch (err) {
    showStatus(adminStatus, 'Error saving lesson', 'err');
  }
});

// ========== INIT ==========
loadVapidKey();
loadLessons();
setInterval(loadLessons, 30000); // refresh every 30 seconds
