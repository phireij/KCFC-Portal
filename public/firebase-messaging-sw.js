// Firebase Cloud Messaging Background Service Worker
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function(event) {
  let title = 'New Notification';
  let body = 'You have a new alert in your portal.';
  let clickUrl = '/inbox';
  let icon = '/logo-v4.png';
  let badgeCount = 1;
  
  if (event.data) {
    try {
      const payload = event.data.json();
      title = payload.notification?.title || 
              payload.data?.title || 
              payload.data?.notification?.title || 
              payload.title ||
              title;
               
      body = payload.notification?.body || 
             payload.data?.body || 
             payload.data?.notification?.body || 
             payload.body ||
             body;
               
      icon = payload.notification?.icon || 
             payload.data?.icon || 
             payload.notification?.image || 
             payload.icon ||
             icon;
               
      clickUrl = payload.notification?.click_action || 
                 payload.notification?.clickAction || 
                 payload.data?.click_action || 
                 payload.data?.clickAction || 
                 payload.data?.['gcm.notification.click_action'] || 
                 payload.data?.url ||
                 payload.url ||
                 clickUrl;

      const payloadBadge = payload?.badge || payload?.data?.badge || payload?.data?.notification?.badge;
      if (payloadBadge !== undefined) {
        const parsed = parseInt(payloadBadge, 10);
        if (!isNaN(parsed)) badgeCount = parsed;
      }
    } catch (err) {
      // Fallback if data is not JSON or plain text
      try {
        body = event.data.text() || body;
      } catch (_) {}
    }
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

  // iOS/Safari-specific check: navigator info in SW context
  let isIOS = false;
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';
    const maxTouchPoints = navigator.maxTouchPoints || 0;
    isIOS = /iPad|iPhone|iPod/.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1);
  }

  const notificationOptions = {
    body: body,
    icon: absoluteIcon,
    data: {
      url: absoluteClickUrl
    }
  };
  
  // iOS Safari background push safety: omit vibrate, sound, and badge options to prevent drops/crashes
  if (!isIOS) {
    if (absoluteBadge) {
      notificationOptions.badge = absoluteBadge;
    }
    notificationOptions.sound = 'default';
    notificationOptions.vibrate = [200, 100, 200];
  }
  
  // Directly invoke showNotification synchronously in the main thread of event listener!
  const showPromise = self.registration.showNotification(title, notificationOptions)
    .then(function() {
      // Safe badging side-effect on notification display success
      if (typeof navigator !== 'undefined' && typeof navigator.setAppBadge === 'function') {
        return navigator.setAppBadge(badgeCount).catch(function(err) {
          console.warn('FCM SW: setAppBadge rejected in SW:', err);
        });
      }
    })
    .catch(function(err) {
      console.error('FCM SW: showNotification rejected, falling back to basic notification:', err);
      const fallbackOptions = {
        body: body
      };
      if (!isIOS) {
        fallbackOptions.sound = 'default';
        fallbackOptions.vibrate = [200, 100, 200];
      }
      return self.registration.showNotification(title, fallbackOptions).then(function() {
        if (typeof navigator !== 'undefined' && typeof navigator.setAppBadge === 'function') {
          return navigator.setAppBadge(badgeCount).catch(function() {});
        }
      }).catch(function(fallbackErr) {
        console.error('FCM SW: Fallback notification also rejected:', fallbackErr);
      });
    });

  // Pass the promise directly to event.waitUntil synchronously!
  event.waitUntil(showPromise);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/announcements';

  // Clear app badge when notification clicked
  if (typeof navigator !== 'undefined' && 'clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch(function(err) {
      console.warn('FCM SW: Failed to clear badge on click:', err);
    });
  }
  
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

