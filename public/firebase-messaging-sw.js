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

  // Use ONLY highly-compatible, universally-supported properties in notificationOptions.
  // We completely omit 'sound', 'vibrate', and 'badge' by default for all browsers.
  // This guarantees that iOS Safari/Chrome will never drop the notification due to strict validation,
  // while Android/Desktop browsers still use their system defaults for sound and vibration.
  const notificationOptions = {
    body: body,
    icon: absoluteIcon,
    data: {
      url: absoluteClickUrl
    }
  };
  
  // Directly invoke showNotification synchronously in the main thread of the event listener.
  // We also wrap the invocation in a synchronous try-catch block to handle any immediate parameter validation exceptions,
  // preventing the Service Worker from crashing before the promise is returned.
  let showPromise;
  try {
    showPromise = self.registration.showNotification(title, notificationOptions)
      .then(function() {
        // Safe, isolated badging side-effect (runs asynchronously and does not affect the display promise)
        if (typeof navigator !== 'undefined' && typeof navigator.setAppBadge === 'function') {
          navigator.setAppBadge(badgeCount).catch(function(err) {
            console.warn('FCM SW: setAppBadge rejected:', err);
          });
        }
      })
      .catch(function(err) {
        console.error('FCM SW: showNotification promise rejected, retrying with minimal options:', err);
        return self.registration.showNotification(title, { body: body });
      });
  } catch (syncErr) {
    console.error('FCM SW: showNotification threw synchronous error:', syncErr);
    try {
      showPromise = self.registration.showNotification(title, { body: body });
    } catch (innerSyncErr) {
      console.error('FCM SW: Dual-sync crash:', innerSyncErr);
      showPromise = Promise.resolve();
    }
  }

  // Pass the promise directly to event.waitUntil synchronously!
  event.waitUntil(showPromise);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/inbox';

  // Notification navigation is intentionally same-origin only. A malformed or
  // unexpected external target fails closed to the durable KCFC Inbox.
  let targetUrl;
  try {
    targetUrl = new URL(urlToOpen, self.location.origin);
  } catch (_) {
    targetUrl = new URL('/inbox', self.location.origin);
  }
  if (targetUrl.origin !== self.location.origin) {
    targetUrl = new URL('/inbox', self.location.origin);
  }
  const absoluteTargetUrl = targetUrl.href;

  // Clear app badge when notification clicked
  if (typeof navigator !== 'undefined' && 'clearAppBadge' in navigator) {
    navigator.clearAppBadge().catch(function(err) {
      console.warn('FCM SW: Failed to clear badge on click:', err);
    });
  }
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      // Exact URL match: focus the existing destination as-is.
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === absoluteTargetUrl && 'focus' in client) {
          return client.focus();
        }
      }

      // Reuse an existing KCFC window when possible, but NAVIGATE it to the full
      // target URL first. This preserves query/hash deep links such as
      // /duties?view=mine instead of merely focusing /duties?view=all.
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        try {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin === self.location.origin && typeof client.navigate === 'function') {
            return client.navigate(absoluteTargetUrl).then(function(navigatedClient) {
              if (navigatedClient && 'focus' in navigatedClient) {
                return navigatedClient.focus();
              }
              if ('focus' in client) {
                return client.focus();
              }
            }).catch(function() {
              if (self.clients.openWindow) {
                return self.clients.openWindow(absoluteTargetUrl);
              }
            });
          }
        } catch (_) {}
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(absoluteTargetUrl);
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
