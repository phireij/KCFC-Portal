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
  pollId?: string;
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
  'admin',
  'president',
  'vice_president',
  'secretary',
  'auditor',
  'lector_commentator_leader',
  'usher_leader',
  'altar_server_leader',
  'choir_a_leader',
  'choir_b_leader',
  'kitchen_leader',
  'kitchen_sub_leader',
  'cleaning_leader',
  'cleaning_sub_leader',
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
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

const formatShortDate = (date: Date | null, fallback: string) => {
  if (!date) return fallback;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date);
};

const formatMonthHeading = (date: Date | null) => {
  if (!date) return 'Schedule';
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(date);
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

export default function Duties() {
  const { profile, user } = useAuth();
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<ScheduleView>(() =>
    searchParams.get('tab') || searchParams.get('pollId') ? 'manage' : 'all',
  );
  const [scope, setScope] = useState<ScheduleScope>('upcoming');
  const [polls, setPolls] = useState<Poll[]>([]);
  const [duties, setDuties] = useState<DutyAssignment[]>([]);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const isLeader = (profile?.roles || []).some((role) => leadershipRoles.includes(role));

  useEffect(() => {
    if (searchParams.get('tab') || searchParams.get('pollId')) {
      setView('manage');
    }
  }, [searchParams]);

  useEffect(() => {
    let pendingSources = 3;
    const markLoaded = () => {
      pendingSources -= 1;
      if (pendingSources <= 0) setLoading(false);
    };

    const unsubPolls = onSnapshot(
      collection(db, 'polls'),
      (snapshot) => {
        setPolls(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Poll)));
        markLoaded();
      },
      (error) => {
        console.error('Schedule: failed to load polls', error);
        markLoaded();
      },
    );

    const unsubDuties = onSnapshot(
      collection(db, 'duties'),
      (snapshot) => {
        setDuties(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as DutyAssignment)));
        markLoaded();
      },
      (error) => {
        console.error('Schedule: failed to load duties', error);
        markLoaded();
      },
    );

    const unsubMembers = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        setMembers(snapshot.docs.map((item) => ({ uid: item.id, ...item.data() } as UserProfile)));
        markLoaded();
      },
      (error) => {
        console.error('Schedule: failed to load member names', error);
        markLoaded();
      },
    );

    return () => {
      unsubPolls();
      unsubDuties();
      unsubMembers();
    };
  }, []);

  const membersById = useMemo(() => {
    const map = new Map<string, UserProfile>();
    members.forEach((member) => map.set(member.uid, member));
    return map;
  }, [members]);

  const scheduleEvents = useMemo<ScheduleEvent[]>(() => {
    const events: ScheduleEvent[] = [];

    polls
      .filter((poll) => poll.category === 'committee' && poll.status !== 'draft')
      .forEach((poll) => {
        const options = poll.massDates?.length
          ? poll.massDates
          : poll.massDate
            ? [{ date: poll.massDate, description: poll.description }]
            : [];

        const completed = poll.completedAssignments || [];
        const rosterPublished =
          poll.status === 'closed' &&
          ['lector', 'altar_server', 'usher'].every((ministry) => completed.includes(ministry));

        options.forEach((option, index) => {
          const assignmentMap = poll.assignments?.[option.date] || {};
          const assignments = rosterPublished
            ? Object.entries(assignmentMap)
                .map(([userId, role]) => ({
                  userId,
                  displayName: membersById.get(userId)?.displayName || 'KCFC Member',
                  role,
                  ministry: roleToMinistry(role),
                  isCurrentUser: userId === user?.uid,
                }))
                .filter((assignment) => assignment.ministry !== 'Other')
                .sort((a, b) => a.ministry.localeCompare(b.ministry) || a.role.localeCompare(b.role))
            : [];

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

    return events.sort((a, b) => {
      if (!a.parsedDate && !b.parsedDate) return a.dateValue.localeCompare(b.dateValue);
      if (!a.parsedDate) return 1;
      if (!b.parsedDate) return -1;
      return a.parsedDate.getTime() - b.parsedDate.getTime();
    });
  }, [polls, membersById, user?.uid]);

  const visibleScheduleEvents = useMemo(() => {
    if (scope === 'all') return scheduleEvents;
    const today = startOfToday();
    return scheduleEvents.filter((event) => !event.parsedDate || event.parsedDate >= today);
  }, [scheduleEvents, scope]);

  const personalAssignments = useMemo<PersonalAssignment[]>(() => {
    if (!user) return [];

    const liturgical: PersonalAssignment[] = scheduleEvents.flatMap((event) =>
      event.assignments
        .filter((assignment) => assignment.userId === user.uid)
        .map((assignment) => ({
          key: `${event.key}-${assignment.role}`,
          dateValue: event.dateValue,
          parsedDate: event.parsedDate,
          title: event.title,
          role: assignment.role,
          detail: assignment.ministry,
          kind: 'liturgical' as const,
        })),
    );

    const community: PersonalAssignment[] = duties
      .filter((duty) => duty.userId === user.uid)
      .map((duty) => ({
        key: duty.id || `${duty.userId}-${duty.date}-${duty.type}`,
        dateValue: duty.date,
        parsedDate: parseScheduleDate(duty.date),
        title: dutyTypeLabel(duty.type),
        role: duty.slot || dutyTypeLabel(duty.type),
        detail: duty.completed === 'done' ? 'Completed' : duty.completed === 'not_done' ? 'Needs follow-up' : 'Assigned',
        kind: 'community' as const,
      }));

    return [...liturgical, ...community].sort((a, b) => {
      if (!a.parsedDate && !b.parsedDate) return a.dateValue.localeCompare(b.dateValue);
      if (!a.parsedDate) return 1;
      if (!b.parsedDate) return -1;
      return a.parsedDate.getTime() - b.parsedDate.getTime();
    });
  }, [duties, scheduleEvents, user]);

  const upcomingPersonalAssignments = useMemo(() => {
    const today = startOfToday();
    return personalAssignments.filter((item) => !item.parsedDate || item.parsedDate >= today);
  }, [personalAssignments]);

  const nextScheduleEvent = visibleScheduleEvents[0];
  const nextPersonalAssignment = upcomingPersonalAssignments[0];

  const groupedEvents = useMemo(() => {
    const groups = new Map<string, ScheduleEvent[]>();
    visibleScheduleEvents.forEach((event) => {
      const key = formatMonthHeading(event.parsedDate);
      const current = groups.get(key) || [];
      current.push(event);
      groups.set(key, current);
    });
    return Array.from(groups.entries());
  }, [visibleScheduleEvents]);

  return (
    <div className="kcfc-page space-y-5 pb-3">
      <section className="overflow-hidden rounded-[24px] border border-blue-100 bg-gradient-to-br from-[#123B66] via-[#164A7D] to-[#2563EB] px-5 py-6 text-white shadow-[0_18px_45px_rgba(18,59,102,0.18)] sm:px-7 sm:py-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 flex items-center gap-2 text-blue-100">
              <CalendarDays className="h-4 w-4" />
              <span className="text-[12px] font-extrabold uppercase tracking-[0.13em]">KCFC Schedule</span>
            </div>
            <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.025em] sm:text-[34px]">Your service. Your ministry. One clear schedule.</h1>
            <p className="mt-2 max-w-xl text-[14px] leading-6 text-blue-50/90 sm:text-[15px]">
              Browse the whole KCFC liturgical schedule, quickly find your own assignments, and move into availability or leader planning when needed.
            </p>
          </div>
          <Link
            to="/polls"
            className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-[13px] font-bold text-[#123B66] shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ClipboardCheck className="h-4 w-4" />
            Availability requests
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <SummaryCard
          icon={CalendarDays}
          label="Next KCFC Mass"
          value={nextScheduleEvent ? formatShortDate(nextScheduleEvent.parsedDate, nextScheduleEvent.dateValue) : 'No upcoming date'}
          detail={nextScheduleEvent?.title || 'New Mass dates will appear here.'}
        />
        <SummaryCard
          icon={UserCheck}
          label="My next assignment"
          value={nextPersonalAssignment ? formatShortDate(nextPersonalAssignment.parsedDate, nextPersonalAssignment.dateValue) : 'You are clear'}
          detail={nextPersonalAssignment ? `${nextPersonalAssignment.role} • ${nextPersonalAssignment.title}` : 'No upcoming published assignment.'}
          accent={Boolean(nextPersonalAssignment)}
        />
        <SummaryCard
          icon={UsersRound}
          label="My ministries"
          value={(profile?.ministries || []).length ? `${profile?.ministries.length} active` : 'Not set'}
          detail={(profile?.ministries || []).length
            ? (profile?.ministries || []).map((ministry) => ministry.replaceAll('_', ' ')).join(' • ')
            : 'Update your profile when a ministry is assigned.'}
        />
      </section>

      <section className="kcfc-surface overflow-hidden">
        <div className="border-b border-slate-200/80 p-2 dark:border-white/10">
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-[#F7F9FC] p-1 dark:bg-white/5">
            <ViewButton
              active={view === 'all'}
              onClick={() => setView('all')}
              icon={CalendarDays}
              label="All schedule"
            />
            <ViewButton
              active={view === 'mine'}
              onClick={() => setView('mine')}
              icon={UserCheck}
              label="My ministry"
            />
            <ViewButton
              active={view === 'manage'}
              onClick={() => setView('manage')}
              icon={ListChecks}
              label={isLeader ? 'Plan & manage' : 'Availability & duties'}
            />
          </div>
        </div>

        {view === 'all' && (
          <div>
            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-white/10">
              <div>
                <h2 className="text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white">Whole KCFC schedule</h2>
                <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">Open any Mass to see the published ministry roster.</p>
              </div>
              <div className="flex w-fit items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/5">
                <Filter className="ml-2 h-4 w-4 text-slate-400" />
                <ScopeButton active={scope === 'upcoming'} onClick={() => setScope('upcoming')} label="Upcoming" />
                <ScopeButton active={scope === 'all'} onClick={() => setScope('all')} label="All" />
              </div>
            </div>

            {loading ? (
              <ScheduleLoading />
            ) : groupedEvents.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No schedule published yet"
                body="Once a liturgical availability request includes Mass dates, those dates will appear here automatically."
              />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-white/10">
                {groupedEvents.map(([month, events]) => (
                  <div key={month} className="px-4 py-5 sm:px-5">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-[#2563EB]" />
                      <h3 className="text-[13px] font-extrabold uppercase tracking-[0.08em] text-[#123B66] dark:text-blue-200">{month}</h3>
                      <span className="text-[12px] text-slate-400">{events.length} {events.length === 1 ? 'date' : 'dates'}</span>
                    </div>
                    <div className="space-y-2.5">
                      {events.map((event) => {
                        const expanded = expandedEvent === event.key;
                        const mine = event.assignments.filter((assignment) => assignment.isCurrentUser);
                        return (
                          <article
                            key={event.key}
                            className={cn(
                              'overflow-hidden rounded-2xl border transition-colors',
                              mine.length
                                ? 'border-blue-200 bg-blue-50/35 dark:border-blue-400/20 dark:bg-blue-500/10'
                                : 'border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03]',
                            )}
                          >
                            <button
                              type="button"
                              onClick={() => setExpandedEvent(expanded ? null : event.key)}
                              className="flex min-h-[76px] w-full items-center gap-3 px-3.5 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 sm:px-4"
                            >
                              <DateTile date={event.parsedDate} fallback={event.dateValue} />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate text-[14px] font-extrabold text-[#172033] dark:text-white sm:text-[15px]">{event.title}</p>
                                  {mine.length > 0 && (
                                    <span className="rounded-full bg-[#2563EB] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">You are serving</span>
                                  )}
                                </div>
                                <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
                                  {event.rosterPublished
                                    ? `${event.assignments.length} published ministry assignments`
                                    : 'Ministry roster is being prepared'}
                                </p>
                              </div>
                              {expanded ? <ChevronUp className="h-5 w-5 shrink-0 text-slate-400" /> : <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" />}
                            </button>

                            {expanded && (
                              <div className="border-t border-slate-100 px-3.5 pb-4 pt-3 sm:px-4 dark:border-white/10">
                                {event.description && (
                                  <p className="mb-3 text-[12px] leading-5 text-slate-500 dark:text-slate-400">{event.description}</p>
                                )}
                                {event.rosterPublished ? (
                                  <RosterGroups assignments={event.assignments} />
                                ) : (
                                  <div className="rounded-xl bg-[#F7F9FC] p-3.5 dark:bg-white/5">
                                    <div className="flex items-start gap-2.5">
                                      <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]" />
                                      <div>
                                        <p className="text-[13px] font-bold text-[#172033] dark:text-white">Assignment planning in progress</p>
                                        <p className="mt-1 text-[12px] leading-5 text-slate-500 dark:text-slate-400">The final roster will appear here after the ministry leaders complete the assignment process.</p>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'mine' && (
          <div>
            <div className="border-b border-slate-100 px-4 py-4 sm:px-5 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[#D6A84B]" />
                <h2 className="text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white">My ministry schedule</h2>
              </div>
              <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">Only the assignments that matter to you, ordered by date.</p>
            </div>

            {loading ? (
              <ScheduleLoading />
            ) : upcomingPersonalAssignments.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No upcoming assignment"
                body="You currently have no published ministry or community-duty assignment. New assignments will appear here automatically."
              />
            ) : (
              <div className="p-4 sm:p-5">
                <div className="relative ml-4 border-l-2 border-blue-100 pl-6 dark:border-blue-400/20">
                  {upcomingPersonalAssignments.map((assignment, index) => (
                    <article key={assignment.key} className={cn('relative pb-5', index === upcomingPersonalAssignments.length - 1 && 'pb-0')}>
                      <div className="absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full border-[3px] border-white bg-[#2563EB] dark:border-[#10243a]" />
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[#2563EB]">{formatLongDate(assignment.parsedDate, assignment.dateValue)}</p>
                            <h3 className="mt-1 text-[16px] font-extrabold text-[#172033] dark:text-white">{assignment.role}</h3>
                            <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">{assignment.title}</p>
                          </div>
                          <span className={cn(
                            'w-fit rounded-full px-3 py-1 text-[11px] font-bold',
                            assignment.kind === 'liturgical'
                              ? 'bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200'
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
                          )}>
                            {assignment.detail || (assignment.kind === 'liturgical' ? 'Liturgical Ministry' : 'Community Duty')}
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'manage' && (
          <div>
            <div className="border-b border-slate-100 px-4 py-4 sm:px-5 dark:border-white/10">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white">{isLeader ? 'Availability, planning & duties' : 'Availability & duties'}</h2>
                  <p className="mt-1 text-[13px] leading-5 text-slate-500 dark:text-slate-400">
                    {isLeader
                      ? 'The existing assignment workspace remains available while we progressively migrate leader tools into the new schedule experience.'
                      : 'Respond to availability requests and review the detailed duty workspace here.'}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-2 sm:p-4">
              <LegacyDuties />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  accent = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <article className={cn('kcfc-surface p-4 sm:p-5', accent && 'border-blue-200 bg-blue-50/40 dark:border-blue-400/20 dark:bg-blue-500/10')}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-400">{label}</p>
          <p className="mt-1 truncate text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white">{value}</p>
          <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-slate-500 dark:text-slate-400">{detail}</p>
        </div>
      </div>
    </article>
  );
}

function ViewButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-12 items-center justify-center gap-2 rounded-xl px-2 text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:text-[13px]',
        active
          ? 'bg-white text-[#123B66] shadow-sm ring-1 ring-slate-200/70 dark:bg-[#123B66] dark:text-white dark:ring-blue-300/10'
          : 'text-slate-500 hover:text-[#123B66] dark:text-slate-400 dark:hover:text-white',
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      <span className="line-clamp-1">{label}</span>
    </button>
  );
}

function ScopeButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'min-h-9 rounded-lg px-3 text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        active
          ? 'bg-white text-[#123B66] shadow-sm dark:bg-[#123B66] dark:text-white'
          : 'text-slate-500 dark:text-slate-400',
      )}
    >
      {label}
    </button>
  );
}

function DateTile({ date, fallback }: { date: Date | null; fallback: string }) {
  const month = date ? new Intl.DateTimeFormat(undefined, { month: 'short' }).format(date) : '';
  const day = date ? String(date.getDate()) : fallback.slice(-2);
  return (
    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200">
      <span className="text-[9px] font-extrabold uppercase tracking-wide">{month || 'Date'}</span>
      <span className="text-[18px] font-black leading-5">{day}</span>
    </div>
  );
}

function RosterGroups({ assignments }: { assignments: RosterAssignment[] }) {
  const ministries: RosterAssignment['ministry'][] = ['Lector & Commentator', 'Ushers', 'Altar Servers'];
  return (
    <div className="grid gap-2.5 lg:grid-cols-3">
      {ministries.map((ministry) => {
        const group = assignments.filter((assignment) => assignment.ministry === ministry);
        return (
          <div key={ministry} className="rounded-xl border border-slate-200/80 bg-[#F7F9FC] p-3 dark:border-white/10 dark:bg-white/5">
            <div className="mb-2 flex items-center gap-2">
              <UsersRound className="h-4 w-4 text-[#2563EB]" />
              <p className="text-[12px] font-extrabold text-[#172033] dark:text-white">{ministry}</p>
            </div>
            {group.length === 0 ? (
              <p className="text-[11px] text-slate-400">No published assignment</p>
            ) : (
              <div className="space-y-1.5">
                {group.map((assignment) => (
                  <div
                    key={`${assignment.userId}-${assignment.role}`}
                    className={cn(
                      'rounded-lg bg-white px-2.5 py-2 dark:bg-white/5',
                      assignment.isCurrentUser && 'ring-1 ring-[#2563EB]',
                    )}
                  >
                    <p className="text-[11px] font-bold text-[#123B66] dark:text-blue-200">{assignment.role}</p>
                    <p className="mt-0.5 truncate text-[12px] font-semibold text-[#172033] dark:text-white">{assignment.displayName}{assignment.isCurrentUser ? ' • You' : ''}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="px-5 py-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-[16px] font-extrabold text-[#172033] dark:text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-5 text-slate-500 dark:text-slate-400">{body}</p>
    </div>
  );
}

function ScheduleLoading() {
  return (
    <div className="space-y-3 p-4 sm:p-5" aria-label="Loading schedule">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/5" />
      ))}
    </div>
  );
}
