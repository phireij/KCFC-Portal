import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  MoreVertical,
  PlusSquare,
  Share2,
  Smartphone,
} from 'lucide-react';
import { isIOSDevice, isStandaloneMode } from '../lib/fcmClient';
import { cn } from '../lib/utils';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export default function InstallPWA() {
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  const [android, setAndroid] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const userAgent = navigator.userAgent || '';
    setIos(isIOSDevice());
    setAndroid(/Android/i.test(userAgent));
    setStandalone(isStandaloneMode());

    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setStandalone(true);
      setInstallPrompt(null);
      setMessage('KCFC Portal is installed on this device.');
    };

    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const requestInstall = async () => {
    if (!installPrompt || installing) return;
    setInstalling(true);
    setMessage(null);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setMessage('Installation accepted. Open KCFC from your Home Screen or app list when it finishes.');
      } else {
        setMessage('Installation was dismissed. You can install KCFC later from this page.');
      }
      setInstallPrompt(null);
    } catch (error) {
      console.error('PWA install prompt failed', error);
      setMessage('The browser could not open its install prompt. Use the manual installation steps below.');
    } finally {
      setInstalling(false);
    }
  };

  if (standalone) {
    return (
      <section className="kcfc-surface overflow-hidden">
        <div className="flex items-start gap-3 p-4 sm:p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[17px] font-extrabold tracking-tight text-[#172033] dark:text-white">KCFC Portal is installed</h2>
              <span className="rounded-full bg-green-100 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wide text-green-700 dark:bg-green-500/15 dark:text-green-300">App mode</span>
            </div>
            <p className="mt-1 text-[12px] leading-5 text-slate-500 dark:text-slate-400">Launch KCFC from your Home Screen or app list for the best mobile experience. Notification setup and testing are managed in App & Notification Status above.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="kcfc-surface overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-5 dark:border-white/10">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white">Install KCFC Portal</h2>
            <p className="mt-1 text-[12px] leading-5 text-slate-500 dark:text-slate-400">Add KCFC to your phone or tablet so Schedule, Inbox and member tools open like an app.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[.9fr_1.1fr]">
        <div className="rounded-2xl bg-gradient-to-br from-[#123B66] to-[#2563EB] p-5 text-white">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-blue-100">Recommended</p>
          <h3 className="mt-2 text-[20px] font-extrabold tracking-tight">One tap from your Home Screen.</h3>
          <p className="mt-2 text-[12px] leading-5 text-blue-50/90">Installation does not create a new KCFC account and does not copy your member data. You sign in with the same existing account.</p>

          {installPrompt ? (
            <button
              type="button"
              onClick={requestInstall}
              disabled={installing}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-[12px] font-extrabold text-[#123B66] shadow-sm disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Download className={cn('h-4 w-4', installing && 'animate-bounce')} />
              {installing ? 'Opening install prompt…' : 'Install KCFC Portal'}
            </button>
          ) : (
            <div className="mt-5 rounded-2xl bg-white/10 p-3 text-[11px] leading-5 text-blue-50">
              Your browser is not currently offering a one-tap install prompt. Use the device-specific steps beside this card.
            </div>
          )}

          {message && <p className="mt-3 rounded-xl bg-white/10 px-3 py-2 text-[10px] leading-4 text-blue-50">{message}</p>}
        </div>

        <div className="space-y-3">
          {ios ? (
            <>
              <InstallStep icon={Share2} number={1} title="Open Share" detail="In Safari, tap the Share button (square with an upward arrow)." />
              <InstallStep icon={PlusSquare} number={2} title="Add to Home Screen" detail="Scroll the Share menu and choose Add to Home Screen." />
              <InstallStep icon={ExternalLink} number={3} title="Open the KCFC icon" detail="Launch KCFC from the new Home Screen icon, sign in, then enable alerts in App & Notification Status." />
            </>
          ) : android ? (
            <>
              <InstallStep icon={Download} number={1} title="Use Install app" detail="If Chrome shows Install app / Add to Home Screen, select it and confirm." />
              <InstallStep icon={MoreVertical} number={2} title="If no prompt appears" detail="Open the browser menu (⋮) and choose Install app or Add to Home Screen." />
              <InstallStep icon={ExternalLink} number={3} title="Open KCFC as an app" detail="Launch KCFC from your Home Screen/app list, sign in and complete notification setup." />
            </>
          ) : (
            <>
              <InstallStep icon={Download} number={1} title="Look for the install control" detail="Supported desktop/mobile browsers may show an Install icon in the address bar or browser menu." />
              <InstallStep icon={MoreVertical} number={2} title="Use the browser menu" detail="Choose Install app, Apps → Install, or Add to Home Screen depending on the browser." />
              <InstallStep icon={Smartphone} number={3} title="Use KCFC in app mode" detail="The same member account and data remain available after installation." />
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function InstallStep({
  icon: Icon,
  number,
  title,
  detail,
}: {
  icon: React.ComponentType<{ className?: string }>;
  number: number;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200">
        <Icon className="h-5 w-5" />
        <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#2563EB] text-[9px] font-extrabold text-white">{number}</span>
      </div>
      <div>
        <p className="text-[13px] font-extrabold text-[#172033] dark:text-white">{title}</p>
        <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">{detail}</p>
      </div>
    </div>
  );
}
