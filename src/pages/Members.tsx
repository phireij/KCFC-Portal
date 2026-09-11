import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  Check,
  Filter,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { db } from '../lib/firebase';
import { UserProfile } from '../types';
import { cn } from '../lib/utils';

type MemberTypeFilter = 'all' | 'core' | 'regular';

type MinistryOption = {
  id: string;
  label: string;
  group: 'Liturgical' | 'Community Service';
};

const ministryOptions: MinistryOption[] = [
  { id: 'choir_a', label: 'Choir A', group: 'Liturgical' },
  { id: 'choir_b', label: 'Choir B', group: 'Liturgical' },
  { id: 'lector_commentator', label: 'Lector & Commentator', group: 'Liturgical' },
  { id: 'usher', label: 'Usher', group: 'Liturgical' },
  { id: 'altar_server', label: 'Altar Server', group: 'Liturgical' },
  { id: 'kitchen', label: 'Kitchen Committee', group: 'Community Service' },
  { id: 'cleaning', label: 'Cleaning Committee', group: 'Community Service' },
];

const roleOrder: Record<string, number> = {
  spiritual_director: 1,
  president: 2,
  vice_president: 3,
  secretary: 4,
  treasurer: 5,
  auditor: 6,
  pro: 7,
  choir_a_leader: 10,
  choir_b_leader: 11,
  lector_commentator_leader: 12,
  usher_leader: 13,
  altar_server_leader: 14,
  kitchen_leader: 15,
  cleaning_leader: 16,
};

const leadershipRoleLabels: Record<string, string> = {
  spiritual_director: 'Spiritual Director',
  president: 'President',
  vice_president: 'Vice President',
  secretary: 'Secretary',
  treasurer: 'Treasurer',
  auditor: 'Auditor',
  pro: 'PRO',
  choir_a_leader: 'Choir A Leader',
  choir_b_leader: 'Choir B Leader',
  lector_commentator_leader: 'Lector & Commentator Leader',
  usher_leader: 'Usher Leader',
  altar_server_leader: 'Altar Server Leader',
  kitchen_leader: 'Kitchen Leader',
  cleaning_leader: 'Cleaning Leader',
};

const ministryLabel = (value: string) => ministryOptions.find((item) => item.id === value)?.label || value.replaceAll('_', ' ');

const bestRoleScore = (member: UserProfile) =>
  (member.roles || []).reduce((best, role) => Math.min(best, roleOrder[role] ?? 999), 999);

const primaryLeadershipRole = (member: UserProfile) =>
  (member.roles || [])
    .filter((role) => role in leadershipRoleLabels)
    .sort((a, b) => (roleOrder[a] ?? 999) - (roleOrder[b] ?? 999))[0];

export default function Members() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const memberTypeParam = searchParams.get('type');
  const memberType: MemberTypeFilter = memberTypeParam === 'core' || memberTypeParam === 'regular' ? memberTypeParam : 'all';
  const selectedMinistries = Array.from(new Set(searchParams.getAll('ministry').filter((id) => ministryOptions.some((option) => option.id === id))));
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        setMembers(
          snapshot.docs
            .map((item) => ({ uid: item.id, ...item.data() } as UserProfile))
            .filter((member) => member.isVerified && !member.isDisabled && member.email !== 'kcfc.jp@gmail.com'),
        );
        setLoading(false);
      },
      (error) => {
        console.error('Community directory: failed to load members', error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return members
      .filter((member) => {
        if (memberType === 'core' && !member.isCoreMember) return false;
        if (memberType === 'regular' && member.isCoreMember) return false;

        if (selectedMinistries.length > 0) {
          const hasSelectedMinistry = (member.ministries || []).some((ministry) => selectedMinistries.includes(ministry));
          if (!hasSelectedMinistry) return false;
        }

        if (!query) return true;

        const searchable = [
          member.displayName || '',
          member.nickname || '',
          ...(member.ministries || []).map(ministryLabel),
          ...(member.roles || []).map((role) => leadershipRoleLabels[role] || role.replaceAll('_', ' ')),
        ].join(' ').toLowerCase();

        return searchable.includes(query);
      })
      .sort((a, b) => {
        const scoreDiff = bestRoleScore(a) - bestRoleScore(b);
        if (scoreDiff !== 0) return scoreDiff;
        if (Boolean(a.isCoreMember) !== Boolean(b.isCoreMember)) return a.isCoreMember ? -1 : 1;
        return (a.displayName || '').localeCompare(b.displayName || '');
      });
  }, [members, memberType, searchQuery, selectedMinistries]);

  const leadershipCount = useMemo(() => members.filter((member) => bestRoleScore(member) < 999).length, [members]);
  const coreCount = useMemo(() => members.filter((member) => member.isCoreMember).length, [members]);
  const activeFilterCount = selectedMinistries.length + (memberType === 'all' ? 0 : 1);

  const setMemberTypeFilter = (nextType: MemberTypeFilter) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (nextType === 'all') next.delete('type');
      else next.set('type', nextType);
      return next;
    });
  };

  const toggleMinistry = (id: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      const valid = Array.from(new Set(next.getAll('ministry').filter((value) => ministryOptions.some((option) => option.id === value))));
      const ministries = valid.includes(id) ? valid.filter((value) => value !== id) : [...valid, id];
      next.delete('ministry');
      ministries.forEach((ministry) => next.append('ministry', ministry));
      return next;
    });
  };

  const resetFilters = () => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('type');
      next.delete('ministry');
      return next;
    });
    setSearchQuery('');
  };

  return (
    <div className="kcfc-page space-y-5 pb-3">
      <section className="overflow-hidden rounded-[24px] border border-blue-100 bg-gradient-to-br from-[#123B66] via-[#164A7D] to-[#2563EB] px-5 py-6 text-white shadow-[0_18px_45px_rgba(18,59,102,0.18)] sm:px-7 sm:py-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 flex items-center gap-2 text-blue-100">
              <UsersRound className="h-4 w-4" />
              <span className="text-[12px] font-extrabold uppercase tracking-[0.13em]">KCFC Community</span>
            </div>
            <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.025em] sm:text-[34px]">Find the people you serve with.</h1>
            <p className="mt-2 max-w-xl text-[14px] leading-6 text-blue-50/90 sm:text-[15px]">
              Browse verified KCFC members by name, ministry or community role without exposing private contact details in the general directory.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-[330px]">
            <DirectoryStat label="Members" value={members.length} />
            <DirectoryStat label="Core" value={coreCount} />
            <DirectoryStat label="Leaders" value={leadershipCount} />
          </div>
        </div>
      </section>

      <section className="kcfc-surface overflow-hidden">
        <div className="border-b border-slate-100 p-4 sm:p-5 dark:border-white/10">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search name, nickname, ministry or role"
                className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-[14px] text-[#172033] outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:ring-blue-500/20"
              />
            </label>

            <div className="grid grid-cols-3 gap-1 rounded-2xl bg-[#F7F9FC] p-1 dark:bg-white/5">
              <MemberTypeButton active={memberType === 'all'} onClick={() => setMemberTypeFilter('all')} label="All" />
              <MemberTypeButton active={memberType === 'core'} onClick={() => setMemberTypeFilter('core')} label="Core" />
              <MemberTypeButton active={memberType === 'regular'} onClick={() => setMemberTypeFilter('regular')} label="Regular" />
            </div>

            <button
              type="button"
              onClick={() => setShowFilters((value) => !value)}
              className={cn(
                'inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-4 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                showFilters || selectedMinistries.length > 0
                  ? 'border-blue-200 bg-[#EAF3FF] text-[#123B66] dark:border-blue-400/20 dark:bg-blue-500/15 dark:text-blue-200'
                  : 'border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300',
              )}
            >
              <Filter className="h-4 w-4" />
              Ministries
              {activeFilterCount > 0 && <span className="rounded-full bg-[#2563EB] px-2 py-0.5 text-[10px] text-white">{activeFilterCount}</span>}
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-[#F7F9FC] p-4 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[13px] font-extrabold text-[#172033] dark:text-white">Filter by ministry</p>
                  <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">Select one or more. A member appears when they belong to any selected ministry.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFilters(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm dark:bg-white/10 dark:text-white"
                  aria-label="Close ministry filters"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {(['Liturgical', 'Community Service'] as const).map((group) => (
                  <div key={group}>
                    <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-400">{group}</p>
                    <div className="flex flex-wrap gap-2">
                      {ministryOptions.filter((option) => option.group === group).map((option) => {
                        const selected = selectedMinistries.includes(option.id);
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => toggleMinistry(option.id)}
                            className={cn(
                              'inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                              selected
                                ? 'border-[#2563EB] bg-[#2563EB] text-white'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-[#123B66] dark:border-white/10 dark:bg-white/5 dark:text-slate-300',
                            )}
                          >
                            {selected && <Check className="h-3.5 w-3.5" />}
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 flex min-h-7 items-center justify-between gap-3">
            <p className="text-[12px] text-slate-500 dark:text-slate-400">
              {loading ? 'Loading directory…' : `${filteredMembers.length} ${filteredMembers.length === 1 ? 'member' : 'members'} shown`}
            </p>
            {(activeFilterCount > 0 || searchQuery.trim()) && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-[12px] font-bold text-[#2563EB] hover:text-[#123B66] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <DirectoryLoading />
        ) : filteredMembers.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200">
              <Search className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-[16px] font-extrabold text-[#172033] dark:text-white">No members match</h2>
            <p className="mx-auto mt-2 max-w-md text-[13px] leading-5 text-slate-500 dark:text-slate-400">Try another name or remove one of the directory filters.</p>
            <button type="button" onClick={resetFilters} className="mt-4 text-[13px] font-bold text-[#2563EB]">Show all members</button>
          </div>
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
            {filteredMembers.map((member) => <MemberCard key={member.uid} member={member} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function DirectoryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 px-3 py-3 text-center backdrop-blur-sm">
      <p className="text-[20px] font-black leading-none">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-blue-100">{label}</p>
    </div>
  );
}

function MemberTypeButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'min-h-10 rounded-xl px-3 text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        active
          ? 'bg-white text-[#123B66] shadow-sm ring-1 ring-slate-200/70 dark:bg-[#123B66] dark:text-white dark:ring-blue-400/20'
          : 'text-slate-500 hover:text-[#123B66] dark:text-slate-400 dark:hover:text-white',
      )}
    >
      {label}
    </button>
  );
}

function MemberCard({ member }: { member: UserProfile }) {
  const primaryRole = primaryLeadershipRole(member);
  const ministries = member.ministries || [];
  const initials = (member.displayName || 'KCFC Member')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-start gap-3">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#EAF3FF] text-[14px] font-black text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200">
          {member.photoURL ? (
            <img src={member.photoURL} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            initials || <UserRound className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="truncate text-[15px] font-extrabold text-[#172033] dark:text-white">{member.displayName || 'KCFC Member'}</h2>
            {member.isCoreMember && (
              <span className="rounded-full bg-[#EAF3FF] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200">Core</span>
            )}
          </div>
          {member.nickname && <p className="mt-0.5 truncate text-[12px] text-slate-500 dark:text-slate-400">“{member.nickname}”</p>}
          {primaryRole && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              {leadershipRoleLabels[primaryRole]}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3 dark:border-white/10">
        <div className="mb-2 flex items-center gap-1.5 text-slate-400">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="text-[10px] font-extrabold uppercase tracking-[0.08em]">Ministries</span>
        </div>
        {ministries.length === 0 ? (
          <p className="text-[12px] text-slate-400">No ministry listed.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {ministries.map((ministry) => (
              <span key={ministry} className="rounded-lg bg-[#F7F9FC] px-2.5 py-1.5 text-[10px] font-bold capitalize text-slate-600 dark:bg-white/5 dark:text-slate-300">
                {ministryLabel(ministry)}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function DirectoryLoading() {
  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((item) => (
        <div key={item} className="h-44 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/5" />
      ))}
    </div>
  );
}
