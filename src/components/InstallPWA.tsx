import React, { useState, useEffect } from 'react';
import { Smartphone, Download, Share, PlusSquare, BellRing, CheckCircle, X, Info, ChevronRight, Bell } from 'lucide-react';
import { useAuth } from '../App';
import { registerDeviceToken, requestNotificationPermission, VAPID_KEY } from '../lib/fcmClient';

export default function InstallPWA() {
  const { user } = useAuth();
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [enablingNotifications, setEnablingNotifications] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [registeredToken, setRegisteredToken] = useState<string | null>(() => {
    return typeof window !== "undefined" ? localStorage.getItem("kcfc_registered_fcm_token") : null;
  });
  const [testingPush, setTestingPush] = useState(false);
  const [testSuccessMessage, setTestSuccessMessage] = useState<string | null>(null);
  const [testCountdown, setTestCountdown] = useState<number | null>(null);
  const testTimerRef = React.useRef<{ interval: any; timeout: any } | null>(null);

  useEffect(() => {
    // 1. Check if already installed / standalone
    const checkStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');
    
    setIsStandalone(checkStandalone);

    // 2. Check platform / device
    const ua = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(ua);
    setIsIOS(iosDevice);

    const mobileDevice = /android|iphone|ipad|ipod|windows phone|iemobile|opera mini/i.test(ua);
    setIsMobile(mobileDevice);

    // 3. Save current notification permission status
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }

    // 4. Capture beforeinstallprompt event for Android / Chrome
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 5. Read localstorage dismissal state
    const dismissed = localStorage.getItem('kcfc_pwa_install_dismissed') === 'true';
    setIsDismissed(dismissed);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      if (testTimerRef.current) {
        clearInterval(testTimerRef.current.interval);
        clearTimeout(testTimerRef.current.timeout);
      }
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the native browser install prompt
    deferredPrompt.prompt();
    
    // Wait for the user's choice
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA Install Prompt outcome: ${outcome}`);
    
    // Clear the deferred prompt (it can only be used once)
    setDeferredPrompt(null);
  };

  const handleEnableNotifications = async () => {
    if (!user) return;

    // Check if inside a sandboxed iframe (like the AI Studio preview window)
    const isIframe = window.self !== window.top;
    if (isIframe) {
      alert(
        "Preview Sandbox Limitation:\n\n" +
        "You are currently viewing the portal inside a sandboxed preview iframe where browser notification requests are restricted.\n\n" +
        "To enable and test smartphone alerts, please open the application in a new browser tab or install it directly on your device."
      );
      return;
    }

    // Check if on iOS and not running as standalone PWA
    if (isIOS && !isStandalone) {
      alert(
        "iPhone / iPad Requirement:\n\n" +
        "Apple iOS requires web applications to be added to the Home Screen before push notifications can be requested.\n\n" +
        "Please follow the 3 steps listed below:\n" +
        "1. Tap your mobile browser's Share button (the square with an up-arrow at the bottom or top).\n" +
        "2. Scroll down and select 'Add to Home Screen'.\n" +
        "3. Launch the KCFC Portal app from your Home Screen, sign in, and click 'Enable Smartphone Alerts' again."
      );
      return;
    }

    // --- REQUEST PERMISSION IMMEDIATELY & SYNCHRONOUSLY ---
    // Safari on iOS strictly requires Notification.requestPermission() to be called
    // synchronously on the direct thread of a user click. Any preceding async calls,
    // including React state updates or await ticks, will discard the user gesture context.
    let initialPermission = "default";
    if (typeof window !== "undefined" && "Notification" in window) {
      initialPermission = Notification.permission;
      if (initialPermission === "default") {
        try {
          await requestNotificationPermission();
        } catch (permError) {
          console.warn("FCM: Failed to request permission synchronously in click handler:", permError);
        }
      }
    }

    setEnablingNotifications(true);
    try {
      const token = await registerDeviceToken(user.uid, true);
      if (token) {
        if (!token.startsWith("simulated")) {
          setRegisteredToken(token);
          if (typeof window !== "undefined") {
            localStorage.setItem("kcfc_registered_fcm_token", token);
          }
        }
        if ('Notification' in window) {
          setNotificationPermission(Notification.permission);
        }
        
        if (token.startsWith("simulated")) {
          let reason = "An unknown browser issue occurred during device registration.";
          if (token === "simulated-browser-token") {
            reason = "Firebase Cloud Messaging (FCM) is not fully supported in this browser environment or inside an iframe.";
          } else if (token === "simulated-device-token") {
            reason = "The server's VAPID Public Key (VITE_FCM_VAPID_KEY) is empty or missing.";
          } else if (token === "simulated-invalid-vapid-token") {
            reason = `The configured VAPID Public Key is invalid or malformed.\n\n` +
                     `• Configured Key: "${VAPID_KEY || ""}"\n` +
                     `• Current Key Length: ${VAPID_KEY?.length || 0} characters.\n` +
                     `• Expected Format: Standard Web Push VAPID public keys are P-256 EC keys and are exactly 87-88 characters long (and usually start with 'B').\n\n` +
                     `Please open your Firebase Console, navigate to Project Settings -> Cloud Messaging -> Web Push certificates, and copy the full 87-88 character 'Key pair'.`;
          } else if (token.startsWith("simulated-registration-failed-token:")) {
            const rawError = token.substring("simulated-registration-failed-token:".length);
            reason = `The Firebase FCM registration server rejected the request with the following error:\n"${rawError}"\n\n` +
                     `• Configured VAPID Key: "${VAPID_KEY || ""}" (Length: ${VAPID_KEY?.length || 0} characters).\n\n` +
                     `This typically happens if the VAPID Public Key is mismatched with your active Firebase project configuration, if the key is truncated, or if there is a network blocker.`;
          }

          alert(
            "Notice: Smartphone Alerts Activated in Simulated Mode.\n\n" +
            reason + "\n\n" +
            "You will receive live alerts inside the KCFC Portal while using it, but native push notifications may not appear on your device's lock screen when the app is closed."
          );
        } else {
          alert("Success!\n\nSmartphone alerts have been successfully activated on this device!");
        }
      } else {
        alert("Could not activate push notifications at this time. Please make sure notifications are allowed in your browser and device settings.");
      }
    } catch (err: any) {
      console.error("Error enabling notifications:", err);
      const errMsg = err?.message || String(err);
      
      if (errMsg.toLowerCase().includes('denied') || errMsg.toLowerCase().includes('permission')) {
        alert(
          "Notice: Notification permission was denied or blocked by iOS settings.\n\n" +
          "To fix this on your iPhone / iPad:\n" +
          "1. Open your device's 'Settings' app.\n" +
          "2. Scroll down to 'Notifications'.\n" +
          "3. Find and select 'KCFC Portal'.\n" +
          "4. Toggle 'Allow Notifications' to ON.\n" +
          "5. Re-open this app and tap 'Enable Smartphone Alerts' again!"
        );
      } else {
        alert(
          "Notice: Could not register device for smartphone alerts.\n\n" +
          "Details: " + errMsg + "\n\n" +
          "If the permission prompt did not appear, please make sure you allowed notifications in your iOS Settings -> Notifications -> KCFC Portal, or reset the app and try again."
        );
      }
    } finally {
      setEnablingNotifications(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('kcfc_pwa_install_dismissed', 'true');
  };

  const handleSendTestPush = async () => {
    if (!user) return;
    setTestingPush(true);
    setTestSuccessMessage(null);

    // Start 5 second countdown to allow them to put the app in the background!
    setTestCountdown(5);
    
    const countdownInterval = setInterval(() => {
      setTestCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownInterval);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    testTimerRef.current = {
      interval: countdownInterval,
      timeout: setTimeout(async () => {
        try {
          const idToken = await user.getIdToken();
          const response = await fetch('/api/users/send-test-push', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              targetToken: registeredToken || undefined
            })
          });

          const result = await response.json();
          if (response.ok && result.success) {
            if (result.isSandboxSimulated) {
              setTestSuccessMessage(
                `🎉 In-App & Browser Alert Triggered!\n\n${result.message}`
              );
            } else {
              setTestSuccessMessage(
                `Success! Test notification dispatched to your active subscription. It should appear on your device shortly!`
              );
            }
          } else {
            let errorDetails = "";
            if (result.errors && Array.isArray(result.errors) && result.errors.length > 0) {
              errorDetails = "\n\nDetails:\n" + result.errors.map((e: any) => `• ${e.errorCode}: ${e.errorMessage}`).join("\n");
            }
            setTestSuccessMessage(
              `Dispatch Notice: ${result.error || result.message || "Failed to dispatch test notification."}${errorDetails}`
            );
          }
        } catch (err: any) {
          console.error("Test push error:", err);
          setTestSuccessMessage(`Failed to send test push: ${err.message || err}`);
        } finally {
          setTestingPush(false);
        }
      }, 5000)
    };
  };

  const handleCancelTest = () => {
    if (testTimerRef.current) {
      clearInterval(testTimerRef.current.interval);
      clearTimeout(testTimerRef.current.timeout);
      testTimerRef.current = null;
    }
    setTestCountdown(null);
    setTestingPush(false);
    setTestSuccessMessage("Test cancelled.");
  };

  // If dismissed or already installed and notifications are active, we don't need to show anything.
  const hasNotificationsActive = notificationPermission === 'granted';
  if (isDismissed && isStandalone && hasNotificationsActive) {
    return null;
  }

  return (
    <div className="bg-[#5a5a40]/5 dark:bg-[#5a5a40]/10 border border-[#5a5a40]/20 rounded-3xl p-5 md:p-6 backdrop-blur-md relative overflow-hidden shadow-sm transition-all duration-300">
      {/* Absolute top decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#5a5a40]/10 rounded-full blur-2xl pointer-events-none" />
      
      <button 
        onClick={handleDismiss} 
        className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-gray-600 transition-all"
        title="Dismiss panel"
      >
        <X size={16} />
      </button>

      <div className="flex flex-col md:flex-row gap-5 items-start">
        {/* Status icon badge */}
        <div className="p-3 bg-[#5a5a40] text-white rounded-2xl shadow-md shrink-0 flex items-center justify-center">
          {isStandalone ? <CheckCircle size={24} /> : <Smartphone size={24} />}
        </div>

        <div className="space-y-3 w-full">
          <div>
            <h3 className="text-lg font-serif font-semibold text-[#1a1a1a] dark:text-[#f5f5f0] flex items-center gap-2">
              {isStandalone ? 'KCFC App Installed' : 'Install KCFC Portal on your Phone'}
              {isStandalone && (
                <span className="text-xs px-2.5 py-0.5 bg-green-500/15 text-green-600 dark:text-green-400 rounded-full font-bold uppercase tracking-wider">
                  Active
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl leading-relaxed">
              {isStandalone 
                ? 'Great! You are running the official portal as a mobile application. To receive instant smartphone notifications when the admin or president broadcasts messages, please make sure notification alerts are active.'
                : 'Turn this web portal into a fast, dedicated app on your iPhone or Android home screen. It takes up no space, starts instantly, and connects you directly to club activities.'}
            </p>
          </div>

          {/* Sub-actions block */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            {/* 1. NOTIFICATION ACTIVATION REQUIREMENT */}
            {notificationPermission !== 'granted' && (
              <button
                onClick={handleEnableNotifications}
                disabled={enablingNotifications}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-sm shrink-0"
              >
                <BellRing size={14} className="animate-bounce" />
                {enablingNotifications ? 'Activating Alerts...' : 'Enable Smartphone Alerts'}
              </button>
            )}

            {/* 2. ANDROID / CHROME INSTALL BUTTON */}
            {!isStandalone && deferredPrompt && (
              <button
                onClick={handleInstallClick}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#5a5a40] hover:bg-[#4d4d36] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-soft"
              >
                <Download size={14} />
                Install App Instantly
              </button>
            )}
          </div>

          {/* 3. APPLE iOS STEP-BY-STEP WORKAROUND */}
          {!isStandalone && isIOS && (
            <div className="mt-4 bg-white/50 dark:bg-black/20 border border-gray-100 dark:border-white/5 rounded-2xl p-4 space-y-3">
              <span className="text-xs font-bold text-[#5a5a40] dark:text-[#d4d4bc] uppercase tracking-wider block">
                iPhone / iPad Installation Steps (Safari):
              </span>
              <ol className="text-xs text-gray-600 dark:text-gray-400 space-y-2">
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#5a5a40]/15 text-[#5a5a40] dark:text-[#d4d4bc] font-bold flex items-center justify-center shrink-0">1</span>
                  <span>Tap the <strong className="font-semibold text-gray-800 dark:text-white inline-flex items-center gap-1">Share <Share size={12} className="inline" /></strong> button (the square icon with an up arrow at the bottom).</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#5a5a40]/15 text-[#5a5a40] dark:text-[#d4d4bc] font-bold flex items-center justify-center shrink-0">2</span>
                  <span>Scroll down and select <strong className="font-semibold text-gray-800 dark:text-white inline-flex items-center gap-1">Add to Home Screen <PlusSquare size={12} className="inline" /></strong>.</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#5a5a40]/15 text-[#5a5a40] dark:text-[#d4d4bc] font-bold flex items-center justify-center shrink-0">3</span>
                  <span>Tap <strong className="font-semibold text-gray-800 dark:text-white">Add</strong> at the top right corner. The icon will appear on your phone's screen!</span>
                </li>
              </ol>
            </div>
          )}

          {/* 4. OTHER DEVICE GUIDE / GENERIC FALLBACK */}
          {!isStandalone && !isIOS && !deferredPrompt && (
            <div className="mt-4 flex items-start gap-2 bg-white/50 dark:bg-black/20 border border-gray-100 dark:border-white/5 rounded-2xl p-3">
              <Info size={14} className="text-gray-400 shrink-0 mt-0.5" />
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                To install on your mobile, open <strong className="text-gray-700 dark:text-white">portal.kcfcjp.com</strong> or your shared link inside <strong className="text-gray-700 dark:text-white">Chrome (Android)</strong> or <strong className="text-gray-700 dark:text-white">Safari (iOS)</strong> directly on your smartphone to activate direct home-screen shortcuts and live push notification support!
              </p>
            </div>
          )}

          {/* Notification diagnostic confirmation and self-testing panel */}
          {hasNotificationsActive && (
            <div className="mt-4 pt-3.5 border-t border-[#5a5a40]/10 dark:border-white/5 space-y-3">
              <p className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-1 font-semibold uppercase tracking-wider">
                <CheckCircle size={10} /> Push Notifications Active on This Device
              </p>
              
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                {testCountdown !== null ? (
                  <button
                    onClick={handleCancelTest}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all"
                  >
                    <X size={12} />
                    Cancel Test (Sending in {testCountdown}s...)
                  </button>
                ) : (
                  <button
                    onClick={handleSendTestPush}
                    disabled={testingPush}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#5a5a40] hover:bg-[#4d4d36] text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all shadow-sm disabled:opacity-50 shrink-0"
                  >
                    <Bell size={12} className={testingPush ? "animate-pulse" : ""} />
                    {testingPush ? "Sending..." : "Test Smartphone Alert"}
                  </button>
                )}
                
                <span className="text-[10px] text-gray-500 dark:text-gray-400 leading-normal max-w-sm">
                  Sends an instant notification to your phone with a <strong>5-second delay</strong> so you can lock your screen or go back to your Home Screen to watch it arrive!
                </span>
              </div>

              {testSuccessMessage && (
                <div className="text-xs p-3 bg-white/70 dark:bg-black/30 border border-[#5a5a40]/10 dark:border-white/5 rounded-xl text-[#5a5a40] dark:text-[#d4d4bc] font-medium leading-relaxed">
                  {testSuccessMessage}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
