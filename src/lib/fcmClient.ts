import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { app, db } from "./firebase";

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
 * Request notification permission and register user's device FCM token
 */
export async function registerDeviceToken(userId: string, requestPermission = false): Promise<string | null> {
  try {
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
        return `simulated-registration-failed-token:${tokenErr?.message || tokenErr}`;
      }
      throw tokenErr;
    }

    if (token) {
      // Cleanly append device token to current user's profile in Firestore using arrayUnion
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, {
        fcmTokens: arrayUnion(token),
        updatedAt: new Date().toISOString()
      });
      console.log("FCM: Device push token registered successfully:", token);
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
