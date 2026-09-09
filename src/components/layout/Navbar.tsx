import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  DollarSign,
  House,
  LogOut,
  Mail,
  Megaphone,
  MoreHorizontal,
  Settings,
  ShieldCheck,
  UserCircle,
  UsersRound,
  X,
} from 'lucide-react';
import { auth } from '../../lib/firebase';
import { useAuth } from '../../App';
import { cn } from '../../lib/utils';
import { Logo } from '../ui/Logo';
import NotificationCenter from '../ui/NotificationCenter';

type PrimaryNavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  path?: string;
  activePaths: string[];
  action?: 'more';
};

type UtilityLink = {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  path: string;
};

const isPathActive = (pathname: string, paths: string[]) =>
  paths.some((path) => pathname === path || (path !== '/' && pathname.startsWith(`${path}/`)));

export default function Navbar() {
  const { profile } = useAuth();
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);

  const userRoles = profile?.roles || [];
  const isAdmin = userRoles.some((role) =>
    ['admin', 'president', 'vice_president', 'secretary', 'auditor'].includes(role),
  );
  const isAccountingAuthorized = userRoles.some((role) =>
    ['admin', 'president', 'treasurer'].includes(role),
  );

  useEffect(() => {
    document.body.classList.add('kcfc-auth-shell');
    return () => document.body.classList.remove('kcfc-auth-shell');
  }, []);

  useEffect(() => {
    setShowMore(false);
  }, [location.pathname]);

  const primaryNavItems = useMemo<PrimaryNavItem[]>(
    () => [
      { label: 'Home', icon: House, path: '/', activePaths: ['/'] },
      {
        label: 'Schedule',
        icon: CalendarDays,
        path: '/duties',
        activePaths: ['/duties', '/polls'],
      },
      {
        label: 'Community',
        icon: UsersRound,
        path: '/members',
        activePaths: ['/members'],
      },
      {
        label: 'Updates',
        icon: Megaphone,
        path: '/announcements',
        activePaths: ['/announcements'],
      },
      {
        label: 'More',
        icon: MoreHorizontal,
        activePaths: ['/resources', '/inbox', '/profile', '/admin', '/accounting'],
        action: 'more',
      },
    ],
    [],
  );

  const utilityLinks = useMemo<UtilityLink[]>(() => {
    const links: UtilityLink[] = [
      {
        label: 'Availability & Polls',
        description: 'Respond to upcoming service availability requests.',
        icon: ClipboardList,
        path: '/polls',
      },
      {
        label: 'Resources',
        description: 'Ministry guides, forms and shared materials.',
        icon: BookOpen,
        path: '/resources',
      },
      {
        label: 'Inbox',
        description: 'All KCFC messages and important notices.',
        icon: Mail,
        path: '/inbox',
      },
      {
        label: 'My Profile',
        description: 'Personal details, ministries and app preferences.',
        icon: UserCircle,
        path: '/profile',
      },
    ];

    if (isAccountingAuthorized) {
      links.push({
        label: 'Accounting',
        description: 'Treasury ledger and financial reports.',
        icon: DollarSign,
        path: '/accounting',
      });
    }

    if (isAdmin) {
      links.push({
        label: 'Leadership & Admin',
        description: 'Member approvals, settings and leadership tools.',
        icon: Settings,
        path: '/admin',
      });
    }

    return links;
  }, [isAccountingAuthorized, isAdmin]);

  const roleLabel = profile?.email === 'kcfc.jp@gmail.com'
    ? 'System Administrator'
    : userRoles.length > 0
      ? userRoles.join(' • ').replaceAll('_', ' ')
      : 'KCFC Member';

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="kcfc-desktop-sidebar hidden xl:flex fixed inset-y-0 left-0 z-50 w-[280px] flex-col border-r border-slate-200/80 bg-white dark:border-white/10 dark:bg-[#0d1b2a]">
        <div className="px-6 pt-6 pb-5">
          <Link to="/" className="group flex items-center gap-3 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#123B66] text-white shadow-sm transition-transform group-hover:scale-[1.03]">
              <Logo className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[17px] font-extrabold tracking-tight text-[#172033] dark:text-white">KCFC Portal</p>
              <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">Faith • Service • Community</p>
            </div>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Main</p>
          <nav className="space-y-1" aria-label="Primary navigation">
            {primaryNavItems.filter((item) => item.action !== 'more').map((item) => {
              const active = isPathActive(location.pathname, item.activePaths);
              return (
                <Link
                  key={item.label}
                  to={item.path!}
                  className={cn(
                    'flex min-h-12 items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                    active
                      ? 'bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-[#123B66] dark:text-slate-300 dark:hover:bg-white/5 dark:hover:text-white',
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.5 : 2} />
                  <span>{item.label}</span>
                  {active && <span className="ml-auto h-2 w-2 rounded-full bg-[#2563EB]" aria-hidden="true" />}
                </Link>
              );
            })}
          </nav>

          <div className="my-5 border-t border-slate-100 dark:border-white/10" />
          <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Tools</p>
          <nav className="space-y-1" aria-label="Portal tools">
            {utilityLinks.map((item) => {
              const active = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                    active
                      ? 'bg-blue-50 text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-[#123B66] dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white',
                  )}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.4 : 2} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-slate-100 p-4 dark:border-white/10">
          <div className="mb-3 flex items-center gap-3 rounded-2xl bg-[#F7F9FC] p-3 dark:bg-white/5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#123B66] text-sm font-bold text-white">
              {(profile?.displayName || 'K').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold text-[#172033] dark:text-white">{profile?.displayName || 'KCFC Member'}</p>
              <p className="truncate text-[11px] capitalize text-slate-500 dark:text-slate-400">{roleLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationCenter />
            <button
              type="button"
              onClick={() => auth.signOut()}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-red-500/10 dark:hover:text-red-300"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile/tablet top app bar */}
      <header className="xl:hidden fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-xl dark:border-white/10 dark:bg-[#0d1b2a]/95">
        <Link to="/" className="flex min-w-0 items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#123B66] text-white">
            <Logo className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-extrabold tracking-tight text-[#172033] dark:text-white">KCFC Portal</p>
            <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">Faith • Service • Community</p>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <NotificationCenter />
          <Link
            to="/profile"
            aria-label="Open profile"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EAF3FF] text-[#123B66] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-blue-500/15 dark:text-blue-200"
          >
            <span className="text-[13px] font-extrabold">{(profile?.displayName || 'K').slice(0, 1).toUpperCase()}</span>
          </Link>
        </div>
      </header>

      {/* Mobile/tablet bottom navigation */}
      <nav className="xl:hidden fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/90 bg-white/95 px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_24px_rgba(15,23,42,0.07)] backdrop-blur-xl dark:border-white/10 dark:bg-[#0d1b2a]/95" aria-label="Primary mobile navigation">
        <div className="mx-auto grid max-w-2xl grid-cols-5 gap-1">
          {primaryNavItems.map((item) => {
            const active = item.action === 'more'
              ? showMore || isPathActive(location.pathname, item.activePaths)
              : isPathActive(location.pathname, item.activePaths);
            const sharedClass = cn(
              'relative flex min-h-[62px] flex-col items-center justify-center gap-1 rounded-2xl px-1 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              active
                ? 'bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200'
                : 'text-slate-500 active:bg-slate-100 dark:text-slate-400 dark:active:bg-white/5',
            );

            const content = (
              <>
                <item.icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.5 : 2} />
                <span className="text-[11px] font-bold leading-none">{item.label}</span>
                {active && <span className="absolute bottom-1 h-1 w-4 rounded-full bg-[#2563EB]" aria-hidden="true" />}
              </>
            );

            if (item.action === 'more') {
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setShowMore((value) => !value)}
                  className={sharedClass}
                  aria-expanded={showMore}
                  aria-controls="kcfc-more-sheet"
                >
                  {content}
                </button>
              );
            }

            return (
              <Link key={item.label} to={item.path!} className={sharedClass}>
                {content}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile More sheet */}
      {showMore && (
        <div className="xl:hidden fixed inset-0 z-[60]" role="presentation">
          <button
            type="button"
            aria-label="Close more menu"
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]"
            onClick={() => setShowMore(false)}
          />
          <section
            id="kcfc-more-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="More KCFC Portal tools"
            className="absolute inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto rounded-t-[28px] bg-white px-4 pb-[max(6.5rem,calc(env(safe-area-inset-bottom)+6rem))] pt-3 shadow-2xl dark:bg-[#10243a]"
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 dark:bg-white/15" />
            <div className="mb-4 flex items-start justify-between gap-3 px-1">
              <div>
                <h2 className="text-[20px] font-extrabold tracking-tight text-[#172033] dark:text-white">More</h2>
                <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">Your tools, resources and leadership access.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowMore(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-white/10 dark:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              {utilityLinks.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex min-h-[68px] items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 transition-colors hover:border-blue-200 hover:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-white/10 dark:bg-white/5 dark:hover:bg-blue-500/10"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold text-[#172033] dark:text-white">{item.label}</p>
                    <p className="mt-0.5 text-[12px] leading-4 text-slate-500 dark:text-slate-400">{item.description}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 dark:text-slate-600" />
                </Link>
              ))}
            </div>

            <div className="mt-4 rounded-2xl bg-[#F7F9FC] p-4 dark:bg-white/5">
              <div className="flex items-center gap-2 text-[#123B66] dark:text-blue-200">
                <ShieldCheck className="h-5 w-5" />
                <p className="text-[13px] font-bold">Signed in as {profile?.displayName || 'KCFC Member'}</p>
              </div>
              <p className="mt-1 text-[12px] capitalize text-slate-500 dark:text-slate-400">{roleLabel}</p>
              <button
                type="button"
                onClick={() => auth.signOut()}
                className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-[13px] font-semibold text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
