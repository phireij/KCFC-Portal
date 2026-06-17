import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { auth } from '../../lib/firebase';
import { useAuth } from '../../App';
import { LayoutDashboard, ClipboardList, BookOpen, Calendar, Settings, LogOut, ShieldCheck, UserCircle, Users, Megaphone, Bell, DollarSign } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Logo } from '../ui/Logo';
import NotificationCenter from '../ui/NotificationCenter';

export default function Navbar() {
  const { profile } = useAuth();
  const location = useLocation();

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
    { label: 'Profile', icon: UserCircle, path: '/profile' },
    ...(isAdmin ? [{ label: 'Admin', icon: Settings, path: '/admin' }] : []),
  ];

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 h-16 bg-white/90 dark:bg-[#141411]/90 backdrop-blur-md border-b border-gray-100 dark:border-white/5 z-50 px-4 md:px-6 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 lg:gap-8 flex-shrink-0">
          <Link to="/" className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white dark:bg-[#1e1e1a] rounded-xl flex items-center justify-center shadow-soft border border-gray-50 dark:border-white/5 text-[#5A5A40] dark:text-[#d4d4bc] hover:scale-105 transition-transform flex-shrink-0">
              <Logo className="w-5 h-5 sm:w-7 sm:h-7" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
              <span className="font-serif text-sm sm:text-lg font-medium text-[#1a1a1a] dark:text-[#f5f5f0] whitespace-nowrap">KCFC Core Group</span>
            </div>
          </Link>
          
          <div className="hidden xl:flex items-center gap-1 overflow-x-auto no-scrollbar">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap",
                  location.pathname === item.path 
                    ? "bg-[#5A5A40] text-white" 
                    : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#1e1e1a]"
                )}
              >
                <item.icon size={16} />
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          <NotificationCenter />
          <div className="flex items-center gap-3 pl-2 sm:pl-4 border-l border-gray-100 dark:border-white/5">
            <div className="text-right hidden md:block">
              <div className="text-xs font-bold leading-tight text-gray-900 dark:text-[#f5f5f0]">{profile?.displayName}</div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-tighter">
                {profile?.email === 'kcfc.jp@gmail.com' ? 'SUPER MEMBER' : profile?.roles.join(', ')}
              </div>
            </div>
            <button 
              onClick={() => auth.signOut()}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
              title="Logout"
            >
              <LogOut className="w-[18px] h-[18px] sm:w-[20px] sm:h-[20px]" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile/Tablet/Narrow Desktop Bottom Navigation */}
      <nav className="xl:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-[#141411] border-t border-gray-100 dark:border-white/5 z-50 h-16 sm:h-20 flex items-center overflow-x-auto shadow-[0_-2px_15px_rgba(0,0,0,0.08)] dark:shadow-[0_-2px_15px_rgba(0,0,0,0.4)]">
        <div className="flex items-center justify-start sm:justify-around min-w-max w-full px-4 gap-1 sm:gap-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-1 sm:gap-1.5 px-2 sm:px-4 py-2 rounded-xl sm:rounded-2xl transition-all flex-none min-w-[60px] sm:min-w-[72px]",
                location.pathname === item.path 
                  ? "text-[#5A5A40] bg-[#5A5A40]/5 dark:bg-[#5A5A40]/10" 
                  : "text-gray-400 dark:text-[10px] dark:text-gray-500 active:bg-gray-50 dark:active:bg-[#1e1e1a]"
              )}
            >
              <item.icon className="w-[18px] h-[18px] sm:w-[22px] sm:h-[22px]" strokeWidth={location.pathname === item.path ? 2.5 : 2} />
              <span className={cn(
                "text-[8px] sm:text-[9px] font-bold uppercase tracking-wider",
                location.pathname === item.path ? "opacity-100" : "opacity-70"
              )}>
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
