import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { CalendarClock, CircleAlert, Inbox, ShieldCheck, UserCheck } from 'lucide-react';
import { db } from '../../lib/firebase';
import { buildLeadershipQueueMetrics } from '../../lib/leadershipQueueMetrics';
import type { Poll, UserProfile } from '../../types';

type ContactQueueRecord = {
  id: string;
  status?: 'unread' | 'read' | 'archived' | string;
};

type ExtendedPoll = Poll & {
  rosterPublished?: boolean;
  publicationMode?: 'explicit';
};

type SnapshotState = {
  users: UserProfile[];
  messages: ContactQueueRecord[];
  polls: ExtendedPoll[];
};

export default function LeadershipOverview() {
  const [state, setState] = useState<SnapshotState>({ users: [], messages: [], polls: [] });
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    let usersReady = false;
    let messagesReady = false;
    let pollsReady = false;

    const updateReady = () => {
      if (usersReady && messagesReady && pollsReady) setLoading(false);
    };

    const noteError = (label: string, error: unknown) => {
      console.error(`Leadership overview: ${label} snapshot failed`, error);
      setErrors((current) => Array.from(new Set([...current, label])));
    };

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        setState((current) => ({
          ...current,
          users: snapshot.docs.map((item) => ({ uid: item.id, ...item.data() } as UserProfile)),
        }));
        usersReady = true;
        updateReady();
      },
      (error) => {
        usersReady = true;
        noteError('members', error);
        updateReady();
      },
    );

    const unsubMessages = onSnapshot(
      collection(db, 'messages'),
      (snapshot) => {
        setState((current) => ({
          ...current,
          messages: snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as ContactQueueRecord)),
        }));
        messagesReady = true;
        updateReady();
      },
      (error) => {
        messagesReady = true;
        noteError('inquiries', error);
        updateReady();
      },
    );

    const unsubPolls = onSnapshot(
      collection(db, 'polls'),
      (snapshot) => {
        setState((current) => ({
          ...current,
          polls: snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as ExtendedPoll)),
        }));
        pollsReady = true;
        updateReady();
      },
      (error) => {
        pollsReady = true;
        noteError('liturgical planning', error);
        updateReady();
      },
    );

    return () => {
      unsubUsers();
      unsubMessages();
      unsubPolls();
    };
  }, []);

  const metrics = useMemo(() => buildLeadershipQueueMetrics(state), [state]);

  return (
    <section className="kcfc-surface overflow-hidden" aria-labelledby="leadership-overview-title">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-5 dark:border-white/10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#2563EB]">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.1em]">Read-only operations snapshot</span>
            </div>
            <h2 id="leadership-overview-title" className="mt-1 text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white">What needs leadership attention</h2>
            <p className="mt-1 text-[12px] leading-5 text-slate-500 dark:text-slate-400">A quick view of existing Portal records. This panel does not approve members, publish rosters, send messages or mutate data.</p>
          </div>
          <span className="inline-flex min-h-9 w-fit items-center gap-2 rounded-full bg-[#EAF3FF] px-3 text-[11px] font-bold text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200">
            {loading ? 'Loading queues…' : `${metrics.attentionItems} attention item${metrics.attentionItems === 1 ? '' : 's'}`}
          </span>
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4 sm:p-5">
        <QueueCard icon={UserCheck} label="Member approvals" value={metrics.pendingMembers} detail="Pending / unverified member profiles" loading={loading} attention={metrics.pendingMembers > 0} />
        <QueueCard icon={Inbox} label="Website inquiries" value={metrics.unreadInquiries} detail="Unread messages awaiting review" loading={loading} attention={metrics.unreadInquiries > 0} />
        <QueueCard icon={CalendarClock} label="Availability cycles" value={metrics.activeAvailability} detail="Active liturgical availability requests" loading={loading} />
        <QueueCard icon={CircleAlert} label="Roster review" value={metrics.unpublishedRosters} detail="Closed explicit cycles not yet published" loading={loading} attention={metrics.unpublishedRosters > 0} />
      </div>

      {errors.length > 0 && (
        <div className="mx-4 mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-[11px] leading-5 text-amber-800 sm:mx-5 sm:mb-5 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200">
          Some read-only queue counts could not be loaded ({errors.join(', ')}). The administration workspace below remains available.
        </div>
      )}
    </section>
  );
}

function QueueCard({
  icon: Icon,
  label,
  value,
  detail,
  loading,
  attention = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  detail: string;
  loading: boolean;
  attention?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200">
          <Icon className="h-5 w-5" />
        </div>
        {attention && !loading && <span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">Review</span>}
      </div>
      <p className="mt-3 text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-400">{label}</p>
      <p className="mt-1 text-[26px] font-extrabold tracking-tight text-[#172033] dark:text-white">{loading ? '—' : value}</p>
      <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}
