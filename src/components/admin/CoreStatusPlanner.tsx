import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { AlertTriangle, ArrowRight, Search, ShieldCheck, UserRoundCheck } from 'lucide-react';
import { db } from '../../lib/firebase';
import { planCoreStatusTransition } from '../../lib/memberGovernance';
import type { MinistryType, UserProfile, UserRole } from '../../types';
import { cn } from '../../lib/utils';

const roleLabel = (role: UserRole) => role === 'member'
  ? 'Member'
  : role.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const ministryLabel = (ministry: MinistryType) => ministry
  .replaceAll('_', ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const memberLabel = (member: UserProfile) => member.displayName?.trim() || member.nickname?.trim() || member.email || 'Unnamed member';

export default function CoreStatusPlanner() {
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [targetCore, setTargetCore] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        setMembers(snapshot.docs.map((entry) => ({ uid: entry.id, ...entry.data() } as UserProfile)));
        setLoadError(false);
        setLoading(false);
      },
      (error) => {
        console.error('Core status planner subscription failed', error);
        setLoadError(true);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, []);

  const selectableMembers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return members
      .filter((member) => member.isVerified && !(member.roles || []).includes('admin'))
      .filter((member) => {
        if (!needle) return true;
        return [member.displayName, member.nickname, member.email]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      })
      .sort((a, b) => memberLabel(a).localeCompare(memberLabel(b)));
  }, [members, search]);

  const selected = members.find((member) => member.uid === selectedUid) || null;
  const effectiveTarget = selected ? (targetCore ?? !Boolean(selected.isCoreMember)) : false;
  const plan = selected ? planCoreStatusTransition(selected, effectiveTarget) : null;

  const selectMember = (member: UserProfile) => {
    setSelectedUid(member.uid);
    setTargetCore(!Boolean(member.isCoreMember));
  };

  return (
    <section className="kcfc-surface overflow-hidden" aria-labelledby="core-transition-title">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-5 dark:border-white/10">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200">
            <UserRoundCheck className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#2563EB]">Read-only impact preview</span>
            <h2 id="core-transition-title" className="mt-1 text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white">Core Member status planner</h2>
            <p className="mt-1 max-w-2xl text-[12px] leading-5 text-slate-500 dark:text-slate-400">Preview exactly what a Core-status upgrade or downgrade would preserve or remove before any governed status-changing workflow is introduced. This planner never writes to Firestore.</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.5fr)]">
        <div className="border-b border-slate-100 p-4 lg:border-b-0 lg:border-r dark:border-white/10">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <span className="sr-only">Search verified members for Core status planning</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search verified members"
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-[13px] text-[#172033] outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
            />
          </label>

          <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <p className="px-3 py-8 text-center text-[11px] text-slate-400">Loading members…</p>
            ) : loadError ? (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-4 text-[11px] leading-5 text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">Member records could not be loaded. No Core-status action is available from this planner.</p>
            ) : selectableMembers.length === 0 ? (
              <p className="px-3 py-8 text-center text-[11px] text-slate-400">No verified members match this search.</p>
            ) : selectableMembers.map((member) => (
              <button
                key={member.uid}
                type="button"
                onClick={() => selectMember(member)}
                className={cn(
                  'min-h-14 w-full rounded-2xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                  selectedUid === member.uid
                    ? 'border-[#2563EB] bg-[#EAF3FF] dark:border-blue-400/40 dark:bg-blue-500/10'
                    : 'border-slate-200 bg-white hover:border-blue-200 dark:border-white/10 dark:bg-white/[0.03]',
                )}
              >
                <p className="truncate text-[12px] font-extrabold text-[#172033] dark:text-white">{memberLabel(member)}</p>
                <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-400">{member.isCoreMember ? 'Core Member' : 'Regular Member'}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {!selected || !plan ? (
            <div className="flex min-h-[300px] items-center justify-center text-center">
              <div>
                <ShieldCheck className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-[12px] font-bold text-slate-500 dark:text-slate-400">Select a verified member to preview a Core-status transition.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <p className="text-[14px] font-extrabold text-[#172033] dark:text-white">{memberLabel(selected)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-extrabold uppercase tracking-wide">
                  <span className="rounded-full bg-slate-200 px-2.5 py-1 text-slate-600 dark:bg-white/10 dark:text-slate-300">{plan.fromCore ? 'Core Member' : 'Regular Member'}</span>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                  <span className="rounded-full bg-[#EAF3FF] px-2.5 py-1 text-[#123B66] dark:bg-blue-500/15 dark:text-blue-100">{plan.toCore ? 'Core Member' : 'Regular Member'}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2" role="group" aria-label="Preview target Core status">
                <button type="button" aria-pressed={effectiveTarget} onClick={() => setTargetCore(true)} className={cn('min-h-11 rounded-xl border px-4 text-[11px] font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500', effectiveTarget ? 'border-[#2563EB] bg-[#EAF3FF] text-[#123B66] dark:border-blue-400/40 dark:bg-blue-500/10 dark:text-blue-100' : 'border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300')}>Preview Core Member</button>
                <button type="button" aria-pressed={!effectiveTarget} onClick={() => setTargetCore(false)} className={cn('min-h-11 rounded-xl border px-4 text-[11px] font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500', !effectiveTarget ? 'border-[#2563EB] bg-[#EAF3FF] text-[#123B66] dark:border-blue-400/40 dark:bg-blue-500/10 dark:text-blue-100' : 'border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300')}>Preview Regular Member</button>
              </div>

              {plan.fromCore === plan.toCore ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-[11px] leading-5 text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">No status change is being previewed. Existing roles and ministries remain unchanged.</div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ImpactCard title="Roles preserved" items={plan.preservedRoles.map(roleLabel)} empty="No roles preserved" />
                    <ImpactCard title="Ministries preserved" items={plan.preservedMinistries.map(ministryLabel)} empty="No ministries preserved" />
                    <ImpactCard title="Roles removed" items={plan.rolesToRemove.map(roleLabel)} empty="No roles removed" warning={plan.rolesToRemove.length > 0} />
                    <ImpactCard title="Ministries removed" items={plan.ministriesToRemove.map(ministryLabel)} empty="No ministries removed" warning={plan.ministriesToRemove.length > 0} />
                  </div>

                  <div className={cn('rounded-2xl border p-4', plan.requiresCleanup ? 'border-amber-300 bg-amber-50 dark:border-amber-400/30 dark:bg-amber-500/10' : 'border-blue-200 bg-[#EAF3FF] dark:border-blue-400/20 dark:bg-blue-500/10')}>
                    <div className="flex items-start gap-3">
                      {plan.requiresCleanup ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" /> : <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#2563EB]" />}
                      <div>
                        <p className={cn('text-[11px] font-extrabold', plan.requiresCleanup ? 'text-amber-900 dark:text-amber-100' : 'text-[#123B66] dark:text-blue-100')}>{plan.requiresCleanup ? 'Cleanup would be required' : 'No automatic cleanup required'}</p>
                        <ul className={cn('mt-2 space-y-1.5 text-[10px] leading-5', plan.requiresCleanup ? 'text-amber-800 dark:text-amber-200' : 'text-[#123B66] dark:text-blue-100')}>
                          {plan.warnings.map((warning) => <li key={warning}>• {warning}</li>)}
                        </ul>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[10px] leading-5 text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
                Preview only. No Core-status update, role cleanup, ministry cleanup, user deletion or Firebase Auth change can be performed here.
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ImpactCard({ title, items, empty, warning = false }: { title: string; items: string[]; empty: string; warning?: boolean }) {
  return (
    <div className={cn('rounded-2xl border p-4', warning ? 'border-amber-200 bg-amber-50/70 dark:border-amber-400/20 dark:bg-amber-500/[0.06]' : 'border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03]')}>
      <p className={cn('text-[10px] font-extrabold uppercase tracking-[0.08em]', warning ? 'text-amber-700 dark:text-amber-300' : 'text-slate-400')}>{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-[11px] text-slate-400">{empty}</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((item) => <span key={item} className={cn('rounded-lg px-2 py-1 text-[10px] font-bold', warning ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300')}>{item}</span>)}
        </div>
      )}
    </div>
  );
}
