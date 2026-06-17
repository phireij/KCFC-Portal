// Firebase Cloud Messaging Background Service Worker
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function(event) {
  if (!event.data) return;
  
  try {
    const payload = event.data.json();
    const notificationTitle = payload.notification?.title || 'New Announcement';
    const notificationOptions = {
      body: payload.notification?.body || 'A new announcement has been posted.',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: {
        url: payload.notification?.click_action || '/announcements'
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(notificationTitle, notificationOptions)
    );
  } catch (err) {
    console.error('Error parsing push event data:', err);
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/announcements';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
