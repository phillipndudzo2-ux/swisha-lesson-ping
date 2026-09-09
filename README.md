# 📚 Lesson Alert PWA

A simple Progressive Web App that sends a **push notification 5 minutes before a lesson** starts, with a direct **“Join”** button that opens the Google Meet (or Zoom) link.

Your Google Meet link is already included as the default:
`https://meet.google.com/gmc-ekpq-cqc?hs=224`

---

## What it does

- Classmates install the app on their phone (Android or iPhone).
- They enable notifications once.
- You (or anyone) add lessons with a start time + Join link.
- Exactly 5 minutes before the lesson, everyone who subscribed gets a notification.
- Tapping **Join** opens the meeting instantly.

---

## Requirements

- A computer with **Node.js** installed (version 16 or newer).  
  Download from: https://nodejs.org

---

## Quick Start (3 steps)

### 1. Open a terminal in this folder

```bash
cd lesson-reminder-pwa
```

### 2. Install dependencies & generate keys (one time only)

```bash
npm install
npm run generate-vapid
```

### 3. Start the server

```bash
npm start
```

You will see something like:

```
🚀 Lesson Reminder PWA running at http://localhost:3000
```

---

## How to use it

### On your computer
1. Open **http://localhost:3000** in Chrome or Edge.
2. Click **Enable Push Notifications** and allow them.
3. (Optional) Click **Send Test Notification** to verify it works.

### On phones (your classmates)

**Android**
1. Open the same URL on the phone (you need to make the server reachable – see “Make it work for the whole class” below).
2. Tap the browser menu → **Install app** / **Add to Home screen**.
3. Open the installed app and enable notifications.

**iPhone (very important)**
1. Open the URL in **Safari**.
2. Tap the **Share** button → **Add to Home Screen**.
3. Open the app from the home screen icon (not from Safari).
4. Then enable notifications.

---

## Adding lessons

1. Go to the **Add Lesson** tab.
2. Fill in:
   - Title (e.g. “Math – Algebra”)
   - Start date & time
   - Meeting link (your Google Meet link is already filled in)
3. Click **Save Lesson**.

The server will automatically send a notification to everyone **5 minutes before** that time.

---

## Make it work for the whole class (important)

`localhost` only works on your own computer. To let classmates use it you have two easy options:

### Option A – Quick test with a free tunnel (recommended for first tests)
1. Install `npx` tool (comes with Node) and run:
   ```bash
   npx localtunnel --port 3000
   ```
2. It will give you a public URL like `https://something.loca.lt`
3. Share that URL with your classmates.
4. They open it, install the PWA, and enable notifications.

### Option B – Deploy for free (long-term)
- Deploy the whole folder to **Railway**, **Render**, or **Fly.io** (all have free tiers).
- Or put it on any cheap VPS / school server that can run Node.js.

Once it has a public HTTPS address, push notifications work from anywhere.

---

## Files overview

```
lesson-reminder-pwa/
├── public/               ← Frontend (the app students see)
│   ├── index.html
│   ├── app.js
│   ├── sw.js             ← Service worker (handles push + Join button)
│   ├── manifest.json
│   ├── icon-192.png
│   └── icon-512.png
├── server/
│   ├── server.js         ← Backend + scheduler
│   ├── generate-vapid.js
│   └── data/             ← Created automatically (subscriptions + lessons)
├── package.json
└── README.md             ← This file
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| “VAPID keys missing” | Run `npm run generate-vapid` then restart with `npm start` |
| No notification arrives | Make sure the phone allowed notifications **and** the app is installed (especially on iPhone) |
| iPhone doesn’t show push | Must open the app from the Home Screen icon, not Safari |
| “Join” does nothing | Check that the meeting link is correct when you add the lesson |
| Server not reachable from phone | Use a tunnel (`npx localtunnel --port 3000`) or deploy it |

---

## Demo lesson

When you first start the server it automatically creates a **demo lesson that starts in 10 minutes** using your Google Meet link.  
Enable notifications, wait ~5 minutes, and you should receive the alert.

---

Enjoy!  
If you need help deploying it so the whole class can use it permanently, just ask.
