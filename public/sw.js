// Service Worker – handles push notifications and the Join button

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Show notification when push arrives
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
    actions: [
      { action: 'join', title: 'Join' }
    ],
    requireInteraction: true,
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '📚 Lesson Alert', options)
  );
});

// Handle click on notification or the "Join" button
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open the meeting link (or the app)
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
