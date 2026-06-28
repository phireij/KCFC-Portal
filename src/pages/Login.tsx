import React, { useState } from 'react';
import { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, Mail, Lock, User, ArrowRight, RefreshCw, Key, Eye, EyeOff } from 'lucide-react';
import { Logo } from '../components/ui/Logo';

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const saveRememberMeState = () => {
    localStorage.setItem('kcfc_remember_me', rememberMe ? 'true' : 'false');
    if (rememberMe) {
      localStorage.setItem('kcfc_login_timestamp', Date.now().toString());
    } else {
      localStorage.removeItem('kcfc_login_timestamp');
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      saveRememberMeState();
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      console.error("Login failed", e);
      let readableError = "Google Sign-In failed.";
      if (e.code === 'auth/popup-closed-by-user') {
        readableError = "The Google sign-in window was closed before completing. If you are viewing this inside the AI Studio preview window, please click the 'Open in New Tab' icon at the top right of the preview panel to log in, or use your Email and Password.";
      } else if (e.code === 'auth/popup-blocked') {
        readableError = "The Google sign-in window was blocked by your browser. Please allow popups for this site, click the 'Open in New Tab' icon at the top right of the preview panel, or use your Email and Password.";
      } else if (e.code === 'auth/unauthorized-domain') {
        readableError = "This domain is not authorized for Firebase Google Sign-In. Please ensure 'kcfcjp.com' and 'portal.kcfcjp.com' are added to Authorized Domains under Authentication -> Settings in your Firebase Console.";
      } else if (e.message) {
        readableError = e.message;
      }
      setError(readableError);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all email and password fields.");
      return;
    }
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      saveRememberMeState();
      if (isSignUp) {
        if (!name) {
          setError("Please provide your name for registration.");
          setLoading(false);
          return;
        }
        // 1. Create User
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        // 2. Set Profile Display Name
        await updateProfile(cred.user, {
          displayName: name.trim()
        });
        
        // 3. Send Verification Email (Attempt server SMTP dispatch, with fallback to standard Firebase Client email)
        try {
          const idToken = await cred.user.getIdToken();
          const response = await fetch('/api/auth/send-verification', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              displayName: name.trim()
            })
          });

          const result = await response.json();
          if (result.success && result.sent) {
            setSuccessMsg("Registration successful! A verification email has been sent using the community's SMTP server. Please check your inbox (and spam folder).");
          } else if (result.success && result.verificationLink) {
            // Simulated development environment or missing SMTP details
            console.log("FCM/SMTP Verification Link:", result.verificationLink);
            // Still try sending standard firebase email as client fallback
            await sendEmailVerification(cred.user);
            setSuccessMsg("Registration successful! A verification email has been sent via Firebase default delivery. Please check your inbox.");
          } else {
            throw new Error(result.error || "Failed server dispatch");
          }
        } catch (mailErr) {
          console.warn("Server email dispatch failed, falling back to Firebase default delivery:", mailErr);
          await sendEmailVerification(cred.user);
          setSuccessMsg("Registration successful! A verification email has been sent. Please check your inbox.");
        }
      } else {
        // Sign In
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (e: any) {
      console.error("Authentication error:", e);
      let readableError = e.message;
      if (e.code === 'auth/email-already-in-use') {
        readableError = "This email is already registered. Please login instead.";
      } else if (e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found') {
        readableError = "Invalid email or password. Please try again.";
      } else if (e.code === 'auth/invalid-credential') {
        readableError = "Invalid login credentials. Please try again.";
      } else if (e.code === 'auth/weak-password') {
        readableError = "Password should be at least 6 characters.";
      }
      setError(readableError);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address to receive a password reset link.");
      return;
    }
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSuccessMsg("Password reset link has been sent to your email. Please check your inbox!");
      setIsResetting(false);
    } catch (e: any) {
      console.error("Password reset error:", e);
      let readableError = e.message;
      if (e.code === 'auth/user-not-found') {
        readableError = "No registered user found with this email address.";
      } else if (e.code === 'auth/invalid-email') {
        readableError = "Please enter a valid email address.";
      }
      setError(readableError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0] dark:bg-[#141411] p-4 font-sans transition-all duration-300">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-[#1e1e1a] rounded-[32px] shadow-xl dark:shadow-2xl/10 border dark:border-white/5 overflow-hidden"
      >
        <div className="p-10 md:p-12 space-y-8">
          {/* Identity Header */}
          <div className="text-center space-y-3">
            <div className="w-20 h-20 bg-white dark:bg-[#252520] rounded-full mx-auto flex items-center justify-center shadow-md border border-gray-50 dark:border-white/5 text-[#5A5A40] dark:text-[#f5f5f0]">
              <Logo className="w-12 h-12" />
            </div>
            <div>
              <h1 className="text-3xl font-serif text-[#1a1a1a] dark:text-white">KCFC Portal</h1>
              <p className="text-gray-400 font-serif italic text-xs">Koiwa Church Filipino Community</p>
            </div>
          </div>

          {/* Form Actions Toggle */}
          {isResetting ? (
            <div className="space-y-2">
              <h2 className="text-xl font-serif text-center text-[#1a1a1a] dark:text-white">Reset Password</h2>
              <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                Enter your email address and we'll send you a secure link to reset your account credentials.
              </p>
            </div>
          ) : (
            <div className="flex bg-gray-50 dark:bg-[#252520] p-1.5 rounded-2xl border border-gray-100/50 dark:border-white/5">
              <button
                onClick={() => { setIsSignUp(false); setError(null); setSuccessMsg(null); }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer ${!isSignUp ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'}`}
              >
                Log In
              </button>
              <button
                onClick={() => { setIsSignUp(true); setError(null); setSuccessMsg(null); }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer ${isSignUp ? 'bg-[#5A5A40] text-white shadow-sm' : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'}`}
              >
                Sign Up
              </button>
            </div>
          )}

          {/* Alert Message Blocks */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl text-xs leading-relaxed text-center"
              >
                {error}
              </motion.div>
            )}
            {successMsg && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-green-50 border border-green-100 text-green-600 p-4 rounded-2xl text-xs leading-relaxed text-center font-medium"
              >
                {successMsg}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Core Input Form */}
          <form onSubmit={isResetting ? handlePasswordReset : handleEmailAuthSubmit} className="space-y-4">
            {isSignUp && !isResetting && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    required
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-11 pr-5 py-3.5 bg-gray-50 dark:bg-[#252520] focus:bg-white dark:focus:bg-[#1e1e1a] rounded-2xl border border-gray-100 dark:border-white/5 focus:border-[#5A5A40] dark:focus:border-[#8a8a65] focus:ring-1 focus:ring-[#5A5A40] text-gray-900 dark:text-white transition-all text-sm outline-none"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-5 py-3.5 bg-gray-50 dark:bg-[#252520] focus:bg-white dark:focus:bg-[#1e1e1a] rounded-2xl border border-gray-100 dark:border-white/5 focus:border-[#5A5A40] dark:focus:border-[#8a8a65] focus:ring-1 focus:ring-[#5A5A40] text-gray-900 dark:text-white transition-all text-sm outline-none"
                />
              </div>
            </div>

            {!isResetting && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-12 py-3.5 bg-gray-50 dark:bg-[#252520] focus:bg-white dark:focus:bg-[#1e1e1a] rounded-2xl border border-gray-100 dark:border-white/5 focus:border-[#5A5A40] dark:focus:border-[#8a8a65] focus:ring-1 focus:ring-[#5A5A40] text-gray-900 dark:text-white transition-all text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 focus:outline-none cursor-pointer"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            {/* Remember me Option Checkbox */}
            {!isSignUp && !isResetting && (
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-500 dark:text-gray-400 select-none">
                  <input 
                    type="checkbox" 
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded text-[#5A5A40] focus:ring-[#5A5A40] border-gray-250 dark:border-white/10 dark:bg-[#252520] w-4 h-4 cursor-pointer"
                  />
                  <span>Stay logged in for 90 days</span>
                </label>
                <button
                  type="button"
                  onClick={() => { setIsResetting(true); setError(null); setSuccessMsg(null); }}
                  className="text-xs font-semibold text-[#5A5A40] dark:text-[#a5a58d] hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-4 bg-[#5A5A40] hover:bg-[#4E4E37] text-white text-xs font-bold uppercase tracking-widest rounded-full transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
            >
              {loading ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <>
                  <span>{isResetting ? 'Send Reset Link' : isSignUp ? 'Sign Up' : 'Log In'}</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>

            {isResetting && (
              <button
                type="button"
                onClick={() => { setIsResetting(false); setError(null); setSuccessMsg(null); }}
                className="w-full flex items-center justify-center gap-2 py-3 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 text-xs font-bold uppercase tracking-widest rounded-full transition-all cursor-pointer mt-2"
              >
                Back to Log In
              </button>
            )}
          </form>

          {/* Social Logins Separator divider */}
          {!isResetting && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100 dark:border-white/5"></div></div>
                <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest"><span className="bg-white dark:bg-[#1e1e1a] px-3 text-gray-400 dark:text-gray-550">Or continue with</span></div>
              </div>

              {/* Social Active Login Buttons */}
              <div>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2.5 px-4 py-3.5 bg-white dark:bg-[#252520] border border-gray-200 dark:border-white/5 rounded-full hover:bg-gray-50 dark:hover:bg-[#2c2c25] transition-colors shadow-xs cursor-pointer text-xs font-semibold text-gray-700 dark:text-[#f5f5f0]"
                >
                  <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="" />
                  <span>Continue with Google</span>
                </button>
              </div>
            </>
          )}

          {/* Portal Information Alert disclaimer block */}
          <div className="px-4 py-3 bg-blue-50/50 dark:bg-blue-950/10 rounded-2xl border border-blue-100/30 dark:border-blue-900/20">
            <p className="text-[10px] text-blue-600/80 dark:text-blue-400 font-medium leading-relaxed text-center">
              Please make sure your registered name matches your church records for faster coordinator approval.
              </p>
          </div>

          <div className="text-[10px] text-gray-300 uppercase tracking-widest font-bold text-center">
            Membership Management System
          </div>
        </div>
      </motion.div>
    </div>
  );
}
