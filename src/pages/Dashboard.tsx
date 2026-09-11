import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BellRing,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Inbox,
  Megaphone,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UsersRound,
} from 'lucide-react';
import { collection, getDocs, limit, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../App';
import { Announcement, DutyAssignment, Poll, UserProfile } from '../types';
import { cn } from '../lib/utils';

type HomeAssignment = {
  key: string;
  dateValue: string;
  parsedDate: Date | null;
  role: string;
  title: string;
  source: 'liturgical' | 'community';
};

type UpcomingMass = {
  key: string;
  dateValue: string;
  parsedDate: Date | null;
  title: string;
  rosterPublished: boolean;
};

const primaryLiturgicalMinistries = ['lector_commentator', 'usher', 'altar_server'];

const parseDateValue = (value?: string): Date | null => {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const formatDate = (date: Date | null, fallback: string, compact = false) => {
  if (!date) return fallback;
  return new Intl.DateTimeFormat(undefined, compact
    ? { month: 'short', day: 'numeric' }
    : { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
};

const formatTimestamp = (value: unknown) => {
  try {
    if (!value) return '';
    if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
      return formatDate(((value as { toDate: () => Date }).toDate()), '');
    }
    const date = new Date(value as string | number | Date);
    if (Number.isNaN(date.getTime())) return '';
    return formatDate(date, '');
  } catch {
    return '';
  }
};

const dutyLabel = (duty: DutyAssignment) => {
  if (duty.type === 'kitchen') return duty.slot || 'Kitchen Duty';
  if (duty.type === 'cleaning') return duty.slot || 'Cleaning Duty';
  return duty.slot || 'Ministry Duty';
};

export default function Dashboard() {
  const { profile, user } = useAuth();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [duties, setDuties] = useState<DutyAssignment[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [availabilityResponses, setAvailabilityResponses] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const isAdmin = (profile?.roles || []).some((role) =>
    ['admin', 'president', 'vice_president', 'secretary', 'auditor'].includes(role),
  );

  useEffect(() => {
    let readyCount = 0;
    const markReady = () => {
      readyCount += 1;
      if (readyCount >= 4) setLoading(false);
    };

    const unsubPolls = onSnapshot(
      collection(db, 'polls'),
      (snapshot) => {
        setPolls(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Poll)));
        markReady();
      },
      (error) => {
        console.error('Home: failed to load polls', error);
        markReady();
      },
    );

    const unsubDuties = onSnapshot(
      collection(db, 'duties'),
      (snapshot) => {
        setDuties(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as DutyAssignment)));
        markReady();
      },
      (error) => {
        console.error('Home: failed to load duties', error);
        markReady();
      },
    );

    const unsubAnnouncements = onSnapshot(
      collection(db, 'announcements'),
      (snapshot) => {
        const published = snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() } as Announcement))
          .filter((announcement) => announcement.status === 'published')
          .sort((a, b) => {
            const aDate = parseDateValue(a.publishedAt || a.createdAt)?.getTime() || 0;
            const bDate = parseDateValue(b.publishedAt || b.createdAt)?.getTime() || 0;
            return bDate - aDate;
          })
          .slice(0, 3);
        setAnnouncements(published);
        markReady();
      },
      (error) => {
        console.error('Home: failed to load announcements', error);
        markReady();
      },
    );

    const unsubMembers = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        setMembers(snapshot.docs.map((item) => ({ uid: item.id, ...item.data() } as UserProfile)));
        markReady();
      },
      (error) => {
        console.error('Home: failed to load members', error);
        markReady();
      },
    );

    return () => {
      unsubPolls();
      unsubDuties();
      unsubAnnouncements();
      unsubMembers();
    };
  }, []);

  const activeAvailabilityPolls = useMemo(() => {
    if (!profile) return [];
    const isEligible = (profile.ministries || []).some((ministry) => primaryLiturgicalMinistries.includes(ministry));
    if (!isEligible && !isAdmin) return [];

    const now = new Date();
    return polls
      .filter((poll) => {
        if (poll.category !== 'committee' || poll.status !== 'active') return false;
        const end = parseDateValue(poll.endDate);
        return !end || end >= now;
      })
      .sort((a, b) => {
        const aEnd = parseDateValue(a.endDate)?.getTime() || Number.MAX_SAFE_INTEGER;
        const bEnd = parseDateValue(b.endDate)?.getTime() || Number.MAX_SAFE_INTEGER;
        return aEnd - bEnd;
      });
  }, [isAdmin, polls, profile]);

  useEffect(() => {
    let cancelled = false;

    const loadResponseState = async () => {
      if (!user || activeAvailabilityPolls.length === 0) {
        if (!cancelled) setAvailabilityResponses({});
        return;
      }

      const pairs = await Promise.all(
        activeAvailabilityPolls.map(async (poll) => {
          try {
            const responseQuery = query(
              collection(db, 'polls', poll.id, 'responses'),
              where('userId', '==', user.uid),
              limit(1),
            );
            const snapshot = await getDocs(responseQuery);
            return [poll.id, !snapshot.empty] as const;
          } catch (error) {
            console.error(`Home: failed to check availability response for ${poll.id}`, error);
            return [poll.id, false] as const;
          }
        }),
      );

      if (!cancelled) setAvailabilityResponses(Object.fromEntries(pairs));
    };

    loadResponseState();
    return () => {
      cancelled = true;
    };
  }, [activeAvailabilityPolls, user]);

  const upcomingMasses = useMemo<UpcomingMass[]>(() => {
    const today = startOfToday();
    const masses: UpcomingMass[] = [];

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
          const parsedDate = parseDateValue(option.date);
          if (parsedDate && parsedDate < today) return;
          masses.push({
            key: `${poll.id}-${option.date}-${index}`,
            dateValue: option.date,
            parsedDate,
            title: option.description || poll.title || 'KCFC Mass',
            rosterPublished,
          });
        });
      });

    return masses
      .sort((a, b) => {
        if (!a.parsedDate && !b.parsedDate) return a.dateValue.localeCompare(b.dateValue);
        if (!a.parsedDate) return 1;
        if (!b.parsedDate) return -1;
        return a.parsedDate.getTime() - b.parsedDate.getTime();
      })
      .slice(0, 4);
  }, [polls]);

  const upcomingAssignments = useMemo<HomeAssignment[]>(() => {
    if (!user) return [];
    const today = startOfToday();
    const assignments: HomeAssignment[] = [];

    polls
      .filter((poll) => poll.category === 'committee' && poll.status === 'closed')
      .forEach((poll) => {
        const completed = poll.completedAssignments || [];
        const rosterPublished = ['lector', 'altar_server', 'usher'].every((ministry) => completed.includes(ministry));
        if (!rosterPublished || !poll.assignments) return;

        Object.entries(poll.assignments).forEach(([dateValue, dateAssignments]) => {
          const role = dateAssignments[user.uid];
          if (!role) return;
          const normalizedRole = role.toLowerCase();
          if (!normalizedRole.includes('lector') && !normalizedRole.includes('commentator') && !normalizedRole.includes('usher') && !normalizedRole.includes('altar')) return;
          const parsedDate = parseDateValue(dateValue);
          if (parsedDate && parsedDate < today) return;
          const option = poll.massDates?.find((item) => item.date === dateValue);
          assignments.push({
            key: `liturgical-${poll.id}-${dateValue}-${role}`,
            dateValue,
            parsedDate,
            role,
            title: option?.description || poll.title,
            source: 'liturgical',
          });
        });
      });

    duties
      .filter((duty) => duty.userId === user.uid)
      .forEach((duty) => {
        const parsedDate = parseDateValue(duty.date);
        if (parsedDate && parsedDate < today) return;
        assignments.push({
          key: `duty-${duty.id || `${duty.userId}-${duty.date}-${duty.type}`}`,
          dateValue: duty.date,
          parsedDate,
          role: dutyLabel(duty),
          title: duty.type === 'kitchen' ? 'KCFC Kitchen' : duty.type === 'cleaning' ? 'KCFC Cleaning' : 'KCFC Duty',
          source: 'community',
        });
      });

    return assignments.sort((a, b) => {
      if (!a.parsedDate && !b.parsedDate) return a.dateValue.localeCompare(b.dateValue);
      if (!a.parsedDate) return 1;
      if (!b.parsedDate) return -1;
      return a.parsedDate.getTime() - b.parsedDate.getTime();
    });
  }, [duties, polls, user]);

  const pendingAvailability = activeAvailabilityPolls.filter((poll) => !availabilityResponses[poll.id]);
  const nextAssignment = upcomingAssignments[0];
  const nextMass = upcomingMasses[0];
  const pendingMembers = members.filter((member) => !member.isVerified && member.email !== 'kcfc.jp@gmail.com');
  const displayName = profile?.nickname?.trim() || profile?.displayName || 'KCFC Member';

  return (
    <div className="kcfc-page space-y-5 pb-4">
      <section className="rounded-[26px] border border-blue-100 bg-gradient-to-br from-white via-[#F8FBFF] to-[#EAF3FF] p-5 shadow-[0_16px_42px_rgba(15,23,42,0.06)] sm:p-7 dark:border-white/10 dark:from-[#10243a] dark:via-[#10243a] dark:to-[#123B66]/50">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[#2563EB]">
              <Sparkles className="h-4 w-4" />
              <span className="text-[11px] font-extrabold uppercase tracking-[0.13em]">KCFC Member Home</span>
            </div>
            <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.03em] text-[#172033] sm:text-[36px] dark:text-white">
              Welcome, {displayName}
            </h1>
            <p className="mt-2 max-w-xl text-[14px] leading-6 text-slate-500 dark:text-slate-300">
              Everything you need for Mass, ministry service and community updates — without hunting through multiple pages.
            </p>
          </div>
          <Link
            to="/duties"
            className="inline-flex min-h-12 w-fit items-center gap-2 rounded-2xl bg-[#123B66] px-4 py-3 text-[13px] font-bold text-white shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <CalendarDays className="h-4 w-4" />
            Open my schedule
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {pendingAvailability.length > 0 && (
        <section className="overflow-hidden rounded-[22px] border border-amber-200 bg-amber-50/70 dark:border-amber-400/20 dark:bg-amber-500/10">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
                <CircleAlert className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-300">Action needed</p>
                <h2 className="mt-0.5 text-[16px] font-extrabold text-[#172033] dark:text-white">
                  {pendingAvailability.length === 1 ? 'Your ministry availability is waiting' : `${pendingAvailability.length} availability requests are waiting`}
                </h2>
                <p className="mt-1 text-[12px] leading-5 text-slate-600 dark:text-slate-300">Tell your ministry leaders which upcoming Masses you can serve.</p>
              </div>
            </div>
            <Link
              to="/polls"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-[12px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              Respond now
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}

      {isAdmin && pendingMembers.length > 0 && (
        <section className="rounded-[22px] border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-400/20 dark:bg-blue-500/10 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#123B66] shadow-sm dark:bg-white/10 dark:text-blue-200">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-[#2563EB]">Leadership attention</p>
                <h2 className="mt-0.5 text-[15px] font-extrabold text-[#172033] dark:text-white">{pendingMembers.length} membership {pendingMembers.length === 1 ? 'request needs' : 'requests need'} review</h2>
              </div>
            </div>
            <Link to="/admin" className="inline-flex min-h-10 items-center gap-1 text-[12px] font-bold text-[#123B66] dark:text-blue-200">
              Review requests <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <HomeStatusCard
          icon={UserCheck}
          label="My next assignment"
          value={nextAssignment ? formatDate(nextAssignment.parsedDate, nextAssignment.dateValue, true) : 'Nothing scheduled'}
          body={nextAssignment ? `${nextAssignment.role} • ${nextAssignment.title}` : 'No upcoming published service assignment.'}
          path="/duties?view=mine"
          accent={Boolean(nextAssignment)}
        />
        <HomeStatusCard
          icon={CalendarDays}
          label="Next KCFC Mass"
          value={nextMass ? formatDate(nextMass.parsedDate, nextMass.dateValue, true) : 'No date yet'}
          body={nextMass ? `${nextMass.title} • ${nextMass.rosterPublished ? 'Roster published' : 'Roster being prepared'}` : 'Upcoming Mass dates will appear here.'}
          path="/duties"
        />
        <HomeStatusCard
          icon={BellRing}
          label="Availability"
          value={pendingAvailability.length ? `${pendingAvailability.length} to answer` : 'Up to date'}
          body={activeAvailabilityPolls.length ? 'Your active ministry availability requests are tracked here.' : 'No active request for your ministry.'}
          path="/polls"
          attention={pendingAvailability.length > 0}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="kcfc-surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-5 dark:border-white/10">
            <div>
              <h2 className="text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white">Coming up</h2>
              <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">The next dates from the KCFC liturgical schedule.</p>
            </div>
            <Link to="/duties" className="inline-flex min-h-10 items-center gap-1 rounded-xl px-2 text-[12px] font-bold text-[#2563EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              Full schedule <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-2 p-4 sm:p-5">
              {[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/5" />)}
            </div>
          ) : upcomingMasses.length === 0 ? (
            <HomeEmpty icon={CalendarDays} title="No upcoming Mass dates" body="Future Mass dates will appear when they are included in a published availability cycle." />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/10">
              {upcomingMasses.map((mass) => (
                <Link
                  key={mass.key}
                  to="/duties"
                  className="flex min-h-[76px] items-center gap-3 px-4 py-3 transition-colors hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 sm:px-5 dark:hover:bg-blue-500/10"
                >
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200">
                    <span className="text-[9px] font-extrabold uppercase tracking-wide">{mass.parsedDate ? new Intl.DateTimeFormat(undefined, { month: 'short' }).format(mass.parsedDate) : 'Date'}</span>
                    <span className="text-[18px] font-black leading-5">{mass.parsedDate ? mass.parsedDate.getDate() : mass.dateValue.slice(-2)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-extrabold text-[#172033] dark:text-white">{mass.title}</p>
                    <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">{formatDate(mass.parsedDate, mass.dateValue)} • {mass.rosterPublished ? 'Ministry roster published' : 'Assignment planning in progress'}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 dark:text-slate-600" />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="kcfc-surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 sm:px-5 dark:border-white/10">
            <div>
              <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-[#2563EB]" />
                <h2 className="text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white">Latest updates</h2>
              </div>
              <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">Important community announcements.</p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2 p-4 sm:p-5">
              {[0, 1].map((item) => <div key={item} className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/5" />)}
            </div>
          ) : announcements.length === 0 ? (
            <HomeEmpty icon={Megaphone} title="No announcements yet" body="Published KCFC updates will appear here." />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-white/10">
              {announcements.map((announcement) => (
                <Link
                  key={announcement.id || announcement.title}
                  to="/announcements"
                  className="block px-4 py-4 transition-colors hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 sm:px-5 dark:hover:bg-blue-500/10"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#2563EB]" />
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-[14px] font-extrabold leading-5 text-[#172033] dark:text-white">{announcement.title}</p>
                      <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-slate-500 dark:text-slate-400">{announcement.content}</p>
                      <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">{formatTimestamp(announcement.publishedAt || announcement.createdAt)}</p>
                    </div>
                  </div>
                </Link>
              ))}
              <Link to="/announcements" className="flex min-h-11 items-center justify-center gap-1 text-[12px] font-bold text-[#2563EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500">
                View all updates <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickLink icon={UsersRound} label="Community" detail={`${Math.max(0, members.filter((member) => member.isVerified && member.email !== 'kcfc.jp@gmail.com').length)} members`} path="/members" />
        <QuickLink icon={Inbox} label="Inbox" detail="Messages & notices" path="/inbox" />
        <QuickLink icon={BookOpen} label="Resources" detail="Ministry library" path="/resources" />
        <QuickLink icon={CheckCircle2} label="Availability" detail={pendingAvailability.length ? 'Response needed' : 'You are up to date'} path="/polls" />
      </section>
    </div>
  );
}

function HomeStatusCard({
  icon: Icon,
  label,
  value,
  body,
  path,
  accent = false,
  attention = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  body: string;
  path: string;
  accent?: boolean;
  attention?: boolean;
}) {
  return (
    <Link
      to={path}
      className={cn(
        'kcfc-surface group block p-4 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:p-5',
        accent && 'border-blue-200 bg-blue-50/35 dark:border-blue-400/20 dark:bg-blue-500/10',
        attention && 'border-amber-200 bg-amber-50/60 dark:border-amber-400/20 dark:bg-amber-500/10',
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
          attention
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
            : 'bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200',
        )}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.09em] text-slate-400">{label}</p>
          <p className="mt-1 truncate text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white">{value}</p>
          <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-slate-500 dark:text-slate-400">{body}</p>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-1 dark:text-slate-600" />
      </div>
    </Link>
  );
}

function QuickLink({
  icon: Icon,
  label,
  detail,
  path,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  detail: string;
  path: string;
}) {
  return (
    <Link
      to={path}
      className="kcfc-surface flex min-h-[108px] flex-col justify-between p-4 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200">
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div>
        <p className="text-[13px] font-extrabold text-[#172033] dark:text-white">{label}</p>
        <p className="mt-0.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">{detail}</p>
      </div>
    </Link>
  );
}

function HomeEmpty({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="px-5 py-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-[14px] font-extrabold text-[#172033] dark:text-white">{title}</h3>
      <p className="mx-auto mt-1 max-w-xs text-[12px] leading-5 text-slate-500 dark:text-slate-400">{body}</p>
    </div>
  );
}
