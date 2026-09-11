import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Clock3,
  Filter,
  ListChecks,
  RotateCcw,
  Search,
  Sparkles,
  UserCheck,
  UsersRound,
} from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../App';
import { DutyAssignment, Poll, UserProfile } from '../types';
import { cn } from '../lib/utils';
import LegacyDuties from './LegacyDuties';

type ScheduleView = 'all' | 'mine' | 'manage';
type ScheduleScope = 'upcoming' | 'all';
type MinistryFilter = 'all' | 'mine' | 'lector' | 'usher' | 'altar';
type PersonalScope = 'upcoming' | 'history';
type ExtendedPoll = Poll & {
  rosterPublished?: boolean;
  rosterPublishedAt?: unknown;
  publicationMode?: 'explicit';
};

type RosterAssignment = {
  userId: string;
  displayName: string;
  role: string;
  ministry: 'Lector & Commentator' | 'Ushers' | 'Altar Servers' | 'Other';
  isCurrentUser: boolean;
};

type ScheduleEvent = {
  key: string;
  dateValue: string;
  parsedDate: Date | null;
  title: string;
  description?: string;
  pollId: string;
  rosterPublished: boolean;
  assignments: RosterAssignment[];
};

type PersonalAssignment = {
  key: string;
  dateValue: string;
  parsedDate: Date | null;
  title: string;
  role: string;
  detail?: string;
  kind: 'liturgical' | 'community';
};

const leadershipRoles = [
  'admin', 'president', 'vice_president', 'secretary', 'auditor',
  'lector_commentator_leader', 'usher_leader', 'altar_server_leader',
  'choir_a_leader', 'choir_b_leader', 'kitchen_leader', 'kitchen_sub_leader',
  'cleaning_leader', 'cleaning_sub_leader',
];

const parseScheduleDate = (value?: string): Date | null => {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfToday = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
};

const formatLongDate = (date: Date | null, fallback: string) => {
  if (!date) return fallback;
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(date);
};

const formatShortDate = (date: Date | null, fallback: string) => {
  if (!date) return fallback;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
};

const formatMonthHeading = (date: Date | null) => {
  if (!date) return 'Schedule';
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(date);
};

const roleToMinistry = (role: string): RosterAssignment['ministry'] => {
  const normalized = role.toLowerCase();
  if (normalized.includes('lector') || normalized.includes('commentator')) return 'Lector & Commentator';
  if (normalized.includes('usher')) return 'Ushers';
  if (normalized.includes('altar')) return 'Altar Servers';
  return 'Other';
};

const dutyTypeLabel = (type: DutyAssignment['type']) => {
  if (type === 'kitchen') return 'Kitchen Duty';
  if (type === 'cleaning') return 'Cleaning Duty';
  return 'Ministry Duty';
};

const profileMinistryLabel = (ministry: string) => {
  if (ministry === 'lector_commentator') return 'Lector & Commentator';
  if (ministry === 'usher') return 'Usher';
  if (ministry === 'altar_server') return 'Altar Server';
  return ministry.replaceAll('_', ' ');
};

const isRosterPublished = (poll: ExtendedPoll) => {
  if (poll.publicationMode === 'explicit') return poll.rosterPublished === true;
  const completed = poll.completedAssignments || [];
  return poll.status === 'closed' && ['lector', 'altar_server', 'usher'].every((ministry) => completed.includes(ministry));
};

const eventMatchesMinistry = (event: ScheduleEvent, filter: MinistryFilter, userId?: string) => {
  if (filter === 'all') return true;
  if (filter === 'mine') return Boolean(userId && event.assignments.some((assignment) => assignment.userId === userId));
  if (filter === 'lector') return event.assignments.some((assignment) => assignment.ministry === 'Lector & Commentator');
  if (filter === 'usher') return event.assignments.some((assignment) => assignment.ministry === 'Ushers');
  return event.assignments.some((assignment) => assignment.ministry === 'Altar Servers');
};

export default function Duties() {
  const { profile, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get('view');
  const [view, setView] = useState<ScheduleView>(() => {
    if (requestedView === 'all' || requestedView === 'mine' || requestedView === 'manage') return requestedView;
    if (searchParams.get('tab') || searchParams.get('pollId')) return 'manage';
    return 'all';
  });
  const [scope, setScope] = useState<ScheduleScope>('upcoming');
  const [ministryFilter, setMinistryFilter] = useState<MinistryFilter>('all');
  const [personalScope, setPersonalScope] = useState<PersonalScope>('upcoming');
  const [scheduleSearch, setScheduleSearch] = useState('');
  const [polls, setPolls] = useState<ExtendedPoll[]>([]);
  const [duties, setDuties] = useState<DutyAssignment[]>([]);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const isLeader = (profile?.roles || []).some((role) => leadershipRoles.includes(role));

  useEffect(() => {
    if (requestedView === 'all' || requestedView === 'mine' || requestedView === 'manage') {
      setView(requestedView);
    } else if (searchParams.get('tab') || searchParams.get('pollId')) {
      setView('manage');
    } else {
      setView('all');
    }
  }, [requestedView, searchParams]);

  const selectView = (nextView: ScheduleView) => {
    setView(nextView);
    setSearchParams((currentParams) => {
      const nextParams = new URLSearchParams(currentParams);
      nextParams.set('view', nextView);
      if (nextView !== 'manage') {
        nextParams.delete('tab');
        nextParams.delete('pollId');
      }
      return nextParams;
    });
  };

  useEffect(() => {
    let pendingSources = 3;
    const markLoaded = () => { pendingSources -= 1; if (pendingSources <= 0) setLoading(false); };
    const unsubPolls = onSnapshot(collection(db, 'polls'), (snapshot) => {
      setPolls(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as ExtendedPoll))); markLoaded();
    }, (error) => { console.error('Schedule: failed to load polls', error); markLoaded(); });
    const unsubDuties = onSnapshot(collection(db, 'duties'), (snapshot) => {
      setDuties(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as DutyAssignment))); markLoaded();
    }, (error) => { console.error('Schedule: failed to load duties', error); markLoaded(); });
    const unsubMembers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setMembers(snapshot.docs.map((item) => ({ uid: item.id, ...item.data() } as UserProfile))); markLoaded();
    }, (error) => { console.error('Schedule: failed to load member names', error); markLoaded(); });
    return () => { unsubPolls(); unsubDuties(); unsubMembers(); };
  }, []);

  const membersById = useMemo(() => {
    const map = new Map<string, UserProfile>();
    members.forEach((member) => map.set(member.uid, member));
    return map;
  }, [members]);

  const scheduleEvents = useMemo<ScheduleEvent[]>(() => {
    const events: ScheduleEvent[] = [];
    polls.filter((poll) => poll.category === 'committee' && poll.status !== 'draft').forEach((poll) => {
      const options = poll.massDates?.length ? poll.massDates : poll.massDate ? [{ date: poll.massDate, description: poll.description }] : [];
      const rosterPublished = isRosterPublished(poll);
      options.forEach((option, index) => {
        const assignmentMap = poll.assignments?.[option.date] || {};
        const assignments = rosterPublished ? Object.entries(assignmentMap).map(([userId, role]) => ({
          userId,
          displayName: membersById.get(userId)?.displayName || 'KCFC Member',
          role,
          ministry: roleToMinistry(role),
          isCurrentUser: userId === user?.uid,
        })).filter((assignment) => assignment.ministry !== 'Other').sort((a, b) => a.ministry.localeCompare(b.ministry) || a.role.localeCompare(b.role)) : [];
        events.push({
          key: `${poll.id}-${option.date}-${index}`,
          dateValue: option.date,
          parsedDate: parseScheduleDate(option.date),
          title: option.description || poll.title || 'KCFC Mass',
          description: option.description ? poll.title : poll.description,
          pollId: poll.id,
          rosterPublished,
          assignments,
        });
      });
    });
    return events.sort((a, b) => (a.parsedDate?.getTime() || Number.MAX_SAFE_INTEGER) - (b.parsedDate?.getTime() || Number.MAX_SAFE_INTEGER));
  }, [polls, membersById, user?.uid]);

  const visibleScheduleEvents = useMemo(() => {
    const today = startOfToday();
    const queryText = scheduleSearch.trim().toLowerCase();
    return scheduleEvents.filter((event) => {
      if (scope === 'upcoming' && event.parsedDate && event.parsedDate < today) return false;
      if (!eventMatchesMinistry(event, ministryFilter, user?.uid)) return false;
      if (!queryText) return true;
      const haystack = [event.title, event.description || '', formatLongDate(event.parsedDate, event.dateValue), ...event.assignments.flatMap((assignment) => [assignment.displayName, assignment.role, assignment.ministry])].join(' ').toLowerCase();
      return haystack.includes(queryText);
    });
  }, [scheduleEvents, scope, ministryFilter, scheduleSearch, user?.uid]);

  const personalAssignments = useMemo<PersonalAssignment[]>(() => {
    if (!user) return [];
    const liturgical = scheduleEvents.flatMap((event) => event.assignments.filter((assignment) => assignment.userId === user.uid).map((assignment) => ({
      key: `${event.key}-${assignment.role}`,
      dateValue: event.dateValue,
      parsedDate: event.parsedDate,
      title: event.title,
      role: assignment.role,
      detail: assignment.ministry,
      kind: 'liturgical' as const,
    })));
    const community = duties.filter((duty) => duty.userId === user.uid).map((duty) => ({
      key: duty.id || `${duty.userId}-${duty.date}-${duty.type}`,
      dateValue: duty.date,
      parsedDate: parseScheduleDate(duty.date),
      title: dutyTypeLabel(duty.type),
      role: duty.slot || dutyTypeLabel(duty.type),
      detail: duty.completed === 'done' ? 'Completed' : duty.completed === 'not_done' ? 'Needs follow-up' : 'Assigned',
      kind: 'community' as const,
    }));
    return [...liturgical, ...community].sort((a, b) => (a.parsedDate?.getTime() || Number.MAX_SAFE_INTEGER) - (b.parsedDate?.getTime() || Number.MAX_SAFE_INTEGER));
  }, [duties, scheduleEvents, user]);

  const today = startOfToday();
  const upcomingPersonalAssignments = personalAssignments.filter((item) => !item.parsedDate || item.parsedDate >= today);
  const historicalPersonalAssignments = [...personalAssignments.filter((item) => item.parsedDate && item.parsedDate < today)].reverse();
  const visiblePersonalAssignments = personalScope === 'upcoming' ? upcomingPersonalAssignments : historicalPersonalAssignments;
  const nextScheduleEvent = scheduleEvents.find((event) => !event.parsedDate || event.parsedDate >= today);
  const nextPersonalAssignment = upcomingPersonalAssignments[0];

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, ScheduleEvent[]>();
    visibleScheduleEvents.forEach((event) => {
      const key = formatMonthHeading(event.parsedDate);
      groups.set(key, [...(groups.get(key) || []), event]);
    });
    return Array.from(groups.entries());
  }, [visibleScheduleEvents]);

  const clearFilters = () => { setScheduleSearch(''); setMinistryFilter('all'); setScope('upcoming'); };
  const filtered = Boolean(scheduleSearch.trim() || ministryFilter !== 'all' || scope !== 'upcoming');

  return (
    <div className="kcfc-page space-y-5 pb-3">
      <section className="overflow-hidden rounded-[24px] border border-blue-100 bg-gradient-to-br from-[#123B66] via-[#164A7D] to-[#2563EB] px-5 py-6 text-white shadow-[0_18px_45px_rgba(18,59,102,0.18)] sm:px-7 sm:py-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl"><div className="mb-2 flex items-center gap-2 text-blue-100"><CalendarDays className="h-4 w-4" /><span className="text-[12px] font-extrabold uppercase tracking-[0.13em]">KCFC Schedule</span></div><h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.025em] sm:text-[34px]">Your service. Your ministry. One clear schedule.</h1><p className="mt-2 max-w-xl text-[14px] leading-6 text-blue-50/90 sm:text-[15px]">Browse the whole KCFC schedule, quickly find your own assignments, and see only rosters that leaders have explicitly published.</p></div>
          <Link to="/polls" className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-[13px] font-bold text-[#123B66] shadow-sm"><ClipboardCheck className="h-4 w-4" />Availability requests<ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <SummaryCard icon={CalendarDays} label="Next KCFC Mass" value={nextScheduleEvent ? formatShortDate(nextScheduleEvent.parsedDate, nextScheduleEvent.dateValue) : 'No upcoming date'} detail={nextScheduleEvent?.title || 'New Mass dates will appear here.'} />
        <SummaryCard icon={UserCheck} label="My next assignment" value={nextPersonalAssignment ? formatShortDate(nextPersonalAssignment.parsedDate, nextPersonalAssignment.dateValue) : 'You are clear'} detail={nextPersonalAssignment ? `${nextPersonalAssignment.role} • ${nextPersonalAssignment.title}` : 'No upcoming published assignment.'} accent={Boolean(nextPersonalAssignment)} />
        <SummaryCard icon={UsersRound} label="My ministries" value={(profile?.ministries || []).length ? `${profile?.ministries.length} active` : 'Not set'} detail={(profile?.ministries || []).length ? (profile?.ministries || []).map(profileMinistryLabel).join(' • ') : 'Update your profile when a ministry is assigned.'} />
      </section>

      <section className="kcfc-surface overflow-hidden">
        <div className="border-b border-slate-200/80 p-2 dark:border-white/10"><div className="grid grid-cols-3 gap-1 rounded-2xl bg-[#F7F9FC] p-1 dark:bg-white/5"><ViewButton active={view === 'all'} onClick={() => selectView('all')} icon={CalendarDays} label="All schedule" /><ViewButton active={view === 'mine'} onClick={() => selectView('mine')} icon={UserCheck} label="My ministry" /><ViewButton active={view === 'manage'} onClick={() => selectView('manage')} icon={ListChecks} label={isLeader ? 'Plan & manage' : 'Availability & duties'} /></div></div>

        {view === 'all' && (
          <div>
            <div className="space-y-3 border-b border-slate-100 px-4 py-4 sm:px-5 dark:border-white/10">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white">Whole KCFC schedule</h2><p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">Search by Mass, member, ministry or role. Open a Mass to view its published roster.</p></div><div className="flex w-fit items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/5"><Filter className="ml-2 h-4 w-4 text-slate-400" /><ScopeButton active={scope === 'upcoming'} onClick={() => setScope('upcoming')} label="Upcoming" /><ScopeButton active={scope === 'all'} onClick={() => setScope('all')} label="All" /></div></div>
              <div className="flex flex-col gap-2 xl:flex-row xl:items-center"><div className="relative flex-1"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={scheduleSearch} onChange={(event) => setScheduleSearch(event.target.value)} placeholder="Search schedule, member or role…" className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-[13px] text-[#172033] outline-none focus:border-blue-400 dark:border-white/10 dark:bg-white/5 dark:text-white" /></div><div className="flex flex-wrap gap-1.5"><FilterChip active={ministryFilter === 'all'} onClick={() => setMinistryFilter('all')} label="All ministries" /><FilterChip active={ministryFilter === 'mine'} onClick={() => setMinistryFilter('mine')} label="Where I serve" /><FilterChip active={ministryFilter === 'lector'} onClick={() => setMinistryFilter('lector')} label="Lector & Commentator" /><FilterChip active={ministryFilter === 'usher'} onClick={() => setMinistryFilter('usher')} label="Ushers" /><FilterChip active={ministryFilter === 'altar'} onClick={() => setMinistryFilter('altar')} label="Altar Servers" /></div>{filtered && <button type="button" onClick={clearFilters} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-[11px] font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"><RotateCcw className="h-3.5 w-3.5" /> Reset</button>}</div>
            </div>

            {loading ? <ScheduleLoading /> : groupedEvents.length === 0 ? <EmptyState icon={CalendarDays} title={filtered ? 'No schedule matches these filters' : 'No schedule published yet'} body={filtered ? 'Try clearing a ministry filter or changing your search.' : 'Mass dates will appear here as availability cycles are created.'} action={filtered ? <button type="button" onClick={clearFilters} className="mt-4 rounded-xl bg-[#123B66] px-4 py-2.5 text-[11px] font-bold text-white">Clear filters</button> : undefined} /> : (
              <div className="divide-y divide-slate-100 dark:divide-white/10">{groupedEvents.map(([month, events]) => <div key={month} className="px-4 py-5 sm:px-5"><div className="mb-3 flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-[#2563EB]" /><h3 className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-[#123B66] dark:text-blue-200">{month}</h3><span className="text-[12px] text-slate-400">{events.length} {events.length === 1 ? 'date' : 'dates'}</span></div><div className="space-y-2.5">{events.map((event) => <ScheduleCard key={event.key} event={event} expanded={expandedEvent === event.key} onToggle={() => setExpandedEvent(expandedEvent === event.key ? null : event.key)} />)}</div></div>)}</div>
            )}
          </div>
        )}

        {view === 'mine' && (
          <div>
            <div className="border-b border-slate-100 px-4 py-4 sm:px-5 dark:border-white/10"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-[#D6A84B]" /><h2 className="text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white">My ministry schedule</h2></div><p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">Your published liturgical assignments and community duties, without roster noise.</p></div><div className="flex w-fit rounded-xl bg-slate-100 p-1 dark:bg-white/5"><ScopeButton active={personalScope === 'upcoming'} onClick={() => setPersonalScope('upcoming')} label="Upcoming" /><ScopeButton active={personalScope === 'history'} onClick={() => setPersonalScope('history')} label="History" /></div></div></div>
            {loading ? <ScheduleLoading /> : visiblePersonalAssignments.length === 0 ? <EmptyState icon={CheckCircle2} title={personalScope === 'upcoming' ? 'No upcoming assignment' : 'No assignment history yet'} body={personalScope === 'upcoming' ? 'You currently have no published ministry or community-duty assignment.' : 'Past published assignments will appear here.'} /> : <div className="p-4 sm:p-5"><div className="relative ml-4 border-l-2 border-blue-100 pl-6 dark:border-blue-400/20">{visiblePersonalAssignments.map((assignment, index) => <article key={assignment.key} className={cn('relative pb-5', index === visiblePersonalAssignments.length - 1 && 'pb-0')}><div className="absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-[3px] border-white bg-[#2563EB] dark:border-[#10243a]" /><div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]"><p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#2563EB]">{formatLongDate(assignment.parsedDate, assignment.dateValue)}</p><h3 className="mt-1 text-[16px] font-extrabold text-[#172033] dark:text-white">{assignment.role}</h3><p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">{assignment.title}</p><span className={cn('mt-3 inline-flex rounded-full px-3 py-1 text-[11px] font-bold', assignment.kind === 'liturgical' ? 'bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300')}>{assignment.detail || (assignment.kind === 'liturgical' ? 'Liturgical Ministry' : 'Community Duty')}</span></div></article>)}</div></div>}
          </div>
        )}

        {view === 'manage' && (
          <div><div className="border-b border-slate-100 px-4 py-4 sm:px-5 dark:border-white/10"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200"><BookOpen className="h-5 w-5" /></div><div><h2 className="text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white">{isLeader ? 'Availability, planning & legacy duties' : 'Availability & duties'}</h2><p className="mt-1 text-[13px] leading-5 text-slate-500 dark:text-slate-400">{isLeader ? 'Use the new Availability leader view for response matrix, assignments and final publication. The detailed legacy workspace remains below for compatibility.' : 'Respond to availability requests and review your detailed duty workspace here.'}</p>{isLeader && <Link to="/polls?leader=1" className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#123B66] px-3.5 text-[11px] font-bold text-white"><ListChecks className="h-4 w-4" />Open new planning workspace</Link>}</div></div></div><div className="p-2 sm:p-4"><LegacyDuties /></div></div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, detail, accent = false }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; detail: string; accent?: boolean }) { return <article className={cn('kcfc-surface p-4 sm:p-5', accent && 'border-blue-200 bg-blue-50/40 dark:border-blue-400/20 dark:bg-blue-500/10')}><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200"><Icon className="h-5 w-5" /></div><div className="min-w-0"><p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-400">{label}</p><p className="mt-1 truncate text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white">{value}</p><p className="mt-1 line-clamp-2 text-[12px] leading-5 text-slate-500 dark:text-slate-400">{detail}</p></div></div></article>; }
function ViewButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string }) { return <button type="button" onClick={onClick} className={cn('flex min-h-12 items-center justify-center gap-2 rounded-xl px-2 text-[12px] font-bold sm:text-[13px]', active ? 'bg-white text-[#123B66] shadow-sm ring-1 ring-slate-200/70 dark:bg-[#123B66] dark:text-white' : 'text-slate-500 dark:text-slate-400')}><Icon className="h-[18px] w-[18px]" /><span className="line-clamp-1">{label}</span></button>; }
function ScopeButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) { return <button type="button" onClick={onClick} className={cn('min-h-9 rounded-lg px-3 text-[10px] font-bold', active ? 'bg-white text-[#123B66] shadow-sm dark:bg-[#123B66] dark:text-white' : 'text-slate-500 dark:text-slate-400')}>{label}</button>; }
function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) { return <button type="button" onClick={onClick} className={cn('min-h-9 rounded-full border px-3 text-[10px] font-bold', active ? 'border-blue-200 bg-[#EAF3FF] text-[#123B66] dark:border-blue-400/20 dark:bg-blue-500/15 dark:text-blue-200' : 'border-slate-200 bg-white text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300')}>{label}</button>; }

function ScheduleCard({ event, expanded, onToggle }: { event: ScheduleEvent; expanded: boolean; onToggle: () => void }) {
  const mine = event.assignments.filter((assignment) => assignment.isCurrentUser);
  return <article className={cn('overflow-hidden rounded-2xl border', mine.length ? 'border-blue-200 bg-blue-50/35 dark:border-blue-400/20 dark:bg-blue-500/10' : 'border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03]')}><button type="button" onClick={onToggle} className="flex min-h-[76px] w-full items-center gap-3 px-3.5 py-3 text-left sm:px-4"><DateTile date={event.parsedDate} fallback={event.dateValue} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-[14px] font-extrabold text-[#172033] dark:text-white sm:text-[15px]">{event.title}</p>{mine.length > 0 && <span className="rounded-full bg-[#2563EB] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">You are serving</span>}</div><p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">{event.rosterPublished ? `${event.assignments.length} published ministry assignments` : 'Ministry roster is being prepared'}</p></div>{expanded ? <ChevronUp className="h-5 w-5 shrink-0 text-slate-400" /> : <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" />}</button>{expanded && <div className="border-t border-slate-100 px-3.5 pb-4 pt-3 sm:px-4 dark:border-white/10">{event.description && <p className="mb-3 text-[12px] leading-5 text-slate-500 dark:text-slate-400">{event.description}</p>}{event.rosterPublished ? <RosterGroups assignments={event.assignments} /> : <div className="rounded-xl bg-[#F7F9FC] p-3.5 dark:bg-white/5"><div className="flex items-start gap-2.5"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" /><div><p className="text-[13px] font-bold text-[#172033] dark:text-white">Assignment planning in progress</p><p className="mt-1 text-[12px] leading-5 text-slate-500 dark:text-slate-400">Names remain private until leaders deliberately publish the final roster.</p></div></div></div>}</div>}</article>;
}

function DateTile({ date, fallback }: { date: Date | null; fallback: string }) { return <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200"><span className="text-[9px] font-extrabold uppercase tracking-wide">{date ? new Intl.DateTimeFormat(undefined, { month: 'short' }).format(date) : 'Date'}</span><span className="text-[18px] font-black leading-none">{date ? date.getDate() : fallback.slice(-2)}</span></div>; }
function RosterGroups({ assignments }: { assignments: RosterAssignment[] }) { const groups = ['Lector & Commentator', 'Ushers', 'Altar Servers'] as const; return <div className="grid gap-2 md:grid-cols-3">{groups.map((group) => { const items = assignments.filter((assignment) => assignment.ministry === group); return <div key={group} className="rounded-xl bg-[#F7F9FC] p-3.5 dark:bg-white/5"><p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-400">{group}</p>{items.length ? <div className="mt-2 space-y-2">{items.map((item) => <div key={`${item.userId}-${item.role}`} className={cn('rounded-lg bg-white p-2.5 dark:bg-white/5', item.isCurrentUser && 'ring-1 ring-blue-300')}><p className="text-[11px] font-bold text-[#172033] dark:text-white">{item.role}</p><p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">{item.displayName}</p></div>)}</div> : <p className="mt-2 text-[10px] text-slate-400">No published assignment</p>}</div>; })}</div>; }
function ScheduleLoading() { return <div className="space-y-3 p-4 sm:p-5">{[0, 1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/5" />)}</div>; }
function EmptyState({ icon: Icon, title, body, action }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string; action?: React.ReactNode }) { return <div className="px-5 py-12 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200"><Icon className="h-6 w-6" /></div><h3 className="mt-4 text-[16px] font-extrabold text-[#172033] dark:text-white">{title}</h3><p className="mx-auto mt-2 max-w-md text-[13px] leading-5 text-slate-500 dark:text-slate-400">{body}</p>{action}</div>; }
