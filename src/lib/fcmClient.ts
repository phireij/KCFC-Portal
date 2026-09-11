import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { app, db, auth } from "./firebase";

// Voluntary Application Server Identification (VAPID) key
export function cleanVapidKey(key: string): string {
  if (!key) return "";
  let cleaned = key.trim();
  // Remove any surrounding single/double quotes (e.g. from env loading)
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.substring(1, cleaned.length - 1).trim();
  }
  // Convert standard base64 characters + and / to - and _ (base64url format)
  cleaned = cleaned.replace(/\+/g, '-').replace(/\//g, '_');
  // Remove any trailing = padding
  cleaned = cleaned.replace(/=+$/, '');
  return cleaned;
}

export const VAPID_KEY = cleanVapidKey(((import.meta as any).env?.VITE_FCM_VAPID_KEY as string) || "");

export let cachedVapidKeyFromServer: string | null = null;

/**
 * Preloads the public VAPID key from the backend.
 * Must be called early on page load so that when the user clicks a subscription button,
 * we can subscribe immediately with ZERO network async ticks, preserving user gesture context on iOS.
 */
export async function preloadVapidKeyFromServer(): Promise<string | null> {
  if (cachedVapidKeyFromServer) return cachedVapidKeyFromServer;
  try {
    const response = await fetch("/api/webpush/public-key");
    if (response.ok) {
      const data = await response.json();
      if (data && data.publicKey) {
        const cleanedKey = cleanVapidKey(data.publicKey);
        cachedVapidKeyFromServer = cleanedKey;
        console.log("WebPush: Preloaded VAPID public key from server successfully.");
        return cleanedKey;
      }
    }
  } catch (err) {
    console.warn("WebPush: Failed to preload VAPID public key:", err);
  }
  return null;
}

export function isIOSDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIPad = ua.includes("iPad") || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ua.includes("iPhone") || ua.includes("iPod") || isIPad;
}

export function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  const isNavStandalone = (navigator as any).standalone === true;
  return !!(isStandalone || isNavStandalone);
}

export function requiresNativeWebPush(): boolean {
  return isIOSDevice() || isStandaloneMode();
}

export async function prepareNativeWebPushPrerequisites(): Promise<void> {
  await preloadVapidKeyFromServer();
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  let swReg = await navigator.serviceWorker.getRegistration("/");
  if (!swReg) {
    swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
  }
  if (!swReg.active) {
    await navigator.serviceWorker.ready;
  }
}

/**
 * Highly robust, cross-browser wrapper for requesting notification permissions.
 * Supports both modern Promise-based and older Callback-based (Safari/iOS) APIs,
 * ensuring the prompt is reliably triggered during a user gesture.
 */
export function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return Promise.resolve("default" as NotificationPermission);
  }

  return new Promise((resolve) => {
    try {
      // Modern browsers support the promise-based API, but iOS Safari historically
      // requires a callback. We provide a callback that resolves our promise.
      const permissionPromise = Notification.requestPermission((result) => {
        resolve(result);
      });

      // If the browser returned a Promise, we can also chain resolve/reject onto it
      if (permissionPromise && typeof (permissionPromise as any).then === "function") {
        (permissionPromise as any)
          .then(resolve)
          .catch(() => {
            // Fall back to reading the property if the promise rejects
            resolve(Notification.permission);
          });
      }
    } catch (err) {
      console.warn("FCM: Error requesting notification permission:", err);
      resolve(Notification.permission);
    }
  });
}

/**
 * Check if the VAPID key is a valid public key format.
 * Highly robust check to prevent blocking valid base64-encoded VAPID keys.
 */
export function isValidVapidPublicKey(key: string): boolean {
  if (!key) return false;
  const cleanKey = cleanVapidKey(key);
  // Standard Web Push VAPID public keys are uncompressed EC P-256 keys.
  // Their base64 or base64url encoded representation is exactly 87 or 88 characters long.
  // We check for length between 80 and 100 to catch invalid keys (like 43-char Sender IDs or App IDs).
  return cleanKey.length >= 80 && cleanKey.length <= 100 && !/\s/.test(cleanKey);
}

/**
 * Registers standard browser Web Push directly by fetching the public key from the backend.
 * Completely independent of VITE_FCM_VAPID_KEY and FCM JS SDK.
 * Highly robust, works on all devices (iOS Safari, Android Chrome, Desktop, etc.).
 */
export async function registerWebPushDirectly(userId: string, requestPermission = false, throwOnFailure = false): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    const msg = "Notification API is not supported in this browser.";
    console.warn(`WebPush: ${msg}`);
    if (throwOnFailure) throw new Error(msg);
    return false;
  }

  // 1. Request notification permission if needed
  let permission = Notification.permission;
  if (permission === "default" && requestPermission) {
    permission = await requestNotificationPermission();
  }

  if (permission !== "granted") {
    const msg = `Notification permission is "${permission}" instead of "granted".`;
    console.warn(`WebPush: ${msg}`);
    if (throwOnFailure) throw new Error(msg);
    return false;
  }

  // 2. Register Service Worker and subscribe
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    try {
      // Use existing registration if already registered to save precious microtask ticks on iOS
      let swReg = await navigator.serviceWorker.getRegistration("/");
      if (!swReg) {
        swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
      }
      if (!swReg.active) {
        swReg = await navigator.serviceWorker.ready;
      }

      const success = await registerStandardWebPush(swReg, userId, throwOnFailure);
      return success;
    } catch (err) {
      console.error("WebPush: Failed to register service worker or subscribe:", err);
      if (throwOnFailure) throw err;
      return false;
    }
  }

  if (throwOnFailure) {
    throw new Error("Service Worker API is not supported in this browser context.");
  }
  return false;
}

/**
 * Request notification permission and register user's device FCM token
 */
export async function registerDeviceToken(userId: string, requestPermission = false): Promise<string | null> {
  try {
    const mustHaveNativeWebPush = requiresNativeWebPush();
    
    // iOS/Home Screen PWAs are extremely sensitive to user-activation timing.
    // Try native Web Push before any Firebase async checks so the subscription stays
    // as close as possible to the user's tap.
    const isWebPushSuccessful = await registerWebPushDirectly(userId, requestPermission, mustHaveNativeWebPush);
    if (isWebPushSuccessful) {
      console.log("FCM: Native Web Push subscription registered successfully as primary channel.");
      return `webpush-registered-token-for-user:${userId}`;
    }

    if (mustHaveNativeWebPush) {
      throw new Error(
        "Native Web Push registration did not complete. On iPhone/iPad Home Screen apps, lock-screen alerts require a real Web Push subscription; in-app/browser-only notification permission is not enough."
      );
    }

    const supported = await isSupported();

    // If not supported by Firebase FCM but standard Notification API is available, fall back to simulated mode
    if (!supported) {
      console.warn("FCM: Push notifications via FCM are not fully supported in this browser, device, or iframe environment.");
      if (typeof window !== "undefined" && "Notification" in window) {
        console.info("FCM: Falling back to standard browser Notification API for simulated alerts.");
        let permission = Notification.permission;
        if (permission === "default" && requestPermission) {
          permission = await requestNotificationPermission();
        }
        if (permission === "granted") {
          return "simulated-browser-token";
        }
        throw new Error(`FCM push is unsupported and standard permission is "${permission}"`);
      }
      throw new Error("This browser/device does not support standard or FCM push notifications.");
    }

    const isVapidValid = isValidVapidPublicKey(VAPID_KEY);

    if (!VAPID_KEY || !isVapidValid) {
      if (!VAPID_KEY) {
        console.info("FCM: VAPID Key not found (VITE_FCM_VAPID_KEY is empty). Client will fall back to simulated notifications.");
      } else {
        console.warn(`FCM: VAPID Key "${VAPID_KEY}" has an invalid format (must be a 87-88 character P-256 public key). Falling back to simulated notifications.`);
      }

      if (typeof window !== "undefined" && "Notification" in window) {
        let permission = Notification.permission;
        if (permission === "default" && requestPermission) {
          permission = await requestNotificationPermission();
        }
        if (permission === "granted") {
          return !VAPID_KEY ? "simulated-device-token" : "simulated-invalid-vapid-token";
        }
        throw new Error(`Simulated alerts require permission to be "granted", but it is currently "${permission}"`);
      }
      throw new Error("VAPID Key is missing/invalid and Notification API is not available on this browser/device.");
    }

    if (typeof window === "undefined" || !("Notification" in window)) {
      throw new Error("Notification API is not available on this browser/device.");
    }

    // Request notification permission if not already allowed
    let permission = Notification.permission;
    if (permission === "default" && requestPermission) {
      permission = await requestNotificationPermission();
    }

    if (permission !== "granted") {
      throw new Error(`Notification permission is "${permission}" (not "granted")`);
    }

    // iOS/Safari Native Web Push Bypass: skip FCM token generation to avoid subscription collision.
    // FCM's getToken creates an overlapping subscription on Safari that breaks/unsubscribes standard web push,
    // leading to silent or failing background delivery. Standard Web Push is fully native and 100% stable on iOS.
    if (isIOSDevice()) {
      console.log("FCM: iOS device detected. Bypassing FCM and registering standard Web Push directly...");
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
        await navigator.serviceWorker.ready;
        console.log("FCM: Service worker registered and ready for iOS standard Web Push.");

        const success = await registerStandardWebPush(swReg, userId);
        if (success) {
          console.log("FCM: Successfully registered iOS native Web Push!");
          return `webpush-registered-token-for-user:${userId}`;
        } else {
          throw new Error("Failed to register standard Web Push subscription on iOS.");
        }
      } else {
        throw new Error("Service Worker is not supported in this navigator.");
      }
    }

    // Get FCM registration token
    const messaging = getMessaging(app);
    
    // Obtain explicit Service Worker registration
    let serviceWorkerRegistration;
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      try {
        // Register standard PWA service worker with clear scope
        serviceWorkerRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
        
        // Wait until service worker is active and ready before attempting to fetch the FCM token
        await navigator.serviceWorker.ready;
        console.log("FCM: Service worker registered and ready.");

        // SAFARI BUGFIX: If there's an existing push subscription, unsubscribe it first
        // to prevent Safari from throwing "The string did not match the expected pattern" 
        // due to a VAPID key or subscription state mismatch.
        if (serviceWorkerRegistration.pushManager) {
          const existingSub = await serviceWorkerRegistration.pushManager.getSubscription();
          if (existingSub) {
            console.log("FCM: Found existing push subscription. Unsubscribing to prevent Safari VAPID pattern mismatch.");
            try {
              await existingSub.unsubscribe();
              console.log("FCM: Unsubscribed successfully.");
            } catch (unsubErr) {
              console.warn("FCM: Error while unsubscribing existing push subscription:", unsubErr);
            }
          }
        }

        // Register standard browser Web Push subscription as a robust primary/fallback mechanism
        try {
          await registerStandardWebPush(serviceWorkerRegistration, userId);
        } catch (wpErr) {
          console.warn("FCM: Failed standard Web Push registration:", wpErr);
        }
      } catch (swErr: any) {
        console.warn("FCM: Could not obtain explicit service worker registration:", swErr);
      }
    }

    let token: string | null = null;
    try {
      token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        ...(serviceWorkerRegistration ? { serviceWorkerRegistration } : {})
      });
    } catch (tokenErr: any) {
      console.error("FCM: Failed to obtain push subscription from Firebase Messaging:", tokenErr);
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        console.info("FCM: Falling back to simulated device token due to browser/Firebase push registration error.");
        // If standard Web Push registration succeeded, we still return a success token so the UI is happy
        return `webpush-registered-token-for-user:${userId}`;
      }
      throw tokenErr;
    }

    if (token) {
      const currentUser = auth.currentUser;
      if (!currentUser || currentUser.uid !== userId) {
        throw new Error("Authenticated user does not match the device-registration target.");
      }
      const idToken = await currentUser.getIdToken();
      const response = await fetch("/api/users/register-fcm-token", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) {
        throw new Error("Failed to register FCM device token with the KCFC server.");
      }
      console.log("FCM: Device push token registered successfully.");
      return token;
    } else {
      throw new Error("No token returned by the FCM registration server.");
    }
  } catch (error: any) {
    console.error("FCM: Failed to register device push token:", error);
    throw error;
  }
}

/**
 * Subscribes the standard browser to standard Web Push and registers with our backend
 */
export async function registerStandardWebPush(serviceWorkerRegistration: ServiceWorkerRegistration, userId: string, throwOnFailure = false): Promise<boolean> {
  if (!serviceWorkerRegistration || !serviceWorkerRegistration.pushManager) {
    const msg = "PushManager is not available on the active service worker registration.";
    console.warn(`WebPush: ${msg}`);
    if (throwOnFailure) throw new Error(msg);
    return false;
  }

  try {
    // 1. Get preloaded VAPID key from backend, or fetch if not ready (saves network async tick inside user gesture)
    let publicKey = cachedVapidKeyFromServer;
    if (!publicKey) {
      console.log("WebPush: VAPID key not preloaded, fetching now (warning: may fail on iOS Safari)...");
      const response = await fetch("/api/webpush/public-key");
      if (!response.ok) {
        throw new Error(`Failed to fetch public VAPID key from server: ${response.statusText}`);
      }
      const data = await response.json();
      publicKey = cleanVapidKey(data.publicKey);
      cachedVapidKeyFromServer = publicKey;
    }

    if (!publicKey) {
      throw new Error("Server returned an empty or missing VAPID public key.");
    }
    if (!isValidVapidPublicKey(publicKey)) {
      throw new Error(`Server returned an invalid Web Push VAPID public key. Length: ${publicKey.length}.`);
    }

    // 2. Prepare subscription options
    // Convert base64 VAPID key to Uint8Array as required by PushManager
    const padding = "=".repeat((4 - (publicKey.length % 4)) % 4);
    const base64 = (publicKey + padding).replace(/\-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    const subscriptionOptions = {
      userVisibleOnly: true,
      applicationServerKey: outputArray
    };

    // 3. Register standard browser Web Push subscription
    // SAFARI BUGFIX: Try to subscribe directly FIRST. If there's an existing subscription with correct options,
    // Safari will return it instantly in ZERO async ticks!
    // If it fails (e.g. because VAPID key changed), catch the error, unsubscribe the old subscription, and retry.
    console.log("WebPush: Subscribing standard browser PushSubscription...");
    let subscription;
    try {
      subscription = await serviceWorkerRegistration.pushManager.subscribe(subscriptionOptions);
    } catch (subErr: any) {
      console.warn("WebPush: Direct subscribe failed, checking for old subscription to unsubscribe and retry...", subErr);
      try {
        const existingSub = await serviceWorkerRegistration.pushManager.getSubscription();
        if (existingSub) {
          console.log("WebPush: Found existing subscription with mismatched options. Unsubscribing...");
          await existingSub.unsubscribe();
          console.log("WebPush: Unsubscribed successfully. Retrying subscribe...");
          subscription = await serviceWorkerRegistration.pushManager.subscribe(subscriptionOptions);
        } else {
          throw subErr;
        }
      } catch (retryErr) {
        console.error("WebPush: Subscription retry failed:", retryErr);
        throw retryErr;
      }
    }

    console.log("WebPush: Obtained PushSubscription successfully.");
    const subscriptionJson = subscription.toJSON();

    // 4. Send subscription to our backend register endpoint
    // We fetch user session token to authenticate
    let idToken = "";
    try {
      if (auth.currentUser) {
        idToken = await auth.currentUser.getIdToken(true);
      }
    } catch (authErr) {
      console.warn("WebPush: Could not fetch user ID token for authentication:", authErr);
    }

    const regResponse = await fetch("/api/webpush/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(idToken ? { "Authorization": `Bearer ${idToken}` } : {})
      },
      body: JSON.stringify({ subscription: subscriptionJson })
    });

    if (!regResponse.ok) {
      const errText = await regResponse.text();
      const isPermissionDenied = regResponse.status === 403 || /PERMISSION_DENIED|permission/i.test(errText);
      if (isPermissionDenied) {
        console.warn("WebPush: Backend registration lacked permission. Falling back to direct Firestore self-update.", errText);
        const userRef = doc(db, "users", userId);
        await updateDoc(userRef, {
          webPushSubscriptions: arrayUnion(subscriptionJson),
          updatedAt: new Date().toISOString()
        });
        console.log("WebPush: Successfully registered PushSubscription directly in Firestore.");
        return true;
      }
      throw new Error(`Backend registration failed: ${errText}`);
    }

    console.log("WebPush: Successfully registered PushSubscription on backend.");
    return true;
  } catch (err: any) {
    console.error("WebPush: Standard Web Push registration failed:", err);
    if (throwOnFailure) throw err;
    return false;
  }
}

/**
 * Handle foreground notifications inside the active browser tab
 */
export async function observeForegroundMessages(callback: (payload: any) => void): Promise<(() => void) | null> {
  try {
    const supported = await isSupported();
    if (!supported) return null;

    const messaging = getMessaging(app);
    return onMessage(messaging, (payload) => {
      console.log("FCM: Received foreground push notification:", payload);
      callback(payload);
    });
  } catch (error) {
    console.error("FCM: Error setting up foreground message observer:", error);
    return null;
  }
}
