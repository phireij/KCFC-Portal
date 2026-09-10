import React, { useMemo, useState } from 'react';
import { BellRing, CheckCircle2, CircleAlert, Mail, MessageCircle, RefreshCcw, Smartphone, Send, ShieldCheck } from 'lucide-react';
import { useAuth } from '../App';
import { registerDeviceToken, isStandaloneMode } from '../lib/fcmClient';
import { cn } from '../lib/utils';

const channelCards = [
  { id: 'email', label: 'Email', detail: 'Default partner channel', icon: Mail, status: 'included' as const },
  { id: 'line', label: 'LINE', detail: 'First optional secondary channel', icon: MessageCircle, status: 'planned' as const },
  { id: 'telegram', label: 'Telegram', detail: 'Optional secondary channel', icon: Send, status: 'planned' as const },
  { id: 'whatsapp', label: 'WhatsApp', detail: 'Future / conditional', icon: MessageCircle, status: 'future' as const },
];

export default function NotificationHealth() {
  const { user, profile } = useAuth();
  const [enabling, setEnabling] = useState(false);
  const [testState, setTestState] = useState<'idle' | 'ok' | 'error'>('idle');

  const permission = typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';
  const standalone = typeof window !== 'undefined' ? isStandaloneMode() : false;
  const tokenCount = profile?.fcmTokens?.filter(Boolean).length || 0;
  const subscriptionCount = profile?.webPushSubscriptions?.length || 0;

  const health = useMemo(() => {
    if (permission === 'unsupported') return { label: 'Not supported in this browser', tone: 'warning' as const };
    if (!standalone && /iPad|iPhone|iPod/.test(navigator.userAgent)) return { label: 'Install the app first on iPhone/iPad', tone: 'warning' as const };
    if (permission === 'denied') return { label: 'Notifications are blocked', tone: 'error' as const };
    if (permission !== 'granted') return { label: 'Notifications are not enabled yet', tone: 'warning' as const };
    if (tokenCount + subscriptionCount === 0) return { label: 'Permission granted — device registration needs repair', tone: 'warning' as const };
    return { label: 'Notification delivery is ready', tone: 'good' as const };
  }, [permission, standalone, subscriptionCount, tokenCount]);

  const enableNotifications = async () => {
    if (!user) return;
    setEnabling(true);
    setTestState('idle');
    try {
      const token = await registerDeviceToken(user.uid, true);
      setTestState(token ? 'ok' : 'error');
    } catch (error) {
      console.error('Notification health: registration failed', error);
      setTestState('error');
    } finally {
      setEnabling(false);
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
        <div className="space-y-3">
          <div className={cn(
            'rounded-2xl border p-4',
            health.tone === 'good' && 'border-green-200 bg-green-50/70 dark:border-green-400/20 dark:bg-green-500/10',
            health.tone === 'warning' && 'border-amber-200 bg-amber-50/70 dark:border-amber-400/20 dark:bg-amber-500/10',
            health.tone === 'error' && 'border-red-200 bg-red-50/70 dark:border-red-400/20 dark:bg-red-500/10',
          )}>
            <div className="flex items-start gap-3">
              {health.tone === 'good' ? <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-700 dark:text-green-300" /> : <CircleAlert className={cn('mt-0.5 h-5 w-5', health.tone === 'error' ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300')} />}
              <div className="min-w-0">
                <p className="text-[13px] font-extrabold text-[#172033] dark:text-white">{health.label}</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">Permission: {permission} • Registered endpoints: {tokenCount + subscriptionCount} • App mode: {standalone ? 'installed' : 'browser'}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <HealthMetric icon={Smartphone} label="App" value={standalone ? 'Installed' : 'Browser'} />
            <HealthMetric icon={BellRing} label="Push permission" value={permission === 'granted' ? 'Allowed' : permission === 'denied' ? 'Blocked' : permission === 'unsupported' ? 'Unsupported' : 'Not enabled'} />
            <HealthMetric icon={ShieldCheck} label="Device endpoints" value={String(tokenCount + subscriptionCount)} />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={enableNotifications}
              disabled={!user || enabling || permission === 'denied' || permission === 'unsupported'}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#123B66] px-4 text-[12px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {enabling ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
              {permission === 'granted' ? 'Repair / refresh alerts' : 'Enable notifications'}
            </button>
            {testState === 'ok' && <span className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-green-50 px-3 text-[11px] font-bold text-green-700 dark:bg-green-500/10 dark:text-green-300"><CheckCircle2 className="h-4 w-4" /> Device registered</span>}
            {testState === 'error' && <span className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-50 px-3 text-[11px] font-bold text-red-700 dark:bg-red-500/10 dark:text-red-300"><CircleAlert className="h-4 w-4" /> Registration needs attention</span>}
          </div>

          {permission === 'denied' && (
            <p className="rounded-xl bg-slate-50 p-3 text-[11px] leading-5 text-slate-500 dark:bg-white/5 dark:text-slate-400">Notifications are blocked by the browser or operating system. Re-enable notifications for the KCFC Portal in your device/browser settings, then return here and refresh registration.</p>
          )}
        </div>

        <div className="rounded-2xl bg-[#F7F9FC] p-4 dark:bg-white/5">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-400">Communication channels</p>
          <div className="mt-3 space-y-2">
            <ChannelRow label="KCFC Inbox" detail="Durable source of truth" status="Primary record" strong />
            <ChannelRow label="PWA Push" detail="Primary alert channel" status={permission === 'granted' ? 'Enabled' : 'Setup needed'} strong />
            {channelCards.map((channel) => (
              <ChannelRow key={channel.id} label={channel.label} detail={channel.detail} status={channel.status === 'included' ? 'Included' : channel.status === 'planned' ? 'Coming next' : 'Future'} />
            ))}
          </div>
          <p className="mt-3 text-[10px] leading-4 text-slate-400">Optional messaging apps will never be required. When enabled later, they will only mirror selected KCFC alerts and deep-link members back into the Portal.</p>
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
