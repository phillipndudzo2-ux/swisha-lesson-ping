const CACHE_NAME = 'swisha-lesson-ping-v2';
const APP_SHELL = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req).catch(() =>
        new Response(JSON.stringify({ offline: true }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && req.url.startsWith(self.location.origin)) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached || caches.match('/index.html'));

      return cached || networkFetch;
    })
  );
});

self.addEventListener('push', (event) => {
  let data = { title: 'Lesson starting soon', body: 'Tap to join', url: '/' };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {}

  const options = {
    body: data.body || 'Starts in 5 minutes',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
    actions: [{ action: 'join', title: 'Join' }],
    requireInteraction: true,
    vibrate: [300, 100, 300, 100, 300],
    silent: false
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Swisha Lesson Ping', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
