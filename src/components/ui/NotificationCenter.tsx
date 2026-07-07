import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, limit, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { useAuth } from '../../App';
import { Notification as NotificationType } from '../../types';
import { Bell, Check, X, Megaphone, Calendar, Info, MessageSquare } from 'lucide-react';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';

export default function NotificationCenter() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      if (typeof navigator !== 'undefined' && 'clearAppBadge' in navigator) {
        (navigator as any).clearAppBadge().catch(() => {});
      }
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const notes = snap.docs.map(d => ({ id: d.id, ...d.data() } as NotificationType));
      setNotifications(notes);
      const count = notes.filter(n => n.status === 'unread').length;
      setUnreadCount(count);

      // PWA Badging API Integration
      if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
        if (count > 0) {
          (navigator as any).setAppBadge(count).catch((err: any) => {
            console.warn('Failed to set application icon badge count:', err);
          });
        } else {
          (navigator as any).clearAppBadge().catch((err: any) => {
            console.warn('Failed to clear application icon badge count:', err);
          });
        }
      }
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { status: 'read' });
    } catch (err) {
      console.error(err);
    }
  };

  const markAllAsRead = async () => {
    if (notifications.length === 0) return;
    try {
      const batch = writeBatch(db);
      notifications.filter(n => n.status === 'unread').forEach(n => {
        if (n.id) batch.update(doc(db, 'notifications', n.id), { status: 'read' });
      });
      await batch.commit();
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = (n: NotificationType) => {
    if (n.id && n.status === 'unread') markAsRead(n.id);
    if (n.link) navigate(n.link);
    setIsOpen(false);
  };

  const getIcon = (type: NotificationType['type']) => {
    switch (type) {
      case 'announcement': return <Megaphone size={14} className="text-blue-500" />;
      case 'duty': return <Calendar size={14} className="text-orange-500" />;
      case 'broadcast': return <MessageSquare size={14} className="text-purple-500" />;
      default: return <Info size={14} className="text-gray-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-400 hover:text-[#5A5A40] hover:bg-[#5A5A40]/5 rounded-full transition-all relative"
      >
        <Bell className="nav-icon-mobile" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="fixed top-[68px] left-4 right-4 sm:absolute sm:top-auto sm:left-auto sm:right-0 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[100]"
          >
            <div className="p-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-serif font-bold text-sm">Notifications</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={markAllAsRead}
                  className="text-[10px] font-bold text-[#5A5A40] uppercase tracking-widest hover:underline"
                >
                  Mark all read
                </button>
                <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto no-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-12 text-center">
                  <Bell size={32} className="mx-auto text-gray-200 mb-4" />
                  <p className="text-xs text-gray-400 font-serif italic">No notifications yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={cn(
                        "p-4 hover:bg-gray-50 cursor-pointer transition-colors flex gap-3 items-start",
                        n.status === 'unread' ? "bg-blue-50/30" : "bg-white"
                      )}
                    >
                      <div className="mt-1 flex-shrink-0">
                        {getIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <p className={cn("text-xs leading-snug", n.status === 'unread' ? "font-bold text-gray-900" : "text-gray-600")}>
                            {n.title}
                          </p>
                          <span className="text-[9px] text-gray-400 whitespace-nowrap mt-0.5">
                            {format(n.createdAt?.toDate ? n.createdAt.toDate() : new Date(), 'MMM d')}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                          {n.message}
                        </p>
                      </div>
                      {n.status === 'unread' && (
                        <div className="mt-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-gray-50 text-center bg-gray-50/30 flex flex-col gap-2">
              <Link to="/inbox" onClick={() => setIsOpen(false)} className="text-xs font-bold text-[#5A5A40] uppercase tracking-wider hover:underline">
                Open Personal Inbox
              </Link>
              <Link to="/profile" onClick={() => setIsOpen(false)} className="text-[9px] font-bold text-gray-400 uppercase tracking-widest hover:text-[#5A5A40]">
                Configure Preferences
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
