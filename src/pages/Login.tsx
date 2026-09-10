import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  User,
  UsersRound,
} from 'lucide-react';
import { auth, db, googleProvider } from '../lib/firebase';
import { Logo } from '../components/ui/Logo';
import { cn } from '../lib/utils';

const avatarUrl = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'KCFC')}&background=123B66&color=fff`;

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isInIframe] = useState(() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  });

  const migrateOrCreateGoogleProfile = async (uid: string, accountEmail: string, displayName: string, photoURL?: string | null, emailVerified?: boolean) => {
    const userDocRef = doc(db, 'users', uid);
    const existing = await getDoc(userDocRef);
    if (existing.exists()) return;

    const emailLower = accountEmail.trim().toLowerCase();
    const isBootstrapAdmin = emailLower === 'kcfc.jp@gmail.com';
    let pendingData: Record<string, any> | null = null;
    let pendingDocId: string | null = null;

    if (emailLower) {
      const candidateId = `pending_${emailLower.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_')}`;
      try {
        const pendingSnapshot = await getDoc(doc(db, 'users', candidateId));
        if (pendingSnapshot.exists()) {
          pendingData = pendingSnapshot.data();
          pendingDocId = candidateId;
        }
      } catch (pendingError) {
        console.error('Login: failed to check pending pre-registration', pendingError);
      }
    }

    if (pendingData) {
      await setDoc(userDocRef, {
        uid,
        email: emailLower,
        displayName: pendingData.displayName || displayName || 'Member',
        photoURL: pendingData.photoURL || photoURL || avatarUrl(pendingData.displayName || displayName || 'Member'),
        roles: pendingData.roles || (isBootstrapAdmin ? ['admin'] : ['member']),
        ministries: pendingData.ministries || [],
        isEmailVerified: isBootstrapAdmin || emailVerified || pendingData.isEmailVerified || true,
        isVerified: isBootstrapAdmin || pendingData.isVerified || false,
        isDisabled: pendingData.isDisabled || false,
        createdAt: pendingData.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (pendingDocId) await deleteDoc(doc(db, 'users', pendingDocId));
      return;
    }

    await setDoc(userDocRef, {
      uid,
      email: emailLower,
      displayName: isBootstrapAdmin ? 'ADMIN' : (displayName || 'Member'),
      photoURL: photoURL || avatarUrl(displayName || 'Member'),
      roles: isBootstrapAdmin ? ['admin'] : ['member'],
      ministries: [],
      isEmailVerified: isBootstrapAdmin || emailVerified || true,
      isVerified: isBootstrapAdmin,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      sessionStorage.setItem('kcfc_just_authenticated', 'true');
      if (result.user) {
        await migrateOrCreateGoogleProfile(
          result.user.uid,
          result.user.email || '',
          result.user.displayName || 'Member',
          result.user.photoURL,
          result.user.emailVerified,
        );
      }
    } catch (e: any) {
      console.error('Google sign-in failed', e);
      let readableError = 'Google Sign-In failed.';
      if (e.code === 'auth/popup-closed-by-user') {
        readableError = 'The Google sign-in window was closed before sign-in finished. Please try again or use email and password.';
      } else if (e.code === 'auth/popup-blocked') {
        readableError = 'Your browser blocked the Google sign-in window. Allow popups for this site or use email and password.';
      } else if (e.code === 'auth/unauthorized-domain') {
        readableError = 'This domain is not authorized for Google Sign-In. Please contact the KCFC administrator.';
      } else if (e.message) {
        readableError = e.message;
      }
      setError(readableError);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuthSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    if (isSignUp && !name.trim()) {
      setError('Please enter your full name for registration.');
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (!isSignUp) {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        sessionStorage.setItem('kcfc_just_authenticated', 'true');
        return;
      }

      sessionStorage.setItem('kcfc_registration_in_progress', 'true');
      sessionStorage.setItem('kcfc_just_authenticated', 'true');
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: name.trim() });

      const userDocRef = doc(db, 'users', cred.user.uid);
      const emailLower = (cred.user.email || '').trim().toLowerCase();
      const isBootstrapAdmin = emailLower === 'kcfc.jp@gmail.com';
      let pendingData: Record<string, any> | null = null;
      let pendingDocId: string | null = null;

      if (emailLower) {
        const candidateId = `pending_${emailLower.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_')}`;
        try {
          const pendingSnapshot = await getDoc(doc(db, 'users', candidateId));
          if (pendingSnapshot.exists()) {
            pendingData = pendingSnapshot.data();
            pendingDocId = candidateId;
          }
        } catch (pendingError) {
          console.error('Registration: failed to check pending pre-registration', pendingError);
        }
      }

      if (pendingData) {
        await setDoc(userDocRef, {
          uid: cred.user.uid,
          email: emailLower,
          displayName: pendingData.displayName || name.trim(),
          photoURL: pendingData.photoURL || avatarUrl(name.trim()),
          roles: pendingData.roles || (isBootstrapAdmin ? ['admin'] : ['member']),
          ministries: pendingData.ministries || [],
          isEmailVerified: isBootstrapAdmin || pendingData.isEmailVerified || false,
          isVerified: isBootstrapAdmin || pendingData.isVerified || false,
          isDisabled: pendingData.isDisabled || false,
          createdAt: pendingData.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        if (pendingDocId) await deleteDoc(doc(db, 'users', pendingDocId));
      } else {
        await setDoc(userDocRef, {
          uid: cred.user.uid,
          email: cred.user.email || '',
          displayName: isBootstrapAdmin ? 'ADMIN' : name.trim(),
          photoURL: avatarUrl(name.trim()),
          roles: isBootstrapAdmin ? ['admin'] : ['member'],
          ministries: [],
          isEmailVerified: isBootstrapAdmin || false,
          isVerified: isBootstrapAdmin,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      try {
        const idToken = await cred.user.getIdToken();
        const response = await fetch('/api/auth/send-verification', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ displayName: name.trim() }),
        });
        const result = await response.json();
        if (result.success && result.sent) {
          setSuccessMsg('Registration successful. A verification email has been sent. Please check your inbox and spam folder.');
        } else if (result.success && result.verificationLink) {
          await sendEmailVerification(cred.user);
          setSuccessMsg('Registration successful. A verification email has been sent through Firebase.');
        } else {
          throw new Error(result.error || 'Server verification email dispatch failed.');
        }
      } catch (mailError) {
        console.warn('Registration verification fallback used', mailError);
        await sendEmailVerification(cred.user);
        setSuccessMsg('Registration successful. A verification email has been sent.');
      }
    } catch (e: any) {
      console.error('Authentication error', e);
      let readableError = e.message || 'Authentication failed.';
      if (e.code === 'auth/email-already-in-use') readableError = 'This email is already registered. Please sign in instead.';
      if (['auth/wrong-password', 'auth/user-not-found', 'auth/invalid-credential'].includes(e.code)) readableError = 'Invalid email or password. Please try again.';
      if (e.code === 'auth/weak-password') readableError = 'Password should be at least 6 characters.';
      setError(readableError);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      setError('Enter your email address to receive a password reset link.');
      return;
    }
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSuccessMsg('Password reset link sent. Please check your email.');
      setIsResetting(false);
    } catch (e: any) {
      console.error('Password reset error', e);
      let readableError = e.message || 'Password reset failed.';
      if (e.code === 'auth/user-not-found') readableError = 'No registered user was found with this email address.';
      if (e.code === 'auth/invalid-email') readableError = 'Please enter a valid email address.';
      setError(readableError);
    } finally {
      setLoading(false);
    }
  };

  const setMode = (signUp: boolean) => {
    setIsSignUp(signUp);
    setIsResetting(false);
    setError(null);
    setSuccessMsg(null);
  };

  return (
    <main className="min-h-screen bg-[#F7F9FC] text-[#172033] dark:bg-[#081522] dark:text-white">
      <div className="mx-auto grid min-h-screen max-w-[1440px] lg:grid-cols-[1.05fr_.95fr]">
        <section className="relative hidden overflow-hidden bg-gradient-to-br from-[#0E3157] via-[#123B66] to-[#2563EB] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div className="absolute -right-24 top-16 h-72 w-72 rounded-full border border-white/10" />
          <div className="absolute -right-2 top-40 h-40 w-40 rounded-full border border-white/10" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15"><Logo className="h-8 w-8" /></div>
            <div><p className="text-[18px] font-extrabold tracking-tight">KCFC Portal</p><p className="text-[12px] text-blue-100">Koiwa Church Filipino Community</p></div>
          </div>

          <div className="relative z-10 max-w-xl py-12">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-blue-200">Faith • Service • Community</p>
            <h1 className="mt-4 text-[44px] font-extrabold leading-[1.06] tracking-[-0.04em] xl:text-[54px]">Your KCFC community, easier to stay connected with.</h1>
            <p className="mt-5 max-w-lg text-[16px] leading-7 text-blue-50/85">See your ministry schedule, respond to availability requests, read important updates and keep KCFC messages in one reliable place.</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <Feature icon={Smartphone} title="Mobile first" body="Built for phones and tablets." />
              <Feature icon={UsersRound} title="Community" body="Member tools in one place." />
              <Feature icon={ShieldCheck} title="Private" body="Role-aware member access." />
            </div>
          </div>

          <p className="relative z-10 text-[11px] text-blue-100/75">Existing KCFC members keep the same account and member record.</p>
        </section>

        <section className="flex items-center justify-center px-4 py-8 sm:px-8 lg:px-10 xl:px-16">
          <div className="w-full max-w-[520px]">
            <div className="mb-7 flex items-center gap-3 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#123B66] text-white"><Logo className="h-7 w-7" /></div>
              <div><p className="text-[17px] font-extrabold tracking-tight text-[#172033] dark:text-white">KCFC Portal</p><p className="text-[11px] text-slate-500 dark:text-slate-400">Koiwa Church Filipino Community</p></div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(18,59,102,0.10)] sm:p-7 dark:border-white/10 dark:bg-[#0D1B2A]">
              {successMsg ? (
                <div className="py-3 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300"><CheckCircle2 className="h-7 w-7" /></div>
                  <h2 className="mt-4 text-[22px] font-extrabold tracking-tight">Check your email</h2>
                  <p className="mx-auto mt-2 max-w-sm text-[13px] leading-6 text-slate-500 dark:text-slate-400">{successMsg}</p>
                  <button
                    type="button"
                    onClick={() => {
                      sessionStorage.removeItem('kcfc_registration_in_progress');
                      window.location.reload();
                    }}
                    className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#123B66] px-4 text-[13px] font-bold text-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    Continue <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#2563EB]">{isResetting ? 'Account recovery' : isSignUp ? 'Join KCFC Portal' : 'Welcome back'}</p>
                    <h2 className="mt-1 text-[28px] font-extrabold tracking-[-0.03em] text-[#172033] dark:text-white">{isResetting ? 'Reset your password' : isSignUp ? 'Create your account' : 'Sign in to KCFC'}</h2>
                    <p className="mt-2 text-[13px] leading-5 text-slate-500 dark:text-slate-400">{isResetting ? 'We’ll email you a secure password-reset link.' : isSignUp ? 'Use the name KCFC coordinators know you by so approval is easy.' : 'Open your schedule, Inbox, community updates and member tools.'}</p>
                  </div>

                  {!isResetting && (
                    <div className="mt-5 grid grid-cols-2 gap-1 rounded-2xl bg-[#F7F9FC] p-1 dark:bg-white/5">
                      <button type="button" onClick={() => setMode(false)} className={cn('min-h-11 rounded-xl text-[12px] font-bold transition-colors', !isSignUp ? 'bg-white text-[#123B66] shadow-sm dark:bg-[#123B66] dark:text-white' : 'text-slate-500 dark:text-slate-400')}>Sign in</button>
                      <button type="button" onClick={() => setMode(true)} className={cn('min-h-11 rounded-xl text-[12px] font-bold transition-colors', isSignUp ? 'bg-white text-[#123B66] shadow-sm dark:bg-[#123B66] dark:text-white' : 'text-slate-500 dark:text-slate-400')}>Create account</button>
                    </div>
                  )}

                  {error && <div role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] leading-5 text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300">{error}</div>}

                  <form onSubmit={isResetting ? handlePasswordReset : handleEmailAuthSubmit} className="mt-5 space-y-4">
                    {isSignUp && !isResetting && <Field label="Full name" icon={User}><input autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" className="kcfc-input pl-11" /></Field>}
                    <Field label="Email address" icon={Mail}><input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className="kcfc-input pl-11" /></Field>
                    {!isResetting && (
                      <Field label="Password" icon={Lock}>
                        <input type={showPassword ? 'text' : 'password'} autoComplete={isSignUp ? 'new-password' : 'current-password'} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="kcfc-input pl-11 pr-12" />
                        <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-[34px] flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-white/5">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                      </Field>
                    )}

                    {!isSignUp && !isResetting && <div className="flex justify-end"><button type="button" onClick={() => { setIsResetting(true); setError(null); setSuccessMsg(null); }} className="min-h-9 rounded-lg px-2 text-[11px] font-bold text-[#2563EB] hover:bg-blue-50 dark:hover:bg-blue-500/10">Forgot password?</button></div>}

                    <button type="submit" disabled={loading} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#123B66] px-4 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-[#0E3157] disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                      {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : isResetting ? <KeyRound className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                      {loading ? 'Please wait…' : isResetting ? 'Send reset link' : isSignUp ? 'Create account' : 'Sign in'}
                    </button>

                    {isResetting && <button type="button" onClick={() => { setIsResetting(false); setError(null); setSuccessMsg(null); }} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-200 px-4 text-[12px] font-bold text-slate-600 dark:border-white/10 dark:text-slate-300">Back to sign in</button>}
                  </form>

                  {!isResetting && (
                    <>
                      <div className="my-5 flex items-center gap-3"><div className="h-px flex-1 bg-slate-200 dark:bg-white/10" /><span className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">or</span><div className="h-px flex-1 bg-slate-200 dark:bg-white/10" /></div>
                      <button type="button" onClick={handleGoogleLogin} disabled={loading} className="inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 text-[12px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-55 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-extrabold text-[#4285F4]">G</span>Continue with Google</button>
                      {isInIframe && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-center text-[10px] leading-4 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">Google sign-in may be blocked inside an embedded preview. Open the Portal in a normal browser tab or use email/password.</p>}
                    </>
                  )}

                  <div className="mt-5 flex items-start gap-2 rounded-2xl bg-[#EAF3FF] p-3 dark:bg-blue-500/10">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" />
                    <p className="text-[10px] leading-4 text-slate-600 dark:text-slate-300">KCFC member access is role-aware. New registrations may need coordinator verification before member-only tools become available.</p>
                  </div>
                </>
              )}
            </div>

            <p className="mt-5 text-center text-[10px] leading-4 text-slate-400">KCFC Portal • Membership & Community Management</p>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <label className="relative block space-y-1.5">
      <span className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">{label}</span>
      <Icon className="pointer-events-none absolute left-3.5 top-[35px] h-4 w-4 text-slate-400" />
      {children}
    </label>
  );
}

function Feature({ icon: Icon, title, body }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10 backdrop-blur-sm">
      <Icon className="h-5 w-5 text-blue-100" />
      <p className="mt-3 text-[13px] font-extrabold">{title}</p>
      <p className="mt-1 text-[11px] leading-4 text-blue-100/80">{body}</p>
    </div>
  );
}
