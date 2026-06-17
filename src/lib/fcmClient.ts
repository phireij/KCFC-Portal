import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { app, db } from "./firebase";

// Voluntary Application Server Identification (VAPID) key
const VAPID_KEY = ((import.meta as any).env?.VITE_FCM_VAPID_KEY as string) || "";

/**
 * Request notification permission and register user's device FCM token
 */
export async function registerDeviceToken(userId: string): Promise<string | null> {
  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn("FCM: Push notifications are not supported in this browser or sandbox iframe environment.");
      return null;
    }

    if (!VAPID_KEY) {
      console.info("FCM: VAPID Key not found (VITE_FCM_VAPID_KEY is empty). Client will fall back to simulated notifications.");
      return null;
    }

    if (typeof window === "undefined" || !("Notification" in window)) {
      console.warn("FCM: Notification API is not available on the window object.");
      return null;
    }

    // Request notification permission if not already allowed
    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }

    if (permission !== "granted") {
      console.warn("FCM: Notification permission was denied or ignored.");
      return null;
    }

    // Get FCM registration token
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
    });

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
      console.warn("FCM: No registration token received from instance.");
      return null;
    }
  } catch (error) {
    console.error("FCM: Failed to register device push token:", error);
    return null;
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
