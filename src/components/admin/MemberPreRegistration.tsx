import React, { useState } from 'react';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { MailPlus, ShieldCheck, UserPlus } from 'lucide-react';
import { db } from '../../lib/firebase';
import { buildMemberPreRegistrationPlan } from '../../lib/memberPreRegistration';

export default function MemberPreRegistration() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    let plan;
    try {
      plan = buildMemberPreRegistrationPlan({ email, displayName });
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : 'Check the member details and try again.');
      return;
    }

    const confirmed = window.confirm(
      `Pre-register ${plan.displayName} (${plan.email})?\n\nThis creates only a pending KCFC Firestore profile. It does not create a Firebase Auth account, verify the member, or assign ministries/leadership roles.`,
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      const pendingRef = doc(db, 'users', plan.documentId);
      const [pendingSnapshot, existingEmailSnapshot] = await Promise.all([
        getDoc(pendingRef),
        getDocs(query(collection(db, 'users'), where('email', '==', plan.email))),
      ]);

      if (pendingSnapshot.exists() || !existingEmailSnapshot.empty) {
        setError('A member profile with this email already exists or is already pending. No new record was created.');
        return;
      }

      await setDoc(pendingRef, {
        ...plan.profile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setMessage(`${plan.displayName} was added to the pending registration queue. No Firebase Auth account or verified access was created.`);
      setDisplayName('');
      setEmail('');
    } catch (submitError) {
      console.error('Member pre-registration failed', submitError);
      setError('The pending profile could not be created. No member access was granted.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="kcfc-surface overflow-hidden" aria-labelledby="member-pre-registration-title">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-5 dark:border-white/10">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[#2563EB]">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.1em]">Focused member workflow</span>
            </div>
            <h2 id="member-pre-registration-title" className="mt-1 text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white">Pre-register a member</h2>
            <p className="mt-1 max-w-2xl text-[12px] leading-5 text-slate-500 dark:text-slate-400">Create a pending profile before the member signs in. This does not create a Firebase Auth identity, grant verified access, or assign ministries and leadership roles.</p>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">Member name</span>
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              autoComplete="name"
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[13px] text-[#172033] outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
              placeholder="Full name"
              disabled={busy}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">Email address</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[13px] text-[#172033] outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
              placeholder="member@example.com"
              disabled={busy}
            />
          </label>
        </div>

        <div className="rounded-2xl border border-blue-100 bg-[#F7FAFF] p-4 dark:border-blue-400/15 dark:bg-blue-500/[0.05]">
          <div className="flex items-start gap-3">
            <MailPlus className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" />
            <p className="text-[11px] leading-5 text-slate-600 dark:text-slate-300">The member still completes normal sign-in/registration. The existing migration path then moves the pending profile onto the real Firebase UID instead of creating a replacement identity.</p>
          </div>
        </div>

        {error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[11px] leading-5 text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200">{error}</div>}
        {message && <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[11px] leading-5 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200">{message}</div>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 rounded-xl bg-[#123B66] px-5 text-[11px] font-extrabold text-white transition hover:bg-[#0f3156] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-wait disabled:opacity-60"
          >
            {busy ? 'Creating pending profile…' : 'Pre-register member'}
          </button>
        </div>
      </form>
    </section>
  );
}
