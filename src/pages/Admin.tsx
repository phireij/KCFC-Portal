import React, { useState } from 'react';
import { useAuth } from '../App';
import {
  BellRing,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  UsersRound,
} from 'lucide-react';
import BroadcastTool from '../components/admin/BroadcastTool';
import LeadershipOverview from '../components/admin/LeadershipOverview';
import LegacyAdmin from './LegacyAdmin';
import { cn } from '../lib/utils';

const adminRoles = ['admin', 'president'];
type WorkspaceView = 'overview' | 'broadcast' | 'members' | 'advanced';

const workspaceItems: Array<{
  id: WorkspaceView;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'warning';
}> = [
  {
    id: 'overview',
    label: 'Leadership overview',
    description: 'Attention queues and safe operational status.',
    icon: ShieldCheck,
  },
  {
    id: 'broadcast',
    label: 'Member communications',
    description: 'Targeted KCFC Inbox, PWA and email broadcasts.',
    icon: BellRing,
  },
  {
    id: 'members',
    label: 'Member administration',
    description: 'Approvals, roles, ministries and member records.',
    icon: UsersRound,
  },
  {
    id: 'advanced',
    label: 'Advanced legacy tools',
    description: 'Destructive and low-frequency administration controls.',
    icon: ShieldAlert,
    tone: 'warning',
  },
];

export default function Admin() {
  const { profile } = useAuth();
  const [activeView, setActiveView] = useState<WorkspaceView>('overview');
  const canAccess = (profile?.roles || []).some((role) => adminRoles.includes(role));

  if (!canAccess) {
    return (
      <div className="kcfc-page pb-4">
        <section className="kcfc-surface px-5 py-12 text-center sm:px-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200"><ShieldCheck className="h-6 w-6" /></div>
          <h1 className="mt-4 text-[20px] font-extrabold tracking-tight text-[#172033] dark:text-white">Leadership administration</h1>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-5 text-slate-500 dark:text-slate-400">This area is available only to authorized KCFC administrators and the President.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="kcfc-page space-y-5 pb-4">
      <section className="overflow-hidden rounded-[26px] border border-blue-100 bg-gradient-to-br from-[#123B66] via-[#174E83] to-[#2563EB] p-5 text-white shadow-[0_18px_45px_rgba(18,59,102,0.18)] sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 flex items-center gap-2 text-blue-100">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-[11px] font-extrabold uppercase tracking-[0.13em]">KCFC Leadership Console</span>
            </div>
            <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[34px]">Manage the community without losing sight of people.</h1>
            <p className="mt-2 max-w-xl text-[14px] leading-6 text-blue-50/90">Leadership work is progressively separated into focused workspaces so routine tasks stay easy to reach and destructive controls stay deliberately out of the normal path.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:min-w-[300px]">
            <HeaderMetric icon={UserCheck} label="Approvals" value="Queue" />
            <HeaderMetric icon={UsersRound} label="Members" value="Roles" />
            <HeaderMetric icon={BellRing} label="Broadcasts" value="Controlled" />
            <HeaderMetric icon={SlidersHorizontal} label="Settings" value="Role-gated" />
          </div>
        </div>
      </section>

      <section className="kcfc-surface overflow-hidden" aria-labelledby="leadership-workspace-title">
        <div className="border-b border-slate-100 px-4 py-4 sm:px-5 dark:border-white/10">
          <h2 id="leadership-workspace-title" className="text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white">Leadership workspace</h2>
          <p className="mt-1 text-[12px] leading-5 text-slate-500 dark:text-slate-400">Choose the task you need. Routine operational work is separated from advanced legacy administration.</p>
        </div>

        <div className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-4" role="tablist" aria-label="Leadership workspace sections">
          {workspaceItems.map((item) => {
            const Icon = item.icon;
            const selected = activeView === item.id;
            const warning = item.tone === 'warning';
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`leadership-panel-${item.id}`}
                onClick={() => setActiveView(item.id)}
                className={cn(
                  'min-h-[92px] rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                  selected && !warning && 'border-[#2563EB] bg-[#EAF3FF] text-[#123B66] dark:border-blue-400/40 dark:bg-blue-500/10 dark:text-blue-100',
                  !selected && !warning && 'border-slate-200 bg-white text-[#172033] hover:border-blue-200 hover:bg-blue-50/40 dark:border-white/10 dark:bg-white/[0.03] dark:text-white',
                  selected && warning && 'border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-100',
                  !selected && warning && 'border-amber-200 bg-amber-50/40 text-amber-900 hover:bg-amber-50 dark:border-amber-400/20 dark:bg-amber-500/[0.04] dark:text-amber-200',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', warning ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-white text-[#123B66] shadow-sm dark:bg-white/10 dark:text-blue-200')}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <ChevronRight className={cn('mt-2 h-4 w-4', selected ? 'opacity-100' : 'opacity-35')} />
                </div>
                <p className="mt-3 text-[12px] font-extrabold">{item.label}</p>
                <p className="mt-1 text-[10px] leading-4 opacity-70">{item.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <div id={`leadership-panel-${activeView}`} role="tabpanel">
        {activeView === 'overview' && (
          <div className="space-y-4">
            <LeadershipOverview />
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Principle title="Review first" body="Pending approvals and requests should remain visibly separate from completed work." />
              <Principle title="Least privilege" body="Member access and leadership roles stay explicitly controlled by the existing permission model." />
              <Principle title="Message carefully" body="Broadcast and notification actions remain deliberate; no mass send is triggered by this redesign." />
              <Principle title="Preserve records" body="Existing users, roles, inquiries and settings remain in place throughout migration." />
            </section>
          </div>
        )}

        {activeView === 'broadcast' && (
          <section aria-label="Member communications">
            <BroadcastTool />
          </section>
        )}

        {activeView === 'members' && (
          <section className="kcfc-surface overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-4 sm:px-5 dark:border-white/10">
              <h2 className="text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white">Member administration</h2>
              <p className="mt-1 text-[12px] leading-5 text-slate-500 dark:text-slate-400">The proven member-management engine remains intact while its individual approval, profile and role workflows are progressively migrated.</p>
            </div>
            <div className="p-2 sm:p-4">
              <LegacyAdmin />
            </div>
          </section>
        )}

        {activeView === 'advanced' && (
          <section className="space-y-3">
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <h2 className="text-[15px] font-extrabold">Advanced legacy administration</h2>
                  <p className="mt-1 text-[11px] leading-5">This preserved workspace contains low-frequency and potentially destructive tools, including member removal and credential-purge controls. Production use of destructive actions remains an explicit approval-gated operation.</p>
                </div>
              </div>
            </div>
            <section className="kcfc-surface overflow-hidden">
              <div className="p-2 sm:p-4">
                <LegacyAdmin />
              </div>
            </section>
          </section>
        )}
      </div>
    </div>
  );
}

function HeaderMetric({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/12 p-3 backdrop-blur-sm">
      <Icon className="h-4 w-4 text-blue-100" />
      <p className="mt-2 text-[9px] font-bold uppercase tracking-wide text-blue-100">{label}</p>
      <p className="mt-0.5 text-[11px] font-extrabold text-white">{value}</p>
    </div>
  );
}

function Principle({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <p className="text-[12px] font-extrabold text-[#172033] dark:text-white">{title}</p>
      <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">{body}</p>
    </div>
  );
}
