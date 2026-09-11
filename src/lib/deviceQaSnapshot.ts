export type DeviceQaSnapshot = {
  capturedAt: string;
  platform: string;
  userAgent: string;
  language: string;
  timezone: string;
  viewport: { width: number; height: number; devicePixelRatio: number };
  online: boolean;
  standalone: boolean;
  notificationPermission: NotificationPermission | 'unsupported';
  serviceWorkerSupported: boolean;
  pushManagerSupported: boolean;
};

export type DeviceQaEnvironment = {
  now?: () => Date;
  userAgent?: string;
  platform?: string;
  language?: string;
  timezone?: string;
  width?: number;
  height?: number;
  devicePixelRatio?: number;
  online?: boolean;
  standalone?: boolean;
  notificationPermission?: NotificationPermission | 'unsupported';
  serviceWorkerSupported?: boolean;
  pushManagerSupported?: boolean;
};

export function createDeviceQaSnapshot(environment: DeviceQaEnvironment): DeviceQaSnapshot {
  return {
    capturedAt: (environment.now?.() || new Date()).toISOString(),
    platform: environment.platform || 'unknown',
    userAgent: environment.userAgent || 'unknown',
    language: environment.language || 'unknown',
    timezone: environment.timezone || 'unknown',
    viewport: {
      width: Math.max(0, Math.round(environment.width || 0)),
      height: Math.max(0, Math.round(environment.height || 0)),
      devicePixelRatio: Math.max(0, environment.devicePixelRatio || 0),
    },
    online: environment.online ?? true,
    standalone: environment.standalone ?? false,
    notificationPermission: environment.notificationPermission || 'unsupported',
    serviceWorkerSupported: environment.serviceWorkerSupported ?? false,
    pushManagerSupported: environment.pushManagerSupported ?? false,
  };
}

/**
 * Captures non-secret browser/PWA diagnostics for staging QA. This deliberately
 * excludes Firebase IDs, push subscription endpoints, auth tokens, email,
 * member identity and any application data.
 */
export function captureBrowserDeviceQaSnapshot(): DeviceQaSnapshot {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return createDeviceQaSnapshot({});
  }

  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  const notificationPermission: NotificationPermission | 'unsupported' =
    'Notification' in window ? Notification.permission : 'unsupported';

  return createDeviceQaSnapshot({
    userAgent: navigator.userAgent,
    platform: navigator.platform || 'unknown',
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    online: navigator.onLine,
    standalone,
    notificationPermission,
    serviceWorkerSupported: 'serviceWorker' in navigator,
    pushManagerSupported: 'PushManager' in window,
  });
}

export function formatDeviceQaSnapshot(snapshot: DeviceQaSnapshot): string {
  return [
    `Captured: ${snapshot.capturedAt}`,
    `Platform: ${snapshot.platform}`,
    `Language: ${snapshot.language}`,
    `Timezone: ${snapshot.timezone}`,
    `Viewport: ${snapshot.viewport.width}x${snapshot.viewport.height} @ ${snapshot.viewport.devicePixelRatio}x`,
    `Online: ${snapshot.online ? 'yes' : 'no'}`,
    `PWA standalone: ${snapshot.standalone ? 'yes' : 'no'}`,
    `Notification permission: ${snapshot.notificationPermission}`,
    `Service Worker: ${snapshot.serviceWorkerSupported ? 'supported' : 'unsupported'}`,
    `Push Manager: ${snapshot.pushManagerSupported ? 'supported' : 'unsupported'}`,
    `User agent: ${snapshot.userAgent}`,
  ].join('\n');
}
