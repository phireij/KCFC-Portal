import React, { useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  CircleAlert,
  Mail,
  MessageCircle,
  RefreshCcw,
  Send,
  ShieldCheck,
  Smartphone,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '../App';
import { registerDeviceToken, isStandaloneMode } from '../lib/fcmClient';
import { communicationConnectorFlags, type CommunicationConnector } from '../lib/communicationConnectorFlags';
import { cn } from '../lib/utils';

const channelCards: Array<{
  id: 'email' | CommunicationConnector;
  label: string;
  detail: string;
  provider?: CommunicationConnector;
  stage: 'included' | 'planned' | 'future';
}> = [
  { id: 'email', label: 'Email', detail: 'Default partner channel', stage: 'included' },
  { id: 'line', label: 'LINE', detail: 'First optional secondary channel', provider: 'line', stage: 'planned' },
  { id: 'telegram', label: 'Telegram', detail: 'Optional secondary channel', provider: 'telegram', stage: 'planned' },
  { id: 'whatsapp', label: 'WhatsApp', detail: 'Future / conditional', provider: 'whatsapp', stage: 'future' },
];

type ServiceWorkerHealth = 'checking' | 'ready' | 'missing' | 'unsupported';

export default function NotificationHealth() {
  const { user, profile } = useAuth();
  const [enabling, setEnabling] = useState(false);
  const [registrationState, setRegistrationState] = useState<'idle' | 'ok' | 'error'>('idle');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [serviceWorkerHealth, setServiceWorkerHealth] = useState<ServiceWorkerHealth>('checking');
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);

  const permission = typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';
  const standalone = typeof window !== 'undefined' ? isStandaloneMode() : false;
  const ios = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const tokenCount = profile?.fcmTokens?.filter(Boolean).length || 0;
  const subscriptionCount = profile?.webPushSubscriptions?.length || 0;
  const endpointCount = tokenCount + subscriptionCount;

  const refreshServiceWorkerHealth = async () => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      setServiceWorkerHealth('unsupported');
      return;
    }
    setServiceWorkerHealth('checking');
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      setServiceWorkerHealth(registration?.active ? 'ready' : 'missing');
    } catch (error) {
      console.warn('Notification health: service worker inspection failed', error);
      setServiceWorkerHealth('missing');
    }
  };

  useEffect(() => {
    void refreshServiceWorkerHealth();

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const health = useMemo(() => {
    if (!online) return { label: 'Device is offline — Inbox will sync when connection returns', tone: 'warning' as const };
    if (permission === 'unsupported') return { label: 'Not supported in this browser', tone: 'warning' as const };
    if (!standalone && ios) return { label: 'Install the app first on iPhone/iPad', tone: 'warning' as const };
    if (permission === 'denied') return { label: 'Notifications are blocked', tone: 'error' as const };
    if (permission !== 'granted') return { label: 'Notifications are not enabled yet', tone: 'warning' as const };
    if (serviceWorkerHealth === 'missing') return { label: 'Push service worker needs repair', tone: 'warning' as const };
    if (endpointCount === 0) return { label: 'Permission granted — device registration needs repair', tone: 'warning' as const };
    return { label: 'Notification delivery is ready', tone: 'good' as const };
  }, [permission, standalone, ios, endpointCount, online, serviceWorkerHealth]);

  const onboardingStep = useMemo(() => {
    if (ios && !standalone) return 1;
    if (permission !== 'granted') return 2;
    if (endpointCount === 0 || serviceWorkerHealth === 'missing') return 2;
    return 3;
  }, [ios, standalone, permission, endpointCount, serviceWorkerHealth]);

  const connectorStatus = (provider: CommunicationConnector) => {
    const connection = profile?.connectedCommunicationApps?.find((item) => item.provider === provider);
    if (connection?.status === 'connected') return 'Connected';
    if (communicationConnectorFlags[provider]) return 'Available to connect';
    return provider === 'whatsapp' || provider === 'viber' ? 'Future' : 'Coming next';
  };

  const enableNotifications = async () => {
    if (!user || !online) return;
    setEnabling(true);
    setRegistrationState('idle');
    setTestResult(null);
    try {
      const token = await registerDeviceToken(user.uid, true);
      setRegistrationState(token ? 'ok' : 'error');
      await refreshServiceWorkerHealth();
    } catch (error) {
      console.error('Notification health: registration failed', error);
      setRegistrationState('error');
      await refreshServiceWorkerHealth();
    } finally {
      setEnabling(false);
    }
  };

  const sendTestNotification = async () => {
    if (!user || permission !== 'granted' || !online) return;
    setTesting(true);
    setTestResult(null);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/users/send-test-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({}),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.success) {
        setTestResult({
          tone: 'ok',
          text: result.isSandboxSimulated
            ? 'Test alert was accepted by the current browser environment.'
            : 'Test notification sent. Check your device notification tray or lock screen.',
        });
      } else {
        setTestResult({
          tone: 'error',
          text: result.error || result.message || 'The test notification could not be dispatched.',
        });
      }
    } catch (error) {
      console.error('Notification health: test push failed', error);
      setTestResult({ tone: 'error', text: 'The test request failed. Try repairing device registration first.' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="kcfc-surface overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-5 dark:border-white/10">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200">
            <BellRing className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white">App & Notification Status</h2>
            <p className="mt-1 text-[13px] leading-5 text-slate-500 dark:text-slate-400">KCFC Inbox stores every important message. PWA notifications are the primary alert; email remains the default partner.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1.15fr_.85fr]">
        <div className="space-y-4">
          <div className={cn(
            'rounded-2xl border p-4',
            health.tone === 'good' && 'border-green-200 bg-green-50/70 dark:border-green-400/20 dark:bg-green-500/10',
            health.tone === 'warning' && 'border-amber-200 bg-amber-50/70 dark:border-amber-400/20 dark:bg-amber-500/10',
            health.tone === 'error' && 'border-red-200 bg-red-50/70 dark:border-red-400/20 dark:bg-red-500/10',
          )}>
            <div className="flex items-start gap-3">
              {health.tone === 'good'
                ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-700 dark:text-green-300" />
                : <CircleAlert className={cn('mt-0.5 h-5 w-5', health.tone === 'error' ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300')} />}
              <div className="min-w-0">
                <p className="text-[13px] font-extrabold text-[#172033] dark:text-white">{health.label}</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">Permission: {permission} • Registered endpoints: {endpointCount} • App mode: {standalone ? 'installed' : 'browser'}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <HealthMetric icon={Smartphone} label="App" value={standalone ? 'Installed' : 'Browser'} />
            <HealthMetric icon={BellRing} label="Push permission" value={permission === 'granted' ? 'Allowed' : permission === 'denied' ? 'Blocked' : permission === 'unsupported' ? 'Unsupported' : 'Not enabled'} />
            <HealthMetric icon={ShieldCheck} label="Device endpoints" value={String(endpointCount)} />
            <HealthMetric icon={online ? Wifi : WifiOff} label="Push service" value={!online ? 'Offline' : serviceWorkerHealth === 'ready' ? 'Ready' : serviceWorkerHealth === 'checking' ? 'Checking' : serviceWorkerHealth === 'unsupported' ? 'Unsupported' : 'Repair needed'} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-400">Recommended setup</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <SetupStep number={1} label="Install KCFC" detail={standalone ? 'Installed' : ios ? 'Add to Home Screen first' : 'Install when browser offers it'} done={standalone} active={onboardingStep === 1} />
              <SetupStep number={2} label="Enable alerts" detail={permission === 'granted' && endpointCount > 0 && serviceWorkerHealth !== 'missing' ? 'Device registered' : 'Allow notifications and register/repair device'} done={permission === 'granted' && endpointCount > 0 && serviceWorkerHealth !== 'missing'} active={onboardingStep === 2} />
              <SetupStep number={3} label="Send a test" detail="Confirm alerts reach this device" done={Boolean(testResult?.tone === 'ok')} active={onboardingStep === 3} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={enableNotifications}
              disabled={!user || !online || enabling || permission === 'denied' || permission === 'unsupported' || (ios && !standalone)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#123B66] px-4 text-[12px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {enabling ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
              {permission === 'granted' ? 'Repair / refresh alerts' : 'Enable notifications'}
            </button>

            <button
              type="button"
              onClick={sendTestNotification}
              disabled={!user || !online || testing || permission !== 'granted' || endpointCount === 0 || serviceWorkerHealth === 'missing'}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 text-[12px] font-bold text-[#123B66] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-blue-400/20 dark:bg-white/5 dark:text-blue-200"
            >
              {testing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {testing ? 'Sending test…' : 'Send test notification'}
            </button>

            {registrationState === 'ok' && <span className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-green-50 px-3 text-[11px] font-bold text-green-700 dark:bg-green-500/10 dark:text-green-300"><CheckCircle2 className="h-4 w-4" /> Device registered</span>}
            {registrationState === 'error' && <span className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-50 px-3 text-[11px] font-bold text-red-700 dark:bg-red-500/10 dark:text-red-300"><CircleAlert className="h-4 w-4" /> Registration needs attention</span>}
          </div>

          {testResult && (
            <div className={cn(
              'rounded-xl border px-3 py-3 text-[11px] font-semibold leading-5',
              testResult.tone === 'ok'
                ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-400/20 dark:bg-green-500/10 dark:text-green-300'
                : 'border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300',
            )}>
              {testResult.text}
            </div>
          )}

          {!online && (
            <p className="rounded-xl bg-amber-50 p-3 text-[11px] leading-5 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"><strong>Offline:</strong> the Inbox can remain your durable record, but registration repair and test notifications need an internet connection.</p>
          )}

          {serviceWorkerHealth === 'missing' && online && permission === 'granted' && (
            <p className="rounded-xl bg-amber-50 p-3 text-[11px] leading-5 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"><strong>Push service needs repair:</strong> use <strong>Repair / refresh alerts</strong> to restore the service worker/device registration before sending a test.</p>
          )}

          {ios && !standalone && (
            <p className="rounded-xl bg-blue-50 p-3 text-[11px] leading-5 text-slate-600 dark:bg-blue-500/5 dark:text-slate-300"><strong>iPhone/iPad:</strong> open the browser Share menu, choose <strong>Add to Home Screen</strong>, launch KCFC from the Home Screen, then return here to enable alerts.</p>
          )}

          {permission === 'denied' && (
            <p className="rounded-xl bg-slate-50 p-3 text-[11px] leading-5 text-slate-500 dark:bg-white/5 dark:text-slate-400">Notifications are blocked by the browser or operating system. Re-enable notifications for the KCFC Portal in your device/browser settings, then return here and refresh registration.</p>
          )}
        </div>

        <div className="rounded-2xl bg-[#F7F9FC] p-4 dark:bg-white/5">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-400">Communication channels</p>
          <div className="mt-3 space-y-2">
            <ChannelRow label="KCFC Inbox" detail="Durable source of truth" status="Primary record" strong />
            <ChannelRow label="PWA Push" detail="Primary alert channel" status={permission === 'granted' && endpointCount > 0 && serviceWorkerHealth !== 'missing' ? 'Enabled' : 'Setup needed'} strong />
            {channelCards.map((channel) => (
              <ChannelRow
                key={channel.id}
                label={channel.label}
                detail={channel.detail}
                status={channel.provider ? connectorStatus(channel.provider) : channel.stage === 'included' ? 'Included' : channel.stage === 'planned' ? 'Coming next' : 'Future'}
              />
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-4 text-slate-400">Optional messaging apps will never be required. A provider can become “Available to connect” only when its browser-safe feature gate is enabled; actual delivery still requires secure server-side account linking and production approval.</p>
        </div>
      </div>
    </section>
  );
}

function HealthMetric({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <Icon className="h-4 w-4 text-[#2563EB]" />
      <p className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.07em] text-slate-400">{label}</p>
      <p className="mt-1 text-[12px] font-bold text-[#172033] dark:text-white">{value}</p>
    </div>
  );
}

function SetupStep({ number, label, detail, done, active }: { number: number; label: string; detail: string; done: boolean; active: boolean }) {
  return (
    <div className={cn('rounded-xl border p-3', active ? 'border-blue-200 bg-blue-50/70 dark:border-blue-400/20 dark:bg-blue-500/10' : 'border-slate-200 bg-[#F7F9FC] dark:border-white/10 dark:bg-white/5')}>
      <div className="flex items-center gap-2">
        <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-extrabold', done ? 'bg-green-600 text-white' : active ? 'bg-[#2563EB] text-white' : 'bg-slate-200 text-slate-500 dark:bg-white/10 dark:text-slate-300')}>{done ? '✓' : number}</span>
        <p className="text-[11px] font-extrabold text-[#172033] dark:text-white">{label}</p>
      </div>
      <p className="mt-2 text-[10px] leading-4 text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}

function ChannelRow({ label, detail, status, strong = false }: { label: string; detail: string; status: string; strong?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white p-3 dark:bg-white/5">
      <div className={cn('h-2.5 w-2.5 shrink-0 rounded-full', strong ? 'bg-[#2563EB]' : 'bg-slate-300 dark:bg-slate-600')} />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold text-[#172033] dark:text-white">{label}</p>
        <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">{detail}</p>
      </div>
      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-500 dark:bg-white/10 dark:text-slate-300">{status}</span>
    </div>
  );
}
