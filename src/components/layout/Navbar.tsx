import React, { useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { auth } from '../../lib/firebase';
import { useAuth } from '../../App';
import { LayoutDashboard, ClipboardList, BookOpen, Calendar, Settings, LogOut, ShieldCheck, UserCircle, Users, Megaphone, Bell, DollarSign, Mail } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Logo } from '../ui/Logo';
import NotificationCenter from '../ui/NotificationCenter';

function useDragToScroll() {
  const ref = useRef<HTMLDivElement>(null);

  const onMouseDown = (e: React.MouseEvent) => {
    const ele = ref.current;
    if (!ele) return;

    if (e.button !== 0) return; // Only drag on left click

    const startX = e.pageX - ele.offsetLeft;
    const scrollLeft = ele.scrollLeft;
    let hasMoved = false;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const x = moveEvent.pageX - ele.offsetLeft;
      const walk = (x - startX) * 1.5;
      ele.scrollLeft = scrollLeft - walk;
      if (Math.abs(x - startX) > 5) {
        hasMoved = true;
        ele.style.cursor = 'grabbing';
        ele.style.userSelect = 'none';
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      if (ele) {
        ele.style.cursor = '';
        ele.style.userSelect = '';
      }

      if (hasMoved) {
        const preventClick = (clickEvent: MouseEvent) => {
          clickEvent.preventDefault();
          clickEvent.stopPropagation();
          document.removeEventListener('click', preventClick, true);
        };
        document.addEventListener('click', preventClick, true);
        setTimeout(() => {
          document.removeEventListener('click', preventClick, true);
        }, 50);
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return { ref, onMouseDown };
}

export default function Navbar() {
  const { profile } = useAuth();
  const location = useLocation();

  const desktopDrag = useDragToScroll();
  const mobileDrag = useDragToScroll();

  const userRoles = profile?.roles || [];
  const isAdmin = userRoles.some(r => ['admin', 'president', 'vice_president', 'secretary', 'auditor'].includes(r));
  const isAccountingAuthorized = userRoles.some(r => ['admin', 'president', 'treasurer'].includes(r));

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/' },
    ...(isAccountingAuthorized ? [{ label: 'Accounting', icon: DollarSign, path: '/accounting' }] : []),
    { label: 'Polls', icon: ClipboardList, path: '/polls' },
    { label: 'Members', icon: Users, path: '/members' },
    { label: 'Announcements', icon: Megaphone, path: '/announcements' },
    { label: 'Duties', icon: Calendar, path: '/duties' },
    { label: 'Resources', icon: BookOpen, path: '/resources' },
    { label: 'Inbox', icon: Mail, path: '/inbox' },
    { label: 'My Profile', icon: UserCircle, path: '/profile' },
    ...(isAdmin ? [{ label: 'Admin', icon: Settings, path: '/admin' }] : []),
  ];

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 h-16 bg-white/90 dark:bg-[#141411]/90 backdrop-blur-md border-b border-gray-100 dark:border-white/5 z-50 px-4 md:px-6 flex items-center justify-between shadow-sm gap-4">
        <div className="flex-shrink-0">
          <Link to="/" className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white dark:bg-[#1e1e1a] rounded-xl flex items-center justify-center shadow-soft border border-gray-50 dark:border-white/5 text-[#5A5A40] dark:text-[#d4d4bc] hover:scale-105 transition-transform flex-shrink-0">
              <Logo className="w-5 h-5 sm:w-7 sm:h-7" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
              <span className="font-serif text-sm sm:text-lg font-medium text-[#1a1a1a] dark:text-[#f5f5f0] whitespace-nowrap">KCFC Portal</span>
            </div>
          </Link>
        </div>
        
        <div 
          ref={desktopDrag.ref}
          onMouseDown={desktopDrag.onMouseDown}
          className="hidden xl:flex flex-1 min-w-0 items-center gap-1 overflow-x-auto no-scrollbar select-none"
        >
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "px-5 py-2.5 rounded-full text-base font-bold transition-all flex items-center gap-2 whitespace-nowrap shadow-sm",
                  isActive 
                    ? "bg-[#5A5A40] text-white font-extrabold" 
                    : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#1e1e1a]"
                )}
              >
                <item.icon className="w-5 h-5 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          <NotificationCenter />
          <div className="flex items-center gap-3 pl-2 sm:pl-4 border-l border-gray-100 dark:border-white/5">
            <div className="text-right hidden md:block">
              <div className="text-xs font-bold leading-tight text-gray-900 dark:text-[#f5f5f0]">{profile?.displayName}</div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-tighter">
                {profile?.email === 'kcfc.jp@gmail.com' ? 'SUPER MEMBER' : (profile?.roles || []).join(', ')}
              </div>
            </div>
            <button 
              onClick={() => auth.signOut()}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
              title="Logout"
            >
              <LogOut className="nav-icon-mobile" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile/Tablet/Narrow Desktop Bottom Navigation */}
      <nav 
        ref={mobileDrag.ref}
        onMouseDown={mobileDrag.onMouseDown}
        className="xl:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-[#141411] border-t border-gray-100 dark:border-white/10 z-50 h-20 sm:h-24 flex items-center overflow-x-auto shadow-[0_-2px_15px_rgba(0,0,0,0.08)] dark:shadow-[0_-2px_15px_rgba(0,0,0,0.4)] px-2 py-1 no-scrollbar select-none"
      >
        <div className="flex items-center justify-start sm:justify-around min-w-max w-full px-2 gap-2 sm:gap-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center gap-1 sm:gap-1.5 px-3 py-2 rounded-2xl transition-all flex-none min-w-[72px] sm:min-w-[84px] focus:outline-none focus:ring-2 focus:ring-[#5A5A40]",
                  isActive 
                    ? "text-[#5A5A40] bg-[#5A5A40]/10 dark:text-[#f5f5f0] dark:bg-[#5A5A40]/30" 
                    : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#1e1e1a] active:bg-gray-100 dark:active:bg-[#1e1e1a]"
                )}
              >
                <item.icon className="w-6 h-6 sm:w-7 sm:h-7 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                <span className={cn(
                  "text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-center block mt-0.5",
                  isActive ? "text-[#5A5A40] dark:text-[#f5f5f0] font-extrabold" : "text-gray-700 dark:text-gray-300"
                )}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
