import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Check, Search, ShieldCheck, UsersRound } from 'lucide-react';
import { db } from '../../lib/firebase';
import {
  CHORE_MINISTRIES,
  LITURGICAL_MINISTRIES,
  normalizeMemberRoles,
  validateMemberGovernance,
} from '../../lib/memberGovernance';
import type { MinistryType, UserProfile, UserRole } from '../../types';
import { cn } from '../../lib/utils';

const ROLE_LABELS: Partial<Record<UserRole, string>> = {
  spiritual_director: 'Spiritual Director',
  president: 'President',
  vice_president: 'Vice President',
  secretary: 'Secretary',
  treasurer: 'Treasurer',
  auditor: 'Auditor',
  pro: 'P.R.O.',
  choir_a_leader: 'Choir A Leader',
  choir_b_leader: 'Choir B Leader',
  lector_commentator_leader: 'Lector / Commentator Leader',
  usher_leader: 'Usher Leader',
  altar_server_leader: 'Altar Server Leader',
  kitchen_leader: 'Kitchen Leader',
  kitchen_sub_leader: 'Kitchen Sub-Leader',
  cleaning_leader: 'Cleaning Leader',
  cleaning_sub_leader: 'Cleaning Sub-Leader',
  member: 'Member',
};

const ROLE_OPTIONS = Object.keys(ROLE_LABELS).filter((role) => role !== 'member') as UserRole[];

const MINISTRY_LABELS: Partial<Record<MinistryType, string>> = {
  choir_a: 'Choir A',
  choir_b: 'Choir B',
  lector_commentator: 'Lector & Commentator',
  usher: 'Ushers',
  altar_server: 'Altar Servers',
  kitchen: 'Kitchen',
  cleaning: 'Cleaning',
};

const MINISTRY_OPTIONS = Object.keys(MINISTRY_LABELS) as MinistryType[];

function memberLabel(member: UserProfile) {
  return member.displayName?.trim() || member.nickname?.trim() || member.email || 'Unnamed member';
}

export default function MemberRoleEditor() {
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [draftRoles, setDraftRoles] = useState<UserRole[]>(['member']);
  const [draftMinistries, setDraftMinistries] = useState<MinistryType[]>([]);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        setMembers(snapshot.docs.map((entry) => ({ uid: entry.id, ...entry.data() } as UserProfile)));
        setLoading(false);
      },
      (error) => {
        console.error('Member role editor subscription failed', error);
        setFeedback('Member roles could not be loaded. The preserved legacy administration workspace remains available in Advanced tools.');
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

  useEffect(() => {
    if (!selected) {
      setDraftRoles(['member']);
      setDraftMinistries([]);
      return;
    }
    setDraftRoles(normalizeMemberRoles((selected.roles || ['member']).filter((role) => role !== 'admin')));
    setDraftMinistries((selected.ministries || []).filter((ministry) => MINISTRY_OPTIONS.includes(ministry)));
    setFeedback(null);
  }, [selectedUid, selected?.updatedAt]);

  const issues = useMemo(() => {
    if (!selected) return [];
    return validateMemberGovernance({
      member: selected,
      allMembers: members,
      roles: draftRoles,
      ministries: draftMinistries,
    });
  }, [selected, members, draftRoles, draftMinistries]);

  const hasChanges = useMemo(() => {
    if (!selected) return false;
    const currentRoles = normalizeMemberRoles((selected.roles || []).filter((role) => role !== 'admin')).sort().join('|');
    const nextRoles = normalizeMemberRoles(draftRoles).sort().join('|');
    const currentMinistries = (selected.ministries || []).filter((ministry) => MINISTRY_OPTIONS.includes(ministry)).sort().join('|');
    const nextMinistries = [...draftMinistries].sort().join('|');
    return currentRoles !== nextRoles || currentMinistries !== nextMinistries;
  }, [selected, draftRoles, draftMinistries]);

  const toggleRole = (role: UserRole) => {
    setDraftRoles((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role]);
    setFeedback(null);
  };

  const toggleMinistry = (ministry: MinistryType) => {
    setDraftMinistries((current) => current.includes(ministry) ? current.filter((item) => item !== ministry) : [...current, ministry]);
    setFeedback(null);
  };

  const save = async () => {
    if (!selected || !hasChanges || issues.length > 0) return;
    const name = memberLabel(selected);
    const confirmed = window.confirm(`Apply the reviewed role and ministry changes for ${name}? This updates the existing member profile only; the Firebase UID and account are not recreated.`);
    if (!confirmed) return;

    setSaving(true);
    setFeedback(null);
    try {
      const preservedCleaningStatus = (selected.ministries || []).filter((ministry) => ministry === 'cleaning_toilet_ok' || ministry === 'cleaning_toilet_ng');
      const finalMinistries = draftMinistries.includes('cleaning')
        ? Array.from(new Set<MinistryType>([...draftMinistries, ...preservedCleaningStatus]))
        : draftMinistries.filter((ministry) => !CHORE_MINISTRIES.includes(ministry) || ministry === 'kitchen' || ministry === 'cleaning');
      const updates: Partial<UserProfile> & { updatedAt: unknown; lcRoles?: string[] } = {
        roles: normalizeMemberRoles(draftRoles),
        ministries: finalMinistries,
        updatedAt: serverTimestamp(),
      };
      if (!draftMinistries.includes('lector_commentator')) updates.lcRoles = [];
      await updateDoc(doc(db, 'users', selected.uid), updates);
      setFeedback(`${name}'s roles and ministries were updated without changing the account identity.`);
    } catch (error) {
      console.error('Focused member role save failed', error);
      setFeedback(`Could not save ${name}'s role/ministry changes. No Firebase account recreation was attempted.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="kcfc-surface overflow-hidden" aria-labelledby="member-role-editor-title">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-5 dark:border-white/10">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#2563EB]">Governed member editing</span>
            <h2 id="member-role-editor-title" className="mt-1 text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white">Roles & ministries</h2>
            <p className="mt-1 max-w-2xl text-[12px] leading-5 text-slate-500 dark:text-slate-400">Edit verified members through the centralized KCFC role rules. Destructive account actions and Core-member downgrade cleanup remain outside this workspace.</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.5fr)]">
        <div className="border-b border-slate-100 p-4 lg:border-b-0 lg:border-r dark:border-white/10">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <span className="sr-only">Search verified members</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search verified members"
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-[13px] text-[#172033] outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
            />
          </label>

          <div className="mt-3 max-h-[440px] space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <p className="px-3 py-8 text-center text-[11px] text-slate-400">Loading members…</p>
            ) : selectableMembers.length === 0 ? (
              <p className="px-3 py-8 text-center text-[11px] text-slate-400">No verified members match this search.</p>
            ) : selectableMembers.map((member) => (
              <button
                key={member.uid}
                type="button"
                onClick={() => setSelectedUid(member.uid)}
                className={cn(
                  'min-h-14 w-full rounded-2xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                  selectedUid === member.uid
                    ? 'border-[#2563EB] bg-[#EAF3FF] dark:border-blue-400/40 dark:bg-blue-500/10'
                    : 'border-slate-200 bg-white hover:border-blue-200 dark:border-white/10 dark:bg-white/[0.03]',
                )}
              >
                <p className="truncate text-[12px] font-extrabold text-[#172033] dark:text-white">{memberLabel(member)}</p>
                <div className="mt-1 flex flex-wrap gap-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                  <span>{member.isCoreMember ? 'Core member' : 'Regular member'}</span>
                  <span>·</span>
                  <span>{(member.ministries || []).filter((ministry) => MINISTRY_OPTIONS.includes(ministry)).length} ministries</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {!selected ? (
            <div className="flex min-h-[300px] items-center justify-center text-center">
              <div>
                <UsersRound className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-[12px] font-bold text-slate-500 dark:text-slate-400">Select a verified member to review roles and ministries.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <p className="text-[14px] font-extrabold text-[#172033] dark:text-white">{memberLabel(selected)}</p>
                <p className="mt-1 text-[10px] text-slate-400">{selected.email} · {selected.isCoreMember ? 'Core Member' : 'Regular Member'}</p>
              </div>

              <fieldset>
                <legend className="text-[10px] font-extrabold uppercase tracking-[0.09em] text-slate-400">Organizational role</legend>
                <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">Member is permanent. Select at most one additional role unless the current Core-member Kitchen/Cleaning dual-role rule applies.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#123B66] px-3 text-[11px] font-extrabold text-white"><Check className="h-3.5 w-3.5" /> Member</span>
                  {ROLE_OPTIONS.map((role) => {
                    const active = draftRoles.includes(role);
                    return (
                      <button
                        key={role}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleRole(role)}
                        className={cn(
                          'min-h-11 rounded-xl border px-3 text-[11px] font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                          active
                            ? 'border-[#2563EB] bg-[#EAF3FF] text-[#123B66] dark:border-blue-400/40 dark:bg-blue-500/10 dark:text-blue-100'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300',
                        )}
                      >
                        {ROLE_LABELS[role]}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-[10px] font-extrabold uppercase tracking-[0.09em] text-slate-400">Ministry membership</legend>
                <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">Liturgical and chore membership is validated before saving. Kitchen/Cleaning require Core Member status.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {MINISTRY_OPTIONS.map((ministry) => {
                    const active = draftMinistries.includes(ministry);
                    const chore = CHORE_MINISTRIES.includes(ministry);
                    const liturgical = LITURGICAL_MINISTRIES.includes(ministry);
                    return (
                      <button
                        key={ministry}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleMinistry(ministry)}
                        className={cn(
                          'min-h-12 rounded-2xl border px-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                          active
                            ? 'border-[#2563EB] bg-[#EAF3FF] text-[#123B66] dark:border-blue-400/40 dark:bg-blue-500/10 dark:text-blue-100'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300',
                        )}
                      >
                        <span className="block text-[11px] font-extrabold">{MINISTRY_LABELS[ministry]}</span>
                        <span className="mt-0.5 block text-[9px] uppercase tracking-wide opacity-55">{liturgical ? 'Liturgical' : chore ? 'Chore' : 'Ministry'}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {issues.length > 0 && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-400/30 dark:bg-amber-500/10" role="alert">
                  <p className="text-[11px] font-extrabold text-amber-900 dark:text-amber-100">Resolve before saving</p>
                  <ul className="mt-2 space-y-1.5 text-[10px] leading-5 text-amber-800 dark:text-amber-200">
                    {issues.map((issue, index) => <li key={`${issue.code}-${index}`}>• {issue.message}</li>)}
                  </ul>
                </div>
              )}

              {feedback && <div className="rounded-2xl border border-blue-200 bg-[#EAF3FF] px-4 py-3 text-[11px] leading-5 text-[#123B66] dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-100" role="status">{feedback}</div>}

              <div className="flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
                <p className="text-[10px] text-slate-400">UID is preserved. This workflow never recreates Firebase Auth users.</p>
                <button
                  type="button"
                  onClick={save}
                  disabled={!hasChanges || issues.length > 0 || saving}
                  className="min-h-11 rounded-xl bg-[#123B66] px-5 text-[11px] font-extrabold text-white transition hover:bg-[#0f3156] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? 'Saving…' : hasChanges ? 'Review & save' : 'No changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
