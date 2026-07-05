// Firebase Cloud Messaging Background Service Worker
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function(event) {
  if (!event.data) return;
  
  let title = 'New Notification';
  let body = 'You have a new alert in your portal.';
  let clickUrl = '/inbox';
  let icon = '/favicon.ico';
  
  try {
    const payload = event.data.json();
    title = payload.notification?.title || 
            payload.data?.title || 
            payload.data?.notification?.title || 
            title;
            
    body = payload.notification?.body || 
           payload.data?.body || 
           payload.data?.notification?.body || 
           body;
           
    icon = payload.notification?.icon || 
           payload.data?.icon || 
           payload.notification?.image || 
           icon;
           
    clickUrl = payload.notification?.click_action || 
               payload.notification?.clickAction || 
               payload.data?.click_action || 
               payload.data?.clickAction || 
               payload.data?.['gcm.notification.click_action'] || 
               clickUrl;
  } catch (err) {
    // Fallback if data is not JSON or plain text
    try {
      body = event.data.text() || body;
    } catch (_) {}
  }
  
  // Resolve relative URLs to fully qualified absolute URLs (Strictly required by iOS/Safari)
  let absoluteIcon = icon;
  if (icon && !icon.startsWith('http://') && !icon.startsWith('https://')) {
    try {
      absoluteIcon = new URL(icon, self.location.origin).href;
    } catch (_) {}
  }
  
  let absoluteBadge = absoluteIcon;
  
  let absoluteClickUrl = clickUrl;
  if (clickUrl && !clickUrl.startsWith('http://') && !clickUrl.startsWith('https://')) {
    try {
      absoluteClickUrl = new URL(clickUrl, self.location.origin).href;
    } catch (_) {}
  }

  const notificationOptions = {
    body: body,
    icon: absoluteIcon,
    badge: absoluteBadge,
    data: {
      url: absoluteClickUrl
    }
  };
  
  // Display the notification with a robust iOS fallback mechanism to prevent silent failures
  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
      .catch(function(err) {
        console.error('FCM SW: showNotification rejected on iOS Safari, falling back to basic notification:', err);
        return self.registration.showNotification(title, {
          body: body
        });
      })
  );
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

// Pass-through fetch event handler to comply with browser PWA installability rules.
// Safari Bugfix: Only intercept GET requests. Non-GET requests (like POST api calls with custom headers/body)
// must bypass the service worker to prevent Safari from throwing "The string did not match the expected pattern".
self.addEventListener('fetch', (event) => {
  if (event.request.method === 'GET') {
    event.respondWith(fetch(event.request));
  }
});

