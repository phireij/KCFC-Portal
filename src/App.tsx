import React, { createContext, lazy, Suspense, useContext, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged, User, sendEmailVerification } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, query, collection, where, getDocs, updateDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { UserProfile, UserRole } from './types';
import { cn } from './lib/utils';
import { Megaphone, Mail, Bell, Check, X } from 'lucide-react';
import { registerDeviceToken, preloadVapidKeyFromServer, isStandaloneMode, prepareNativeWebPushPrerequisites, observeForegroundMessages } from './lib/fcmClient';

// Route pages are lazy-loaded so members download only the workflow they open.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Login = lazy(() => import('./pages/Login'));
const Polls = lazy(() => import('./pages/Polls'));
const Resources = lazy(() => import('./pages/Resources'));
const Duties = lazy(() => import('./pages/Duties'));
const Admin = lazy(() => import('./pages/Admin'));
const Profile = lazy(() => import('./pages/Profile'));
const Members = lazy(() => import('./pages/Members'));
const Announcements = lazy(() => import('./pages/Announcements'));
const Accounting = lazy(() => import('./pages/Accounting'));
const Inbox = lazy(() => import('./pages/Inbox'));
import Navbar from './components/layout/Navbar';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true });

export const useAuth = () => useContext(AuthContext);

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const authValue = React.useMemo(() => ({ user, profile, loading }), [user, profile, loading]);

  useEffect(() => {
    let unsubscribeProfile = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, async (authenticatedUser) => {
      try {
        setAuthError(null);
        // Clean up previous profile listener if any
        unsubscribeProfile();

        setUser(authenticatedUser);
        if (authenticatedUser) {
          const isBootstrapAdmin = authenticatedUser.email?.toLowerCase() === 'kcfc.jp@gmail.com';
          const emailVerified = authenticatedUser.emailVerified;
          
          const userDocRef = doc(db, 'users', authenticatedUser.uid);

          // Setup real-time listener for the user profile document
          unsubscribeProfile = onSnapshot(userDocRef, async (userDoc) => {
            try {
              if (userDoc.exists()) {
                const currentProfile = userDoc.data() as UserProfile;
                
                // Immediately set the profile state so the user is authenticated on the client-side without lag
                setProfile(currentProfile);

                // Sync email verified state to firestore if it was false/undefined previously.
                // Run this in the background asynchronously so we never block the main authentication flow.
                if ((emailVerified || currentProfile.isVerified) && !currentProfile.isEmailVerified) {
                  updateDoc(userDocRef, {
                    isEmailVerified: true,
                    updatedAt: serverTimestamp()
                  }).catch((err) => {
                    console.warn("Background email verification sync failed:", err);
                  });
                }

                // Sync displayName to firestore if it was missing or default 'Member' previously, but is available on the auth record now.
                if (authenticatedUser.displayName && 
                    (!currentProfile.displayName || currentProfile.displayName === 'Member') && 
                    currentProfile.displayName !== authenticatedUser.displayName) {
                  updateDoc(userDocRef, {
                    displayName: authenticatedUser.displayName,
                    updatedAt: serverTimestamp()
                  }).then(() => {
                    setProfile(prev => prev ? { ...prev, displayName: authenticatedUser.displayName! } : null);
                  }).catch((err) => {
                    console.warn("Background displayName sync failed:", err);
                  });
                }

                // Ensure bootstrap admin is always admin and verified
                if (isBootstrapAdmin) {
                  const currentRoles = currentProfile.roles || [];
                  const hasAdminRole = currentRoles.includes('admin');
                  const isVerified = currentProfile.isVerified === true;
                  const hasDisplayName = !!currentProfile.displayName;

                  if (!hasAdminRole || !isVerified || !hasDisplayName) {
                    const updatedRoles = hasAdminRole ? currentRoles : [...currentRoles, 'admin' as UserRole];
                    const updatedProfile = {
                      ...currentProfile,
                      displayName: currentProfile.displayName || 'ADMIN',
                      roles: updatedRoles,
                      isVerified: true,
                      isEmailVerified: true,
                      updatedAt: new Date().toISOString()
                    };
                    
                    // Optimistically set the profile state
                    setProfile(updatedProfile);

                    // Sync to Firestore in the background
                    setDoc(userDocRef, {
                      ...updatedProfile,
                      updatedAt: serverTimestamp()
                    }, { merge: true }).catch((err) => {
                      console.warn("Background bootstrap admin profile sync failed:", err);
                    });
                  }
                }
              } else {
                // Check if there is an existing pre-registered pending document with this email
                const emailLower = (authenticatedUser.email || '').trim().toLowerCase();
                let migrated = false;

                if (emailLower) {
                  try {
                    const pendingDocId = `pending_${emailLower.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_')}`;
                    const pendingDocRef = doc(db, 'users', pendingDocId);
                    const pendingDocSnap = await getDoc(pendingDocRef);

                    if (pendingDocSnap.exists()) {
                      const pendingData = pendingDocSnap.data();
                      const isBootstrapAdmin = emailLower === 'kcfc.jp@gmail.com';

                      const newProfile: UserProfile = {
                        uid: authenticatedUser.uid,
                        email: emailLower,
                        displayName: pendingData.displayName || authenticatedUser.displayName || 'Member',
                        photoURL: pendingData.photoURL || authenticatedUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(pendingData.displayName || 'Member')}&background=5A5A40&color=fff`,
                        roles: pendingData.roles || (isBootstrapAdmin ? ['admin'] : ['member']),
                        ministries: pendingData.ministries || [],
                        isEmailVerified: isBootstrapAdmin || emailVerified || pendingData.isEmailVerified || true,
                        isVerified: isBootstrapAdmin || pendingData.isVerified || false,
                        isDisabled: pendingData.isDisabled || false,
                        createdAt: pendingData.createdAt || new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                      };

                      // Write to standard UID
                      await setDoc(userDocRef, {
                        ...newProfile,
                        updatedAt: serverTimestamp()
                      });

                      // Delete old pending document
                      await deleteDoc(pendingDocRef);
                      console.log(`Successfully migrated pre-registered pending document ${pendingDocId} to real UID ${authenticatedUser.uid}`);
                      migrated = true;
                    }
                  } catch (migrationErr) {
                    console.error("Failed to migrate pre-registered pending document:", migrationErr);
                  }
                }

                if (!migrated) {
                  // If the user's document does not exist, they might be a newly registered user whose document is being written by Login.tsx.
                  // We give them a 60-second grace period from their authentication creation time, or check if they just logged in.
                  const creationTimeStr = authenticatedUser.metadata.creationTime;
                  const authTime = creationTimeStr ? new Date(creationTimeStr).getTime() : Date.now();
                  const now = Date.now();
                  const isNewUserGrace = (now - authTime) < 60000; // 60 seconds grace period
                  const isJustAuthenticated = sessionStorage.getItem('kcfc_just_authenticated') === 'true';

                  if (isNewUserGrace || isJustAuthenticated) {
                    // Do nothing and let Login.tsx complete the registration write to Firestore.
                    // This prevents any race conditions where App.tsx overwrites Login.tsx with placeholder values.
                    console.log("Newly registered/authenticated user detected. Grace period active; waiting for Login.tsx Firestore write.");
                    
                    const tempProfile: UserProfile = {
                      uid: authenticatedUser.uid,
                      email: authenticatedUser.email || '',
                      displayName: isBootstrapAdmin ? 'ADMIN' : (authenticatedUser.displayName || 'Member'),
                      photoURL: authenticatedUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(authenticatedUser.displayName || 'Member')}&background=5A5A40&color=fff`,
                      roles: isBootstrapAdmin ? ['admin'] : ['member'],
                      ministries: [],
                      isEmailVerified: isBootstrapAdmin || emailVerified || false,
                      isVerified: isBootstrapAdmin,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    };
                    setProfile(tempProfile);
                  } else {
                    // Past grace period, meaning the admin deleted their document from Firestore.
                    // Sign out immediately to prevent recreating the document and clean up the zombie session.
                    console.warn("User document deleted from Firestore. Force signing out zombie session:", authenticatedUser.uid);
                    setProfile(null);
                    auth.signOut().catch((err) => {
                      console.error("Force sign out failed:", err);
                    });
                  }
                }
              }
            } catch (err) {
              console.error("Profile snapshot processing error:", err);
            } finally {
              setLoading(false);
            }
          }, (err) => {
            console.error("Profile snapshot listener error:", err);
            setAuthError(`Database Connection Error: ${err.message || err}. Please ensure your Firebase Firestore database is provisioned and has security rules deployed.`);
            setLoading(false);
          });
        } else {
          setProfile(null);
          setLoading(false);
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeProfile();
    };
  }, []);

  // Poll Deep-linking and automatic redirection
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pollId = params.get('pollId');
    if (pollId && window.location.pathname !== '/duties') {
      sessionStorage.setItem('redirect_poll_id', pollId);
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  // Handle post-authentication redirection to the deep-linked poll
  useEffect(() => {
    const isAuthReady = user && profile && profile.isVerified;
    if (isAuthReady) {
      const redirectPollId = sessionStorage.getItem('redirect_poll_id');
      if (redirectPollId) {
        sessionStorage.removeItem('redirect_poll_id');
        setTimeout(() => {
          window.location.href = `/polls?id=${redirectPollId}`;
        }, 100);
      }
    }
  }, [user, profile]);

  // FCM Push Registration & Foreground Listeners
  const [fcmNotification, setFcmNotification] = useState<{ title: string; body: string } | null>(null);
  const [showPwaNotificationPrompt, setShowPwaNotificationPrompt] = useState(false);
  const [enablingPwaNotifications, setEnablingPwaNotifications] = useState(false);

  // Monitor first-launch standalone (PWA from Home Screen) mode to auto-prompt for notifications
  useEffect(() => {
    if (!user) {
      setShowPwaNotificationPrompt(false);
      return;
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    prepareNativeWebPushPrerequisites().catch((err) => {
      console.warn("PWA: Web Push prerequisite warmup failed:", err);
    });

    try {
      const isStandalone = isStandaloneMode();
      const hasNotification = typeof window !== 'undefined' && 'Notification' in window;
      const isPermissionDefault = hasNotification && Notification.permission === 'default';
      const hasDismissed = localStorage.getItem('kcfc_pwa_notification_prompt_dismissed') === 'true';

      if (isStandalone && isPermissionDefault && !hasDismissed) {
        // Trigger a gentle, highly-polished modal prompt after a small delay on launch
        timer = setTimeout(() => {
          setShowPwaNotificationPrompt(true);
        }, 2000);
      }
    } catch (err) {
      console.warn("FWA: PWA detection failed:", err);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [user]);

  const handleEnablePwaNotifications = async () => {
    if (!user) return;
    try {
      const token = await registerDeviceToken(user.uid, true);
      if (token) {
        localStorage.setItem('kcfc_registered_fcm_token', token);
        localStorage.setItem('kcfc_pwa_notification_prompt_dismissed', 'true');
        setShowPwaNotificationPrompt(false);
      } else if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted') {
        localStorage.setItem('kcfc_pwa_notification_prompt_dismissed', 'true');
        setShowPwaNotificationPrompt(false);
      }
    } catch (err) {
      console.warn("PWA prompt: failed to enable notifications:", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setShowPwaNotificationPrompt(false);
      alert(
        "Smartphone alerts were not fully activated.\n\n" +
        "Your iPhone allowed notification permission, but the app could not complete the required background Web Push subscription.\n\n" +
        `Technical detail: ${errMsg}\n\n` +
        "Please open the install/alerts panel and tap Enable Smartphone Alerts again."
      );
    } finally {
      setEnablingPwaNotifications(false);
    }
  };

  const handleDismissPwaNotifications = () => {
    setShowPwaNotificationPrompt(false);
    localStorage.setItem('kcfc_pwa_notification_prompt_dismissed', 'true');
  };

  useEffect(() => {
    if (!user) return;

    let activeCleanup: (() => void) | null = null;

    const initializeForegroundMessaging = async () => {
      // 1. Preload public VAPID key from backend to guarantee zero network latency during direct clicks
      await preloadVapidKeyFromServer();

      // 2. Attempt token registration. If permission is already granted, update silently.
      const hasNotification = typeof window !== 'undefined' && 'Notification' in window;
      if (hasNotification && Notification.permission === 'granted') {
        try {
          await registerDeviceToken(user.uid, false);
        } catch (e) {
          console.warn("Auto-registering device token failed silently on load:", e);
          if (isStandaloneMode()) {
            setShowPwaNotificationPrompt(true);
          }
        }
      }

      // 3. Setup active window listener for push alerts
      const unsubscribeMessages = await observeForegroundMessages((payload) => {
        const title = payload.notification?.title || 'Notification';
        const body = payload.notification?.body || '';
        setFcmNotification({ title, body });
      });

      if (unsubscribeMessages) {
        activeCleanup = unsubscribeMessages;
      }
    };

    initializeForegroundMessaging().catch(err => {
      console.warn("FCM: Client initialization deferred or unsupported in this sandboxed frame:", err);
    });

    return () => {
      if (activeCleanup) {
        activeCleanup();
      }
    };
  }, [user]);

  // Real-time Firestore notification document listener to display live popups & trigger native Web Notifications
  useEffect(() => {
    if (!user) return;

    const mountTime = Date.now();
    let isFirst = true;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('status', '==', 'unread')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // If it's the very first snapshot (on mount), we just read the state but do not show banners
      if (isFirst) {
        isFirst = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const title = data.title || 'New Portal Alert';
          const body = data.message || '';
          
          // Verify that this notification was created after the listener was mounted
          const createdTime = data.createdAt?.toMillis 
            ? data.createdAt.toMillis() 
            : (data.createdAt ? new Date(data.createdAt).getTime() : Date.now());
          
          // Give 5 seconds grace period from mount time to avoid race conditions on first load
          if (createdTime > mountTime - 5000) {
            // 1. Pop up in-app notification card
            setFcmNotification({ title, body });

            // 2. Trigger native browser Web Notification if permission is granted
            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
              try {
                new Notification(title, {
                  body: body,
                  icon: '/favicon.ico',
                  badge: '/favicon.ico'
                });
              } catch (err) {
                console.warn("FCM Fallback: Native Notification constructor failed inside iframe:", err);
                if (navigator.serviceWorker && navigator.serviceWorker.ready) {
                  navigator.serviceWorker.ready.then((reg) => {
                    reg.showNotification(title, {
                      body: body,
                      icon: '/favicon.ico'
                    }).catch(swErr => {
                      console.warn("FCM Fallback: Service worker showNotification failed:", swErr);
                    });
                  });
                }
              }
            }
          }
        }
      });
    }, (error) => {
      console.warn("FCM Fallback: Error listening to Firestore notifications:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Real-time listener for incoming public contact messages (for Admin / President)
  const [newMessageNotification, setNewMessageNotification] = useState<{ id: string; name: string; email: string; message: string } | null>(null);

  useEffect(() => {
    if (!user || !profile) return;
    
    const isMessageManager = (profile.roles || []).some(r => ['admin', 'president'].includes(r));
    if (!isMessageManager) return;

    // Capture the exact initialization time. We only alert on new documents created after mounting.
    const listenerMountTime = Date.now();

    const messagesQuery = query(
      collection(db, 'messages')
    );

    const sendEmailAlert = async (msgId: string, msgData: any) => {
      try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/admin/send-message-alert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            messageId: msgId,
            name: msgData.name || 'Visitor',
            email: msgData.email || 'No email provided',
            message: msgData.message || '',
            subject: msgData.subject || '',
            createdAt: msgData.createdAt?.toDate ? msgData.createdAt.toDate().toUTCString() : (msgData.createdAt || new Date().toUTCString())
          })
        });

        if (response.ok) {
          // Update the Firestore document to mark alertSent as true, so it won't trigger again
          await updateDoc(doc(db, 'messages', msgId), {
            alertSent: true
          });
          console.log(`[SUCCESS] Email alert dispatched and alertSent marked for message ${msgId}`);
        } else {
          console.error('[ERROR] Failed triggering email alert on server:', await response.text());
        }
      } catch (err) {
        console.error('[ERROR] sendEmailAlert failed:', err);
      }
    };

    const playNotificationChime = () => {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const now = audioCtx.currentTime;
        
        // Low note (C5)
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(523.25, now);
        gain1.gain.setValueAtTime(0.12, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.start(now);
        osc1.stop(now + 0.35);

        // High note (E5)
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(659.25, now + 0.12);
        gain2.gain.setValueAtTime(0.12, now + 0.12);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.start(now + 0.12);
        osc2.stop(now + 0.55);
      } catch (err) {
        console.warn("Audio chime block or unsupported in sandbox context:", err);
      }
    };

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const status = data.status || 'unread';

          if (status === 'unread') {
            let messageTimeMs = Date.now();
            if (data.createdAt) {
              if (typeof data.createdAt === 'string') {
                messageTimeMs = Date.parse(data.createdAt);
              } else if (data.createdAt.seconds) {
                messageTimeMs = data.createdAt.seconds * 1000;
              } else if (typeof data.createdAt === 'number') {
                messageTimeMs = data.createdAt;
              } else if (typeof data.createdAt.toDate === 'function') {
                messageTimeMs = data.createdAt.toDate().getTime();
              }
            }

            // Automatically send an email notification if it has not been dispatched yet (only for newly arrived messages)
            if (data.alertSent !== true && messageTimeMs > listenerMountTime - 4000) {
              sendEmailAlert(change.doc.id, data);
            }

            // Trigger a slide-in alert and chime only if the message is actually newly received after mount
            if (messageTimeMs > listenerMountTime - 4000) {
              playNotificationChime();
              setNewMessageNotification({
                id: change.doc.id,
                name: data.name || 'Visitor',
                email: data.email || 'No email provided',
                message: data.message || '',
              });
            }
          }
        }
      });
    }, (err) => {
      console.error("Error listening to public website messages:", err);
    });

    return () => {
      unsubscribe();
    };
  }, [user, profile]);

  const isDarkMode = profile?.preferences?.darkMode === true;
  const fontSize = profile?.preferences?.fontSize || 'normal';

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    document.documentElement.classList.remove('font-size-small', 'font-size-normal', 'font-size-medium', 'font-size-big');
    document.documentElement.classList.add(`font-size-${fontSize}`);
  }, [fontSize]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0]">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 bg-[#5A5A40] rounded-full mb-4"></div>
          <div className="h-4 w-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Database Connection Error View
  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0] p-4 text-center">
        <div className="max-w-md bg-white p-12 rounded-[32px] shadow-xl space-y-6">
          <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h1 className="text-2xl font-serif text-red-600">Database Connection Failed</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            We are unable to load your profile because of a database connection error:
          </p>
          <div className="bg-red-50 text-red-700 p-4 rounded-xl text-xs font-mono break-all text-left">
            {authError}
          </div>
          <p className="text-xs text-gray-400">
            If you are the administrator, please ensure Firestore is provisioned in your Firebase console and security rules are fully deployed.
          </p>
          <div className="pt-4 flex flex-col gap-3">
            <button 
              onClick={() => {
                setAuthError(null);
                window.location.reload();
              }}
              className="w-full py-4 bg-[#5A5A40] text-white rounded-full font-bold uppercase tracking-widest text-xs shadow-sm hover:shadow-lg transition-all cursor-pointer"
            >
              Retry Connection
            </button>
            <button 
              onClick={() => {
                setAuthError(null);
                auth.signOut();
              }}
              className="text-gray-400 font-bold uppercase tracking-widest text-[10px] hover:underline cursor-pointer"
            >
              Sign Out & Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Disabled Account View
  if (user && profile && profile.isDisabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0] p-4 text-center">
        <div className="max-w-md bg-white p-12 rounded-[32px] shadow-xl space-y-6">
          <div className="w-20 h-20 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </div>
          <h1 className="text-2xl font-serif">Account Disabled</h1>
          <p className="text-gray-500 leading-relaxed text-sm">Hello {profile.displayName}, your registration has been disabled by an administrator. Please contact your coordinator to restore access.</p>
          <button 
            onClick={() => auth.signOut()}
            className="text-[#5A5A40] font-bold uppercase tracking-widest text-xs hover:underline cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Email Verification Holding State
  const isRegistering = sessionStorage.getItem('kcfc_registration_in_progress') === 'true';
  if (user && !user.emailVerified && profile && !profile.isEmailVerified && !profile.isVerified && !isRegistering) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0] p-4 text-center">
        <div className="max-w-md bg-white p-12 rounded-[32px] shadow-xl space-y-6">
          <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          </div>
          <h1 className="text-2xl font-serif">Verify Your Email</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Welcome to the KCFC Portal! We have sent an email verification link to <strong className="text-[#5A5A40]">{user.email}</strong>. Please check your inbox (and spam folder) and verify your email.
          </p>
          <p className="text-xs text-amber-600 font-bold">
            Note: Once verified, your account will be visible to administrator coordinators for approval.
          </p>
          <div className="pt-4 flex flex-col gap-3">
            <button 
              onClick={async () => {
                try {
                  await user.reload();
                  if (user.emailVerified) {
                    const userDocRef = doc(db, 'users', user.uid);
                    await updateDoc(userDocRef, {
                      isEmailVerified: true,
                      updatedAt: serverTimestamp()
                    });
                    window.location.reload();
                  } else {
                    alert("Email not verified yet. Please click the link we sent to your email and try again.");
                  }
                } catch (e: any) {
                  alert(e.message || "Something went wrong.");
                }
              }}
              className="w-full py-4 bg-[#5A5A40] text-white rounded-full font-bold uppercase tracking-widest text-xs shadow-sm hover:shadow-lg transition-all cursor-pointer"
            >
              I Have Verified My Email
            </button>
            <button 
              onClick={async () => {
                try {
                  await sendEmailVerification(user);
                  alert("Verification email resent! Please check your inbox.");
                } catch (e: any) {
                  alert("Error resending email: " + e.message);
                }
              }}
              className="text-[#5A5A40] font-bold uppercase tracking-widest text-[10px] hover:underline pt-2 cursor-pointer"
            >
              Resend Verification Email
            </button>
            <button 
              onClick={() => {
                sessionStorage.removeItem('kcfc_registration_in_progress');
                auth.signOut();
              }}
              className="text-gray-400 font-bold uppercase tracking-widest text-[10px] hover:underline cursor-pointer"
            >
              Sign Out & Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Pending Approval View
  if (user && profile && !profile.isVerified && !isRegistering) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0] p-4 text-center">
        <div className="max-w-md bg-white p-12 rounded-[32px] shadow-xl">
          <div className="w-20 h-20 bg-yellow-50 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <h1 className="text-2xl font-serif mb-4">Membership Pending</h1>
          <p className="text-gray-500 mb-8">Hello {profile.displayName}, your registration has been received. An administrator needs to approve your membership before you can access the community portal.</p>
          <button 
            onClick={() => {
              sessionStorage.removeItem('kcfc_registration_in_progress');
              auth.signOut();
            }}
            className="text-[#5A5A40] font-bold uppercase tracking-widest text-xs hover:underline cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const isAuthReady = user && profile && profile.isVerified;

  return (
    <AuthContext.Provider value={authValue}>
      <Router>
        <ScrollToTop />
        <div className={cn(
          "min-h-screen transition-all duration-300",
          isDarkMode 
            ? "dark bg-[#141411] text-[#f5f5f0]" 
            : "bg-[#f5f5f0] text-[#1a1a1a]"
        )}>
          {isAuthReady && <Navbar />}
          <main className={cn("min-h-screen", isAuthReady ? "pt-20 pb-24 md:pb-8 px-2 sm:px-4" : "")}>
            <Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center text-sm text-slate-500">Loading KCFC Portal…</div>}>
              <Routes>
              <Route path="/login" element={!isAuthReady ? <Login /> : <Navigate to="/" replace />} />
              <Route path="/" element={isAuthReady ? <Dashboard /> : <Navigate to="/login" />} />
              <Route path="/polls" element={isAuthReady ? <Polls /> : <Navigate to="/login" />} />
              <Route path="/duties" element={isAuthReady ? <Duties /> : <Navigate to="/login" />} />
              <Route path="/resources" element={isAuthReady ? <Resources /> : <Navigate to="/login" />} />
              <Route path="/admin" element={isAuthReady && ((profile?.roles || []).some(r => ['admin', 'president', 'vice_president', 'secretary', 'auditor'].includes(r))) ? <Admin /> : <Navigate to="/" />} />
              <Route path="/members" element={isAuthReady ? <Members /> : <Navigate to="/login" />} />
              <Route path="/announcements" element={isAuthReady ? <Announcements /> : <Navigate to="/login" />} />
              <Route path="/accounting" element={isAuthReady && ((profile?.roles || []).some(r => ['admin', 'president', 'treasurer'].includes(r))) ? <Accounting /> : <Navigate to="/" />} />
              <Route path="/profile" element={isAuthReady ? <Profile /> : <Navigate to="/login" />} />
              <Route path="/inbox" element={isAuthReady ? <Inbox /> : <Navigate to="/login" />} />
              {/* Fallback for deep-linking unmatched routes or /index.html pathing */}
              <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </main>

          {/* Visual FCM Foreground Notification Banner */}
          {fcmNotification && (
            <div 
              id="fcm-notification-banner"
              className="fixed bottom-6 right-6 z-50 max-w-sm w-[90%] sm:w-full bg-white/80 dark:bg-[#11110f]/85 p-5 rounded-2xl border border-gray-200 dark:border-white/10 backdrop-blur-xl shadow-2xl flex gap-4 overflow-hidden"
              style={{ animation: 'bounce 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-[#5A5A40]" />
              <div className="p-2.5 bg-[#5A5A40]/10 rounded-xl h-fit">
                <Megaphone className="w-5 h-5 text-[#5A5A40]" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex justify-between items-start">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">{fcmNotification.title}</h4>
                  <button 
                    onClick={() => setFcmNotification(null)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-semibold">{fcmNotification.body}</p>
                <div className="pt-2 flex justify-end">
                  <button 
                    onClick={() => {
                      setFcmNotification(null);
                      window.location.hash = "/announcements";
                    }}
                    className="text-[9px] font-bold text-[#5A5A40] dark:text-[#8a8a65] uppercase tracking-widest hover:underline cursor-pointer"
                  >
                    View Announcements →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Real-time Website Inquiry / Message Notification Banner */}
          {newMessageNotification && (
            <div 
              id="new-message-notification-banner"
              className="fixed top-20 right-6 z-50 max-w-sm w-[90%] sm:w-full bg-white/95 dark:bg-[#11110f]/95 p-5 rounded-2xl border border-amber-500/20 dark:border-amber-500/35 backdrop-blur-xl shadow-2xl flex gap-4 overflow-hidden"
              style={{ animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
            >
              <style>{`
                @keyframes slideIn {
                  from { transform: translateX(100%); opacity: 0; }
                  to { transform: translateX(0); opacity: 1; }
                }
              `}</style>
              <div className="absolute inset-x-0 top-0 h-1 bg-amber-500 animate-pulse" />
              <div className="p-2.5 bg-amber-500/10 rounded-xl h-fit text-amber-600 dark:text-amber-400">
                <Mail className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded-full">New Web Message</span>
                  <button 
                    onClick={() => setNewMessageNotification(null)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-950 dark:text-white">{newMessageNotification.name}</h4>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono select-all">{newMessageNotification.email}</p>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-medium line-clamp-2 italic bg-gray-50 dark:bg-white/5 p-2 rounded-lg border border-gray-100 dark:border-white/5">
                  "{newMessageNotification.message}"
                </p>
                <div className="pt-2 flex gap-3 justify-end items-center">
                  <button 
                    onClick={async () => {
                      try {
                        await updateDoc(doc(db, 'messages', newMessageNotification.id), {
                          status: 'read'
                        });
                        setNewMessageNotification(null);
                      } catch (err) {
                        console.error("Error marking as read directly from toast:", err);
                      }
                    }}
                    className="flex items-center gap-1 text-[9px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest hover:text-green-600 dark:hover:text-green-400 transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" /> Mark Read
                  </button>
                  <button 
                    onClick={() => {
                      setNewMessageNotification(null);
                      window.location.href = "/admin#messages-inbox-section";
                    }}
                    className="text-[9px] font-extrabold text-[#5A5A40] dark:text-[#8a8a65] uppercase tracking-widest bg-[#5A5A40]/10 dark:bg-[#8a8a65]/10 px-2.5 py-1.5 rounded-lg hover:bg-[#5A5A40]/20 dark:hover:bg-[#8a8a65]/25 transition-all cursor-pointer"
                  >
                    Open Inbox &rarr;
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Home-screen/Standalone Auto-Prompting Glassmorphic Modal */}
          {showPwaNotificationPrompt && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity duration-300 animate-fade-in">
              <div className="w-full max-w-sm bg-[#fafafa]/90 dark:bg-[#121210]/95 backdrop-blur-xl rounded-2xl p-6 shadow-2xl border border-gray-200/50 dark:border-white/10 text-center flex flex-col items-center">
                <div className="p-3 bg-[#5A5A40]/10 text-[#5A5A40] rounded-full mb-4">
                  <Bell className="w-8 h-8 animate-pulse" />
                </div>
                <h3 className="font-serif font-bold text-lg text-gray-900 dark:text-gray-50 mb-2">
                  Enable Smartphone Alerts
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                  Stay updated with real-time duties, committee announcements, and church events directly on your lock screen.
                </p>
                <div className="flex flex-col gap-2 w-full">
                  <button
                    onClick={handleEnablePwaNotifications}
                    disabled={enablingPwaNotifications}
                    className="w-full py-2.5 px-4 bg-[#5a5a40] hover:bg-[#484833] text-white rounded-xl text-xs font-semibold shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {enablingPwaNotifications ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      "Enable Alerts Now"
                    )}
                  </button>
                  <button
                    onClick={handleDismissPwaNotifications}
                    className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl text-xs font-medium transition-all cursor-pointer"
                  >
                    Maybe Later
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Router>
    </AuthContext.Provider>
  );
}
