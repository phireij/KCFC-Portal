import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { AlertTriangle, CheckCircle2, Clock3, Search, ShieldCheck, UsersRound } from 'lucide-react';
import { db } from '../../lib/firebase';
import { getMemberAccountStatus, summarizeMemberAccountStatus, type MemberAccountStatus } from '../../lib/memberAccountStatus';
import type { UserProfile } from '../../types';
import { cn } from '../../lib/utils';

const statusLabels: Record<MemberAccountStatus, string> = {
  active: 'Active',
  pending: 'Pending verification',
  disabled: 'Disabled',
};

const memberLabel = (member: UserProfile) => member.displayName?.trim() || member.nickname?.trim() || member.email || 'Unnamed member';

export default function MemberAccountOverview() {
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | MemberAccountStatus>('all');

  useEffect(() => {
    return onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        setMembers(snapshot.docs.map((entry) => ({ uid: entry.id, ...entry.data() } as UserProfile)));
        setLoadError(false);
        setLoading(false);
      },
      (error) => {
        console.error('Member account overview subscription failed', error);
        setLoadError(true);
        setLoading(false);
      },
    );
  }, []);

  const visibleMembers = useMemo(() => members.filter((member) => !(member.roles || []).includes('admin')), [members]);
  const summary = useMemo(() => summarizeMemberAccountStatus(members), [members]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return visibleMembers
      .filter((member) => status === 'all' || getMemberAccountStatus(member) === status)
      .filter((member) => !needle || [member.displayName, member.nickname, member.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)))
      .sort((a, b) => memberLabel(a).localeCompare(memberLabel(b)));
  }, [visibleMembers, search, status]);

  return (
    <section className="kcfc-surface overflow-hidden" aria-labelledby="member-account-overview-title">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-5 dark:border-white/10">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200">
              <UsersRound className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#2563EB]">Read-only account visibility</span>
              <h2 id="member-account-overview-title" className="mt-1 text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white">Member account status</h2>
              <p className="mt-1 max-w-2xl text-[12px] leading-5 text-slate-500 dark:text-slate-400">See active, pending and disabled member records without exposing account-disable, removal or credential controls in the routine leadership path.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatusMetric label="Total" value={summary.total} icon={UsersRound} />
            <StatusMetric label="Active" value={summary.active} icon={CheckCircle2} />
            <StatusMetric label="Pending" value={summary.pending} icon={Clock3} attention={summary.pending > 0} />
            <StatusMetric label="Disabled" value={summary.disabled} icon={AlertTriangle} attention={summary.disabled > 0} />
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <span className="sr-only">Search member account statuses</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, nickname or email"
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-[13px] text-[#172033] outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
            />
          </label>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter member account status">
            {(['all', 'active', 'pending', 'disabled'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={status === option}
                onClick={() => setStatus(option)}
                className={cn(
                  'min-h-11 rounded-xl border px-3 text-[11px] font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                  status === option
                    ? 'border-[#2563EB] bg-[#EAF3FF] text-[#123B66] dark:border-blue-400/40 dark:bg-blue-500/10 dark:text-blue-100'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300',
                )}
              >
                {option === 'all' ? 'All' : statusLabels[option]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-[12px] text-slate-400 dark:border-white/10">Loading member status…</div>
        ) : loadError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-[11px] leading-5 text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200" role="status">Member status could not be loaded. No account action is available from this overview.</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-[12px] text-slate-400 dark:border-white/10">No member records match this view.</div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((member) => {
              const memberStatus = getMemberAccountStatus(member);
              return (
                <article key={member.uid} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-extrabold text-[#172033] dark:text-white">{memberLabel(member)}</p>
                      <p className="mt-1 break-all text-[10px] text-slate-400">{member.email || 'No email recorded'}</p>
                    </div>
                    <StatusBadge status={memberStatus} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                    <span>{member.isCoreMember ? 'Core member' : 'Regular member'}</span>
                    <span aria-hidden="true">·</span>
                    <span>{(member.ministries || []).length} ministries</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" />
          <p className="text-[10px] leading-5 text-slate-500 dark:text-slate-400">Read-only. Account disabling, removal, Firebase Auth deletion and credential cleanup remain isolated in Advanced tools and are not available here.</p>
        </div>
      </div>
    </section>
  );
}

function StatusMetric({ label, value, icon: Icon, attention = false }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; attention?: boolean }) {
  return (
    <div className="min-w-[76px] rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-3.5 w-3.5', attention ? 'text-amber-600 dark:text-amber-300' : 'text-[#2563EB]')} />
        <span className="text-[8px] font-extrabold uppercase tracking-wide text-slate-400">{label}</span>
      </div>
      <p className="mt-1 text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: MemberAccountStatus }) {
  return (
    <span className={cn(
      'shrink-0 rounded-full px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wide',
      status === 'active' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200',
      status === 'pending' && 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200',
      status === 'disabled' && 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300',
    )}>{statusLabels[status]}</span>
  );
}
