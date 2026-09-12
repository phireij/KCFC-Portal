import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';
import { CheckCircle2, Search, ShieldCheck, UserCheck, UsersRound } from 'lucide-react';
import { db } from '../../lib/firebase';
import type { UserProfile } from '../../types';

function memberName(member: UserProfile) {
  return member.displayName?.trim() || member.nickname?.trim() || member.email || 'Unnamed member';
}

function createdLabel(value: unknown) {
  if (!value) return 'Registration date unavailable';
  try {
    const source = value as { toDate?: () => Date };
    const date = typeof source.toDate === 'function' ? source.toDate() : new Date(value as string);
    if (Number.isNaN(date.getTime())) return 'Registration date unavailable';
    return `Registered ${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)}`;
  } catch {
    return 'Registration date unavailable';
  }
}

export default function MemberApprovalQueue() {
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        setMembers(snapshot.docs.map((entry) => ({ uid: entry.id, ...entry.data() } as UserProfile)));
        setLoading(false);
      },
      (error) => {
        console.error('Member approval queue subscription failed', error);
        setLoading(false);
        setMessage('The member approval queue could not be loaded. Existing legacy administration remains available in Advanced tools.');
      },
    );
    return unsubscribe;
  }, []);

  const pending = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return members
      .filter((member) => !member.isVerified && !(member.roles || []).includes('admin'))
      .filter((member) => {
        if (!needle) return true;
        return [member.displayName, member.nickname, member.email]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      })
      .sort((a, b) => memberName(a).localeCompare(memberName(b)));
  }, [members, search]);

  const verifiedCount = members.filter((member) => member.isVerified && !(member.roles || []).includes('admin')).length;

  const verifyMember = async (member: UserProfile) => {
    const name = memberName(member);
    const confirmed = window.confirm(`Verify ${name} as a KCFC member? This grants the verified-member status but does not change roles or ministries.`);
    if (!confirmed) return;

    setBusyUid(member.uid);
    setMessage(null);
    try {
      await updateDoc(doc(db, 'users', member.uid), {
        isVerified: true,
        updatedAt: serverTimestamp(),
      });
      setMessage(`${name} is now verified. Roles and ministries were left unchanged.`);
    } catch (error) {
      console.error('Member verification failed', error);
      setMessage(`Could not verify ${name}. No member data was changed.`);
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <section className="kcfc-surface overflow-hidden" aria-labelledby="member-approval-title">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-5 dark:border-white/10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#2563EB]">
              <UserCheck className="h-4 w-4" />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.1em]">Focused member workflow</span>
            </div>
            <h2 id="member-approval-title" className="mt-1 text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white">Pending member approvals</h2>
            <p className="mt-1 max-w-2xl text-[12px] leading-5 text-slate-500 dark:text-slate-400">Verify an existing Firestore member profile without recreating the Firebase account, changing the UID, or altering ministries and leadership roles.</p>
          </div>
          <div className="flex gap-2">
            <Metric icon={UserCheck} label="Pending" value={loading ? '—' : String(pending.length)} attention={pending.length > 0} />
            <Metric icon={UsersRound} label="Verified" value={loading ? '—' : String(verifiedCount)} />
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <span className="sr-only">Search pending members</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search pending members by name, nickname or email"
            className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-[13px] text-[#172033] outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
          />
        </label>

        {message && (
          <div className="rounded-2xl border border-blue-200 bg-[#EAF3FF] px-4 py-3 text-[11px] leading-5 text-[#123B66] dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-100" role="status">
            {message}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-[12px] text-slate-400 dark:border-white/10">Loading pending member profiles…</div>
        ) : pending.length === 0 ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-8 text-center dark:border-emerald-400/20 dark:bg-emerald-500/10">
            <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-600 dark:text-emerald-300" />
            <p className="mt-2 text-[13px] font-extrabold text-emerald-800 dark:text-emerald-100">No pending members match this view.</p>
            <p className="mt-1 text-[11px] text-emerald-700/80 dark:text-emerald-200/80">New registrations will appear here automatically.</p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {pending.map((member) => (
              <article key={member.uid} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex items-start gap-3">
                  {member.photoURL ? (
                    <img src={member.photoURL} alt="" className="h-11 w-11 shrink-0 rounded-2xl object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[13px] font-extrabold text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200">
                      {memberName(member).slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-extrabold text-[#172033] dark:text-white">{memberName(member)}</p>
                    {member.nickname && member.displayName && <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">Known as {member.nickname}</p>}
                    <p className="mt-1 break-all text-[10px] text-slate-400">{member.email || 'No email recorded'}</p>
                    <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-400">{createdLabel((member as UserProfile & { createdAt?: unknown }).createdAt)}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
                  <span className="inline-flex min-h-8 w-fit items-center gap-1.5 rounded-full bg-amber-100 px-3 text-[10px] font-extrabold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                    <ShieldCheck className="h-3.5 w-3.5" /> Awaiting verification
                  </span>
                  <button
                    type="button"
                    onClick={() => verifyMember(member)}
                    disabled={busyUid === member.uid}
                    className="min-h-11 rounded-xl bg-[#123B66] px-4 text-[11px] font-extrabold text-white transition hover:bg-[#0f3156] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-wait disabled:opacity-60"
                  >
                    {busyUid === member.uid ? 'Verifying…' : 'Verify member'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Metric({ icon: Icon, label, value, attention = false }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; attention?: boolean }) {
  return (
    <div className="min-w-[78px] rounded-2xl border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${attention ? 'text-amber-600 dark:text-amber-300' : 'text-[#2563EB]'}`} />
        <span className="text-[8px] font-extrabold uppercase tracking-wide text-slate-400">{label}</span>
      </div>
      <p className="mt-1 text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white">{value}</p>
    </div>
  );
}
