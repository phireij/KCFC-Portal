import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  ArrowRight,
  CalendarCheck2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Clock3,
  Edit3,
  ListChecks,
  Plus,
  RefreshCcw,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UsersRound,
  X,
} from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../App';
import { Poll, PollResponse, UserProfile } from '../types';
import { cn } from '../lib/utils';
import LegacyPolls from './LegacyPolls';

type PageMode = 'availability' | 'leader' | 'legacy';

type CreateForm = {
  title: string;
  description: string;
  endDate: string;
  massDates: { date: string; description?: string }[];
};

const memberMinistries = ['lector_commentator', 'usher', 'altar_server'];
const leaderRoles = [
  'admin',
  'president',
  'vice_president',
  'secretary',
  'auditor',
  'lector_commentator_leader',
  'usher_leader',
  'altar_server_leader',
];

const localDateTimeValue = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const parseDateValue = (value?: string): Date | null => {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value?: string, includeYear = false) => {
  const date = parseDateValue(value);
  if (!date) return value || 'Date TBA';
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
  }).format(date);
};

const formatDeadline = (value?: string) => {
  const date = parseDateValue(value);
  if (!date) return 'No deadline';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

const ministryLabel = (value: string) => {
  if (value === 'lector_commentator') return 'Lector & Commentator';
  if (value === 'usher') return 'Usher';
  if (value === 'altar_server') return 'Altar Server';
  return value.replaceAll('_', ' ');
};

const latestResponsesByUser = (responses: PollResponse[]) => {
  const map = new Map<string, PollResponse>();
  responses.forEach((response) => {
    const current = map.get(response.userId);
    const responseTime = parseDateValue(response.submittedAt)?.getTime() || 0;
    const currentTime = parseDateValue(current?.submittedAt)?.getTime() || 0;
    if (!current || responseTime >= currentTime) map.set(response.userId, response);
  });
  return map;
};

export default function Polls() {
  const { profile, user } = useAuth();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<PageMode>('availability');
  const [polls, setPolls] = useState<Poll[]>([]);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [responses, setResponses] = useState<Record<string, PollResponse[]>>({});
  const [loading, setLoading] = useState(true);
  const [draftSelections, setDraftSelections] = useState<Record<string, string[]>>({});
  const [savingPollId, setSavingPollId] = useState<string | null>(null);
  const [savedPollId, setSavedPollId] = useState<string | null>(null);
  const [expandedLeaderPoll, setExpandedLeaderPoll] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newMassDate, setNewMassDate] = useState('');
  const [newMassDescription, setNewMassDescription] = useState('');
  const [form, setForm] = useState<CreateForm>(() => ({
    title: '',
    description: 'Please select every Mass where you are available to serve in your liturgical ministry.',
    endDate: localDateTimeValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    massDates: [],
  }));

  const canLead = (profile?.roles || []).some((role) => leaderRoles.includes(role)) || profile?.email === 'kcfc.jp@gmail.com';
  const isLiturgicalMember = (profile?.ministries || []).some((ministry) => memberMinistries.includes(ministry));
  const hasLegacyPollAccess = Boolean(profile?.isCoreMember || canLead);

  useEffect(() => {
    const unsubMembers = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        setMembers(snapshot.docs.map((item) => ({ uid: item.id, ...item.data() } as UserProfile)));
      },
      (error) => console.error('Availability: failed to load members', error),
    );

    const unsubPolls = onSnapshot(
      collection(db, 'polls'),
      async (snapshot) => {
        const fetched = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Poll));
        fetched.sort((a, b) => {
          const aTime = parseDateValue(a.createdAt)?.getTime() || 0;
          const bTime = parseDateValue(b.createdAt)?.getTime() || 0;
          return bTime - aTime;
        });
        setPolls(fetched);

        const responseEntries = await Promise.all(
          fetched
            .filter((poll) => poll.category === 'committee')
            .map(async (poll) => {
              try {
                const responseSnapshot = await getDocs(collection(db, 'polls', poll.id, 'responses'));
                const raw = responseSnapshot.docs.map((item) => ({ id: item.id, ...item.data() } as PollResponse));
                return [poll.id, Array.from(latestResponsesByUser(raw).values())] as const;
              } catch (error) {
                console.error(`Availability: failed to load responses for ${poll.id}`, error);
                return [poll.id, []] as const;
              }
            }),
        );
        setResponses(Object.fromEntries(responseEntries));
        setLoading(false);
      },
      (error) => {
        console.error('Availability: failed to load polls', error);
        setLoading(false);
      },
    );

    return () => {
      unsubMembers();
      unsubPolls();
    };
  }, []);

  const myResponses = useMemo(() => {
    if (!user) return {} as Record<string, PollResponse>;
    const result: Record<string, PollResponse> = {};
    Object.entries(responses).forEach(([pollId, pollResponses]) => {
      const response = pollResponses.find((item) => item.userId === user.uid);
      if (response) result[pollId] = response;
    });
    return result;
  }, [responses, user]);

  useEffect(() => {
    setDraftSelections((current) => {
      const next = { ...current };
      Object.entries(myResponses).forEach(([pollId, response]) => {
        if (!(pollId in next)) next[pollId] = response.selectedOptions || [];
      });
      return next;
    });
  }, [myResponses]);

  useEffect(() => {
    const targetId = searchParams.get('id');
    if (!targetId || polls.length === 0) return;
    const target = polls.find((poll) => poll.id === targetId);
    if (!target) return;
    if (target.category === 'core_member') {
      setMode('legacy');
      return;
    }
    setMode('availability');
    setTimeout(() => {
      document.getElementById(`availability-${targetId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  }, [polls, searchParams]);

  const memberPolls = useMemo(() => {
    if (!isLiturgicalMember && !canLead) return [];
    return polls.filter((poll) => poll.category === 'committee' && poll.status !== 'draft');
  }, [canLead, isLiturgicalMember, polls]);

  const activeMemberPolls = useMemo(() => {
    const now = new Date();
    return memberPolls.filter((poll) => poll.status === 'active' && (!parseDateValue(poll.endDate) || parseDateValue(poll.endDate)! >= now));
  }, [memberPolls]);

  const recentMemberPolls = useMemo(() => memberPolls.filter((poll) => poll.status !== 'active').slice(0, 3), [memberPolls]);

  const eligibleMembers = useMemo(
    () => members.filter((member) =>
      member.email !== 'kcfc.jp@gmail.com' &&
      member.isVerified &&
      !member.isDisabled &&
      (member.ministries || []).some((ministry) => memberMinistries.includes(ministry)),
    ),
    [members],
  );

  const checkAndNotifyCompletion = async (poll: Poll) => {
    try {
      const responseSnapshot = await getDocs(collection(db, 'polls', poll.id, 'responses'));
      const responseMap = latestResponsesByUser(responseSnapshot.docs.map((item) => ({ id: item.id, ...item.data() } as PollResponse)));
      const allDone = eligibleMembers.length > 0 && eligibleMembers.every((member) => {
        const response = responseMap.get(member.uid);
        return response?.attendance !== null && response?.attendance !== undefined;
      });
      if (!allDone) return;

      const pollRecord = polls.find((item) => item.id === poll.id) as (Poll & { availabilityCompletionNotifiedAt?: unknown }) | undefined;
      if (pollRecord?.availabilityCompletionNotifiedAt) return;

      const leadershipRecipients = members.filter((member) =>
        (member.roles || []).some((role) => ['admin', 'president'].includes(role)),
      );
      const recipientIds = new Set<string>();
      if (poll.createdBy) recipientIds.add(poll.createdBy);
      leadershipRecipients.forEach((member) => recipientIds.add(member.uid));

      const batch = writeBatch(db);
      recipientIds.forEach((uid) => {
        const notificationRef = doc(collection(db, 'notifications'));
        batch.set(notificationRef, {
          userId: uid,
          title: 'Liturgical availability complete',
          message: `All eligible ministry members have responded to “${poll.title}”. You can close the request and begin assignment planning.`,
          type: 'system',
          status: 'unread',
          link: `/polls?id=${poll.id}`,
          createdAt: serverTimestamp(),
        });
      });
      batch.update(doc(db, 'polls', poll.id), { availabilityCompletionNotifiedAt: serverTimestamp() });
      await batch.commit();
    } catch (error) {
      console.error('Availability: completion notification failed', error);
    }
  };

  const saveAvailability = async (poll: Poll, selectedOptions: string[]) => {
    if (!user || !profile || savingPollId) return;
    const deadline = parseDateValue(poll.endDate);
    if (poll.status !== 'active' || (deadline && deadline < new Date())) return;

    setSavingPollId(poll.id);
    setSavedPollId(null);
    try {
      const existing = myResponses[poll.id];
      const responseData = {
        pollId: poll.id,
        userId: user.uid,
        userDisplayName: profile.displayName,
        attendance: selectedOptions.length > 0 ? 'yes' : 'no',
        selectedOptions,
        submittedAt: serverTimestamp(),
      };

      let responseId = existing?.id;
      if (existing?.id) {
        await updateDoc(doc(db, 'polls', poll.id, 'responses', existing.id), responseData);
      } else {
        const created = await addDoc(collection(db, 'polls', poll.id, 'responses'), responseData);
        responseId = created.id;
      }

      const optimistic: PollResponse = {
        ...responseData,
        id: responseId,
        attendance: selectedOptions.length > 0 ? 'yes' : 'no',
        submittedAt: new Date().toISOString(),
      } as PollResponse;

      setResponses((current) => {
        const currentPollResponses = current[poll.id] || [];
        const withoutMine = currentPollResponses.filter((item) => item.userId !== user.uid);
        return { ...current, [poll.id]: [...withoutMine, optimistic] };
      });
      setDraftSelections((current) => ({ ...current, [poll.id]: [...selectedOptions] }));
      setSavedPollId(poll.id);
      setTimeout(() => setSavedPollId((current) => current === poll.id ? null : current), 2500);
      await checkAndNotifyCompletion(poll);
    } catch (error) {
      console.error('Availability: failed to save response', error);
      alert('Your availability could not be saved. Please try again.');
    } finally {
      setSavingPollId(null);
    }
  };

  const toggleMassSelection = (pollId: string, date: string) => {
    setDraftSelections((current) => {
      const selected = current[pollId] || [];
      const next = selected.includes(date) ? selected.filter((item) => item !== date) : [...selected, date];
      return { ...current, [pollId]: next };
    });
  };

  const addMassDate = () => {
    if (!newMassDate || form.massDates.some((item) => item.date === newMassDate)) return;
    setForm((current) => ({
      ...current,
      massDates: [...current.massDates, { date: newMassDate, description: newMassDescription.trim() || undefined }]
        .sort((a, b) => a.date.localeCompare(b.date)),
    }));
    setNewMassDate('');
    setNewMassDescription('');
  };

  const createAvailabilityRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canLead || !user || !profile || creating) return;
    if (!form.title.trim() || !form.endDate || form.massDates.length === 0) return;

    setCreating(true);
    try {
      const created = await addDoc(collection(db, 'polls'), {
        type: 'quarterly',
        category: 'committee',
        title: form.title.trim(),
        description: form.description.trim(),
        massDates: form.massDates,
        startDate: localDateTimeValue(new Date()),
        endDate: form.endDate,
        status: 'active',
        isMultiSelect: true,
        createdBy: user.uid,
        creatorName: profile.displayName,
        completedAssignments: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const batch = writeBatch(db);
      eligibleMembers.forEach((member) => {
        const notificationRef = doc(collection(db, 'notifications'));
        batch.set(notificationRef, {
          userId: member.uid,
          title: 'New liturgical availability request',
          message: `${form.title.trim()}: please select every Mass where you are available to serve.`,
          type: 'system',
          status: 'unread',
          link: `/polls?id=${created.id}`,
          createdAt: serverTimestamp(),
        });
      });
      await batch.commit();

      setForm({
        title: '',
        description: 'Please select every Mass where you are available to serve in your liturgical ministry.',
        endDate: localDateTimeValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        massDates: [],
      });
      setShowCreate(false);
      setExpandedLeaderPoll(created.id);
    } catch (error) {
      console.error('Availability: failed to create request', error);
      alert('The availability request could not be created. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const setRequestStatus = async (poll: Poll, status: 'active' | 'closed') => {
    if (!canLead) return;
    if (status === 'closed' && !window.confirm('Close this availability request? Members will no longer be able to change their availability.')) return;
    try {
      await updateDoc(doc(db, 'polls', poll.id), { status, updatedAt: serverTimestamp() });
    } catch (error) {
      console.error('Availability: failed to update request status', error);
      alert('The request status could not be changed.');
    }
  };

  const pendingCount = activeMemberPolls.filter((poll) => !myResponses[poll.id]).length;

  return (
    <div className="kcfc-page space-y-5 pb-4">
      <section className="overflow-hidden rounded-[26px] border border-blue-100 bg-gradient-to-br from-[#123B66] via-[#174E83] to-[#2563EB] p-5 text-white shadow-[0_18px_45px_rgba(18,59,102,0.18)] sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 flex items-center gap-2 text-blue-100">
              <CalendarCheck2 className="h-4 w-4" />
              <span className="text-[11px] font-extrabold uppercase tracking-[0.13em]">Liturgical Availability</span>
            </div>
            <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[34px]">Tell us when you can serve.</h1>
            <p className="mt-2 max-w-xl text-[14px] leading-6 text-blue-50/90">
              Select every upcoming Mass where you are available. Your response becomes the availability pool used by ministry leaders when they build the final roster.
            </p>
          </div>
          <Link
            to="/duties"
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-[13px] font-bold text-[#123B66] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <CalendarDays className="h-4 w-4" />
            Browse schedule
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="kcfc-surface overflow-hidden">
        <div className="border-b border-slate-100 p-2 dark:border-white/10">
          <div className={cn('grid gap-1 rounded-2xl bg-[#F7F9FC] p-1 dark:bg-white/5', canLead ? 'grid-cols-3' : hasLegacyPollAccess ? 'grid-cols-2' : 'grid-cols-1')}>
            <ModeButton active={mode === 'availability'} onClick={() => setMode('availability')} icon={CalendarCheck2} label="My availability" badge={pendingCount || undefined} />
            {canLead && <ModeButton active={mode === 'leader'} onClick={() => setMode('leader')} icon={ShieldCheck} label="Leader view" />}
            {hasLegacyPollAccess && <ModeButton active={mode === 'legacy'} onClick={() => setMode('legacy')} icon={Settings2} label="Other polls" />}
          </div>
        </div>

        {mode === 'availability' && (
          <div>
            <div className="border-b border-slate-100 px-4 py-4 sm:px-5 dark:border-white/10">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white">Your availability requests</h2>
                  <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">Tap the dates you can serve, then save once.</p>
                </div>
                {pendingCount > 0 && (
                  <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-[11px] font-extrabold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">{pendingCount} response {pendingCount === 1 ? 'needed' : 'needed'}</span>
                )}
              </div>
            </div>

            {loading ? (
              <LoadingCards />
            ) : activeMemberPolls.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title={isLiturgicalMember || canLead ? 'You are up to date' : 'No liturgical availability requests for you'}
                body={isLiturgicalMember || canLead ? 'There is no active request waiting for your response.' : 'If you join Lector & Commentator, Ushers or Altar Servers, relevant availability requests will appear here.'}
              />
            ) : (
              <div className="space-y-4 p-4 sm:p-5">
                {activeMemberPolls.map((poll) => (
                  <AvailabilityCard
                    key={poll.id}
                    poll={poll}
                    response={myResponses[poll.id]}
                    selected={draftSelections[poll.id] || []}
                    saving={savingPollId === poll.id}
                    saved={savedPollId === poll.id}
                    onToggle={(date) => toggleMassSelection(poll.id, date)}
                    onSave={(selected) => saveAvailability(poll, selected)}
                  />
                ))}
              </div>
            )}

            {recentMemberPolls.length > 0 && (
              <div className="border-t border-slate-100 px-4 py-5 sm:px-5 dark:border-white/10">
                <h3 className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-slate-400">Recent requests</h3>
                <div className="mt-3 space-y-2">
                  {recentMemberPolls.map((poll) => {
                    const response = myResponses[poll.id];
                    return (
                      <div key={poll.id} className="flex items-center gap-3 rounded-2xl border border-slate-200/80 p-3.5 dark:border-white/10">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-300">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-bold text-[#172033] dark:text-white">{poll.title}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{response ? `${response.selectedOptions?.length || 0} available Masses submitted` : 'No response recorded'} • {poll.status === 'closed' ? 'Closed' : poll.status}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {mode === 'leader' && canLead && (
          <div>
            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-white/10">
              <div>
                <h2 className="text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white">Availability planning</h2>
                <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">Create requests, watch response progress and hand closed cycles to assignment planning.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate((value) => !value)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#123B66] px-4 text-[12px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {showCreate ? 'Close form' : 'Create request'}
              </button>
            </div>

            {showCreate && (
              <CreateAvailabilityForm
                form={form}
                setForm={setForm}
                newMassDate={newMassDate}
                setNewMassDate={setNewMassDate}
                newMassDescription={newMassDescription}
                setNewMassDescription={setNewMassDescription}
                addMassDate={addMassDate}
                creating={creating}
                onSubmit={createAvailabilityRequest}
              />
            )}

            <div className="space-y-3 p-4 sm:p-5">
              {polls.filter((poll) => poll.category === 'committee').map((poll) => {
                const pollResponses = responses[poll.id] || [];
                const latest = latestResponsesByUser(pollResponses);
                const responded = eligibleMembers.filter((member) => latest.has(member.uid));
                const percent = eligibleMembers.length ? Math.round((responded.length / eligibleMembers.length) * 100) : 0;
                const expanded = expandedLeaderPoll === poll.id;
                return (
                  <article key={poll.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03]">
                    <button
                      type="button"
                      onClick={() => setExpandedLeaderPoll(expanded ? null : poll.id)}
                      className="flex min-h-[86px] w-full items-center gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                    >
                      <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', poll.status === 'active' ? 'bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200' : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-300')}>
                        <UsersRound className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-[14px] font-extrabold text-[#172033] dark:text-white">{poll.title}</p>
                          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide', poll.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300' : poll.status === 'draft' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-300')}>{poll.status}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                            <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${percent}%` }} />
                          </div>
                          <span className="shrink-0 text-[11px] font-bold text-slate-500 dark:text-slate-400">{responded.length}/{eligibleMembers.length}</span>
                        </div>
                      </div>
                      {expanded ? <ChevronUp className="h-5 w-5 shrink-0 text-slate-400" /> : <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" />}
                    </button>

                    {expanded && (
                      <div className="border-t border-slate-100 p-4 dark:border-white/10">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <LeaderMetric label="Response progress" value={`${percent}%`} detail={`${responded.length} of ${eligibleMembers.length} eligible members`} />
                          <LeaderMetric label="Mass dates" value={String(poll.massDates?.length || (poll.massDate ? 1 : 0))} detail="Included in this availability cycle" />
                          <LeaderMetric label="Deadline" value={formatDeadline(poll.endDate)} detail={poll.status === 'active' ? 'Members can still update responses' : 'Response window closed'} />
                        </div>

                        <div className="mt-4 rounded-2xl bg-[#F7F9FC] p-3.5 dark:bg-white/5">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[12px] font-extrabold text-[#172033] dark:text-white">Response status</p>
                              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Who has responded and how many Masses they selected.</p>
                            </div>
                          </div>
                          <div className="mt-3 grid gap-2 lg:grid-cols-2">
                            {eligibleMembers.map((member) => {
                              const response = latest.get(member.uid);
                              return (
                                <div key={member.uid} className="flex items-center gap-3 rounded-xl bg-white p-3 dark:bg-white/5">
                                  <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', response ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300')}>
                                    {response ? <Check className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-[12px] font-bold text-[#172033] dark:text-white">{member.displayName}</p>
                                    <p className="mt-0.5 truncate text-[10px] text-slate-500 dark:text-slate-400">{(member.ministries || []).filter((ministry) => memberMinistries.includes(ministry)).map(ministryLabel).join(' • ') || 'Liturgical ministry'}</p>
                                  </div>
                                  <span className="shrink-0 text-[10px] font-bold text-slate-400">{response ? `${response.selectedOptions?.length || 0} dates` : 'Waiting'}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {poll.status === 'active' ? (
                            <button type="button" onClick={() => setRequestStatus(poll, 'closed')} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#123B66] px-3.5 text-[11px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                              <CheckCircle2 className="h-4 w-4" /> Close request
                            </button>
                          ) : poll.status === 'closed' ? (
                            <button type="button" onClick={() => setRequestStatus(poll, 'active')} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3.5 text-[11px] font-bold text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-white/10 dark:text-slate-300">
                              <RefreshCcw className="h-4 w-4" /> Reopen
                            </button>
                          ) : null}
                          <Link to={`/duties?tab=liturgical&pollId=${poll.id}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#EAF3FF] px-3.5 text-[11px] font-bold text-[#123B66] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-blue-500/15 dark:text-blue-200">
                            <ListChecks className="h-4 w-4" /> Assignment workspace
                          </Link>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {mode === 'legacy' && hasLegacyPollAccess && (
          <div>
            <div className="border-b border-slate-100 px-4 py-4 sm:px-5 dark:border-white/10">
              <h2 className="text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white">Chore & legacy poll tools</h2>
              <p className="mt-1 text-[13px] leading-5 text-slate-500 dark:text-slate-400">The previous poll workspace is preserved here so chore attendance and older workflows remain available during redevelopment.</p>
            </div>
            <div className="p-2 sm:p-4">
              <LegacyPolls />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon: Icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex min-h-12 items-center justify-center gap-2 rounded-xl px-2 text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:text-[13px]',
        active
          ? 'bg-white text-[#123B66] shadow-sm ring-1 ring-slate-200/70 dark:bg-[#123B66] dark:text-white dark:ring-blue-300/10'
          : 'text-slate-500 hover:text-[#123B66] dark:text-slate-400 dark:hover:text-white',
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      <span className="line-clamp-1">{label}</span>
      {badge ? <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-extrabold text-white">{badge}</span> : null}
    </button>
  );
}

function AvailabilityCard({
  poll,
  response,
  selected,
  saving,
  saved,
  onToggle,
  onSave,
}: {
  poll: Poll;
  response?: PollResponse;
  selected: string[];
  saving: boolean;
  saved: boolean;
  onToggle: (date: string) => void;
  onSave: (selected: string[]) => void;
}) {
  const original = response?.selectedOptions || [];
  const normalizedOriginal = [...original].sort();
  const normalizedSelected = [...selected].sort();
  const dirty = JSON.stringify(normalizedOriginal) !== JSON.stringify(normalizedSelected) || !response;
  const deadline = parseDateValue(poll.endDate);
  const expired = Boolean(deadline && deadline < new Date());
  const dates = poll.massDates?.length ? poll.massDates : poll.massDate ? [{ date: poll.massDate, description: poll.description }] : [];

  return (
    <article id={`availability-${poll.id}`} className={cn('overflow-hidden rounded-[22px] border bg-white dark:bg-white/[0.03]', response ? 'border-green-200 dark:border-green-400/20' : 'border-blue-200 dark:border-blue-400/20')}>
      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide', response ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300' : 'bg-blue-100 text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200')}>
                {response ? 'Submitted' : 'Response needed'}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400"><Clock3 className="h-3.5 w-3.5" /> Due {formatDeadline(poll.endDate)}</span>
            </div>
            <h3 className="mt-3 text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white">{poll.title}</h3>
            {poll.description && <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-slate-500 dark:text-slate-400">{poll.description}</p>}
          </div>
          {response && (
            <div className="flex items-center gap-2 text-[11px] font-bold text-green-700 dark:text-green-300">
              <CheckCircle2 className="h-4 w-4" />
              {selected.length ? `${selected.length} Masses selected` : 'Unavailable for listed dates'}
            </div>
          )}
        </div>

        <div className="mt-4">
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-400">Select every Mass you can serve</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {dates.map((item) => {
              const checked = selected.includes(item.date);
              return (
                <button
                  key={item.date}
                  type="button"
                  onClick={() => !expired && onToggle(item.date)}
                  disabled={expired}
                  className={cn(
                    'flex min-h-[72px] items-center gap-3 rounded-2xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60',
                    checked
                      ? 'border-[#2563EB] bg-[#EAF3FF] text-[#123B66] dark:border-blue-400/50 dark:bg-blue-500/15 dark:text-blue-100'
                      : 'border-slate-200 bg-white text-[#172033] hover:border-blue-200 hover:bg-blue-50/30 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-blue-500/10',
                  )}
                >
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border', checked ? 'border-[#2563EB] bg-[#2563EB] text-white' : 'border-slate-200 bg-white text-transparent dark:border-white/15 dark:bg-white/5')}>
                    <Check className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-extrabold">{formatDate(item.date)}</p>
                    <p className={cn('mt-0.5 truncate text-[11px]', checked ? 'text-blue-700 dark:text-blue-200' : 'text-slate-500 dark:text-slate-400')}>{item.description || 'Holy Mass'}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 rounded-2xl bg-[#F7F9FC] p-3.5 sm:flex-row sm:items-center sm:justify-between dark:bg-white/5">
          <div>
            <p className="text-[12px] font-bold text-[#172033] dark:text-white">{selected.length ? `Available for ${selected.length} ${selected.length === 1 ? 'Mass' : 'Masses'}` : 'Not available for any listed Mass'}</p>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">You can change this response until the deadline.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {selected.length > 0 && !expired && (
              <button type="button" onClick={() => onSave([])} disabled={saving} className="min-h-10 rounded-xl px-3 text-[11px] font-bold text-slate-500 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-400 dark:hover:bg-white/5">
                I am unavailable for all
              </button>
            )}
            <button
              type="button"
              onClick={() => onSave(selected)}
              disabled={saving || expired || !dirty}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#123B66] px-4 text-[11px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              {saving ? <RefreshCcw className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle2 className="h-4 w-4" /> : response ? <Edit3 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              {saving ? 'Saving…' : saved ? 'Saved' : response ? 'Save changes' : 'Submit availability'}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function CreateAvailabilityForm({
  form,
  setForm,
  newMassDate,
  setNewMassDate,
  newMassDescription,
  setNewMassDescription,
  addMassDate,
  creating,
  onSubmit,
}: {
  form: CreateForm;
  setForm: React.Dispatch<React.SetStateAction<CreateForm>>;
  newMassDate: string;
  setNewMassDate: (value: string) => void;
  newMassDescription: string;
  setNewMassDescription: (value: string) => void;
  addMassDate: () => void;
  creating: boolean;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="border-b border-slate-100 bg-blue-50/40 p-4 sm:p-5 dark:border-white/10 dark:bg-blue-500/5">
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Request title</span>
          <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required placeholder="e.g. Q4 Liturgical Ministry Availability" className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[13px] text-[#172033] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:ring-blue-500/20" />
        </label>
        <label className="space-y-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Response deadline</span>
          <input type="datetime-local" value={form.endDate} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} required className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[13px] text-[#172033] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:ring-blue-500/20" />
        </label>
      </div>

      <label className="mt-4 block space-y-1.5">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Instructions</span>
        <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={3} className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[13px] leading-5 text-[#172033] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:ring-blue-500/20" />
      </label>

      <div className="mt-4">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Mass dates</span>
        <div className="mt-2 grid gap-2 lg:grid-cols-[180px_1fr_auto]">
          <input type="date" value={newMassDate} onChange={(event) => setNewMassDate(event.target.value)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-[#172033] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-white/5 dark:text-white" />
          <input value={newMassDescription} onChange={(event) => setNewMassDescription(event.target.value)} placeholder="Description, e.g. 3:00 PM English Mass" className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-[#172033] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-white/5 dark:text-white" />
          <button type="button" onClick={addMassDate} disabled={!newMassDate} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 text-[11px] font-bold text-[#123B66] disabled:opacity-40 dark:border-blue-400/20 dark:bg-white/5 dark:text-blue-200"><Plus className="h-4 w-4" /> Add date</button>
        </div>

        {form.massDates.length > 0 && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {form.massDates.map((item) => (
              <div key={item.date} className="flex items-center gap-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200/70 dark:bg-white/5 dark:ring-white/10">
                <CalendarDays className="h-4 w-4 shrink-0 text-[#2563EB]" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold text-[#172033] dark:text-white">{formatDate(item.date)}</p>
                  <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">{item.description || 'Holy Mass'}</p>
                </div>
                <button type="button" onClick={() => setForm((current) => ({ ...current, massDates: current.massDates.filter((date) => date.date !== item.date) }))} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"><X className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 text-[11px] leading-4 text-slate-500 dark:text-slate-400"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#D6A84B]" /> Publishing this request creates Portal notifications for verified members of Lector & Commentator, Ushers and Altar Servers.</div>
        <button type="submit" disabled={creating || !form.title.trim() || !form.endDate || form.massDates.length === 0} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#123B66] px-4 text-[12px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          {creating ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {creating ? 'Publishing…' : 'Publish request'}
        </button>
      </div>
    </form>
  );
}

function LeaderMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl bg-[#F7F9FC] p-3.5 dark:bg-white/5">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-400">{label}</p>
      <p className="mt-1 text-[15px] font-extrabold text-[#172033] dark:text-white">{value}</p>
      <p className="mt-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}

function LoadingCards() {
  return <div className="space-y-3 p-4 sm:p-5">{[0, 1].map((item) => <div key={item} className="h-56 animate-pulse rounded-[22px] bg-slate-100 dark:bg-white/5" />)}</div>;
}

function EmptyState({ icon: Icon, title, body }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <div className="px-5 py-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200"><Icon className="h-6 w-6" /></div>
      <h3 className="mt-4 text-[16px] font-extrabold text-[#172033] dark:text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-5 text-slate-500 dark:text-slate-400">{body}</p>
    </div>
  );
}
