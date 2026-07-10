import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { useAuth } from '../App';
import { Notification as NotificationType } from '../types';
import { 
  Inbox as InboxIcon, 
  Trash2, 
  MailOpen, 
  Mail, 
  Search, 
  Calendar, 
  Megaphone, 
  Info, 
  MessageSquare, 
  CheckSquare, 
  ChevronRight, 
  Clock, 
  ArrowLeft,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { useSearchParams } from 'react-router-dom';

export default function Inbox() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const noteIdParam = searchParams.get('id') || searchParams.get('noteId');
  const [hasInitiallySelectedFromUrl, setHasInitiallySelectedFromUrl] = useState(false);

  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [selectedNote, setSelectedNote] = useState<NotificationType | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'broadcast' | 'duty' | 'announcement' | 'system'>('all');
  const [mobileDetailView, setMobileDetailView] = useState(false);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const notes = snap.docs.map(d => ({ id: d.id, ...d.data() } as NotificationType));
      setNotifications(notes);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching inbox notifications:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Handle auto-selecting a notification when noteIdParam is set in URL
  useEffect(() => {
    if (loading || notifications.length === 0 || !noteIdParam || hasInitiallySelectedFromUrl) return;

    const targetNote = notifications.find(n => n.id === noteIdParam);
    if (targetNote) {
      setSelectedNote(targetNote);
      setMobileDetailView(true);
      setHasInitiallySelectedFromUrl(true);
    }
  }, [notifications, noteIdParam, loading, hasInitiallySelectedFromUrl]);

  // Keep selectedNote reference updated with latest live data
  useEffect(() => {
    if (selectedNote && notifications.length > 0) {
      const updatedSelected = notifications.find(n => n.id === selectedNote.id);
      if (updatedSelected && updatedSelected.status !== selectedNote.status) {
        setSelectedNote(updatedSelected);
      }
    }
  }, [notifications, selectedNote]);

  // Mark selected notification as read when viewed
  useEffect(() => {
    if (selectedNote && selectedNote.id && selectedNote.status === 'unread') {
      markAsRead(selectedNote.id);
    }
  }, [selectedNote]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { status: 'read' });
    } catch (err) {
      console.error("Failed to mark read:", err);
    }
  };

  const markAsUnread = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await updateDoc(doc(db, 'notifications', id), { status: 'unread' });
      // If we are currently viewing this, we can optionally deselect or just let it be marked unread
    } catch (err) {
      console.error("Failed to mark unread:", err);
    }
  };

  const deleteNotification = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await deleteDoc(doc(db, 'notifications', id));
      if (selectedNote?.id === id) {
        setSelectedNote(null);
        setMobileDetailView(false);
      }
    } catch (err: any) {
      console.error("Failed to delete notification:", err);
      alert("Failed to delete message: " + (err.message || err.toString()));
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => n.status === 'unread');
    if (unread.length === 0) return;
    try {
      const batch = writeBatch(db);
      unread.forEach(n => {
        if (n.id) batch.update(doc(db, 'notifications', n.id), { status: 'read' });
      });
      await batch.commit();
    } catch (err: any) {
      console.error("Failed marking all read:", err);
      alert("Failed to mark all as read: " + (err.message || err.toString()));
    }
  };

  const clearReadNotifications = async () => {
    const read = notifications.filter(n => n.status === 'read');
    if (read.length === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete all ${read.length} read notifications from your inbox?`)) return;

    try {
      const batch = writeBatch(db);
      read.forEach(n => {
        if (n.id) batch.delete(doc(db, 'notifications', n.id));
      });
      await batch.commit();
      setSelectedNote(null);
      setMobileDetailView(false);
    } catch (err: any) {
      console.error("Failed clearing read items:", err);
      alert("Failed to clear read messages: " + (err.message || err.toString()));
    }
  };

  // Multi-select state and handlers
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab]);

  const bulkMarkAsRead = async () => {
    if (selectedIds.length === 0) return;
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.update(doc(db, 'notifications', id), { status: 'read' });
      });
      await batch.commit();
      setSelectedIds([]);
    } catch (err: any) {
      console.error("Bulk mark read failed:", err);
      alert("Failed to mark messages as read: " + err.message);
    }
  };

  const bulkMarkAsUnread = async () => {
    if (selectedIds.length === 0) return;
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.update(doc(db, 'notifications', id), { status: 'unread' });
      });
      await batch.commit();
      setSelectedIds([]);
    } catch (err: any) {
      console.error("Bulk mark unread failed:", err);
      alert("Failed to mark messages as unread: " + err.message);
    }
  };

  const bulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete these ${selectedIds.length} selected messages?`)) return;
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.delete(doc(db, 'notifications', id));
      });
      await batch.commit();
      if (selectedNote && selectedIds.includes(selectedNote.id!)) {
        setSelectedNote(null);
        setMobileDetailView(false);
      }
      setSelectedIds([]);
    } catch (err: any) {
      console.error("Bulk delete failed:", err);
      alert("Failed to delete messages: " + err.message);
    }
  };

  const getIcon = (type: NotificationType['type'], size = 18) => {
    switch (type) {
      case 'announcement': return <Megaphone size={size} className="text-blue-500 dark:text-blue-400" />;
      case 'duty': return <Calendar size={size} className="text-orange-500 dark:text-orange-400" />;
      case 'broadcast': return <MessageSquare size={size} className="text-purple-500 dark:text-purple-400" />;
      default: return <Info size={size} className="text-[#5A5A40] dark:text-[#d4d4bc]" />;
    }
  };

  const getCategoryLabel = (type: NotificationType['type']) => {
    switch (type) {
      case 'announcement': return 'Announcement';
      case 'duty': return 'Duty/Assignment';
      case 'broadcast': return 'Community Broadcast';
      default: return 'System Notice';
    }
  };

  // Filter & Search
  const filteredNotes = notifications.filter(n => {
    const matchesTab = activeTab === 'all' || n.type === activeTab;
    const matchesQuery = 
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      n.message.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesQuery;
  });

  const unreadCount = notifications.filter(n => n.status === 'unread').length;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-[#1a1a1a] dark:text-[#f5f5f0] tracking-tight">Personal Inbox</h1>
          <p className="text-gray-500 dark:text-gray-400 font-sans text-sm mt-1">
            Read and manage your personal portal alerts, community broadcasts, and liturgical scheduling notices.
          </p>
        </div>

        {/* Global Toolbar */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="px-3 py-1.5 text-xs font-semibold bg-[#5A5A40]/5 hover:bg-[#5A5A40]/10 text-[#5A5A40] dark:text-[#d4d4bc] dark:bg-[#5A5A40]/10 dark:hover:bg-[#5A5A40]/20 rounded-full transition-all flex items-center gap-1"
            >
              <MailOpen size={13} />
              Mark All Read
            </button>
          )}
          {notifications.some(n => n.status === 'read') && (
            <button
              onClick={clearReadNotifications}
              className="px-3 py-1.5 text-xs font-semibold bg-red-500/5 hover:bg-red-500/10 text-red-600 dark:text-red-400 dark:bg-red-500/10 dark:hover:bg-red-500/20 rounded-full transition-all flex items-center gap-1"
            >
              <Trash2 size={13} />
              Clear Read ({notifications.filter(n => n.status === 'read').length})
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="min-h-[450px] bg-white dark:bg-[#1c1c18] border border-gray-100 dark:border-white/5 rounded-[32px] flex items-center justify-center">
          <div className="animate-pulse text-center">
            <div className="w-12 h-12 bg-[#5A5A40]/10 rounded-full mb-4 mx-auto flex items-center justify-center">
              <InboxIcon size={24} className="text-[#5A5A40] animate-bounce" />
            </div>
            <p className="text-xs text-gray-400 font-serif italic">Loading your messages...</p>
          </div>
        </div>
      ) : notifications.length === 0 ? (
        <div className="min-h-[450px] bg-white dark:bg-[#1c1c18] border border-gray-100 dark:border-white/5 rounded-[32px] p-12 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-[#5A5A40]/10 rounded-full mb-4 flex items-center justify-center">
            <InboxIcon size={32} className="text-[#5A5A40]" />
          </div>
          <h3 className="text-lg font-serif font-bold text-[#1a1a1a] dark:text-[#f5f5f0]">Your Inbox is Clear</h3>
          <p className="text-gray-400 dark:text-gray-500 text-sm max-w-md mt-2 leading-relaxed">
            Beautiful! You do not have any notices at the moment. All future community broadcasts, scheduling changes, and portal alerts will show up here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[550px]">
          {/* Left Column: Sidebar with tabs & search + message list */}
          <div className={cn(
            "lg:col-span-5 bg-white dark:bg-[#1c1c18] border border-gray-100 dark:border-white/5 rounded-[32px] flex flex-col overflow-hidden transition-all",
            mobileDetailView ? "hidden lg:flex" : "flex"
          )}>
            {/* Search and Tabs */}
            <div className="p-4 border-b border-gray-100 dark:border-white/5 space-y-3 bg-gray-50/50 dark:bg-[#171714]">
              {/* Search input */}
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white dark:bg-[#252520] border border-gray-100 dark:border-white/5 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-[#5A5A40] text-[#1a1a1a] dark:text-[#f5f5f0]"
                />
              </div>

              {/* Category tabs */}
              <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
                {(['all', 'broadcast', 'duty', 'announcement', 'system'] as const).map(tab => {
                  const count = tab === 'all' 
                    ? notifications.length 
                    : notifications.filter(n => n.type === tab).length;

                  if (count === 0 && tab !== 'all') return null;

                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-semibold capitalize whitespace-nowrap transition-all",
                        activeTab === tab 
                          ? "bg-[#5A5A40] text-white" 
                          : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
                      )}
                    >
                      {tab === 'all' ? 'All' : tab}
                      <span className={cn(
                        "ml-1.5 px-1.5 py-0.5 text-[9px] rounded-full",
                        activeTab === tab 
                          ? "bg-white/20 text-white" 
                          : "bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400"
                      )}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bulk Selection Bar */}
            <div className="px-4 py-2.5 bg-gray-50/70 dark:bg-[#1a1a17] border-b border-gray-100 dark:border-white/5 flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filteredNotes.length > 0 && selectedIds.length === filteredNotes.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(filteredNotes.map(n => n.id!).filter(Boolean));
                    } else {
                      setSelectedIds([]);
                    }
                  }}
                  className="rounded border-gray-300 dark:border-white/10 text-[#5A5A40] focus:ring-[#5A5A40] h-4 w-4 cursor-pointer"
                />
                <span className="font-bold uppercase tracking-wider text-[10px] text-gray-400">
                  {selectedIds.length > 0 ? `${selectedIds.length} Selected` : 'Select All'}
                </span>
              </div>

              {selectedIds.length > 0 && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={bulkMarkAsRead}
                    title="Mark selected as read"
                    className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 text-[#5A5A40] dark:text-[#d4d4bc] rounded flex items-center gap-1 transition-all"
                  >
                    <MailOpen size={13} />
                    <span className="hidden sm:inline font-bold uppercase tracking-widest text-[9px]">Read</span>
                  </button>
                  <button
                    onClick={bulkMarkAsUnread}
                    title="Mark selected as unread"
                    className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 rounded flex items-center gap-1 transition-all"
                  >
                    <Mail size={13} />
                    <span className="hidden sm:inline font-bold uppercase tracking-widest text-[9px]">Unread</span>
                  </button>
                  <button
                    onClick={bulkDelete}
                    title="Delete selected"
                    className="p-1 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 hover:text-red-700 rounded flex items-center gap-1 transition-all"
                  >
                    <Trash2 size={13} />
                    <span className="hidden sm:inline font-bold uppercase tracking-widest text-[9px]">Delete</span>
                  </button>
                </div>
              )}
            </div>

            {/* Message List */}
            <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-gray-50 dark:divide-white/5 max-h-[500px] lg:max-h-[600px]">
              {filteredNotes.length === 0 ? (
                <div className="p-12 text-center">
                  <Search size={28} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                  <p className="text-xs text-gray-400 font-serif italic">No messages match your search.</p>
                </div>
              ) : (
                filteredNotes.map((n) => {
                  const isSelected = selectedNote?.id === n.id;
                  const isUnread = n.status === 'unread';
                  const isChecked = selectedIds.includes(n.id!);

                  return (
                    <div
                      key={n.id}
                      onClick={() => {
                        setSelectedNote(n);
                        setMobileDetailView(true);
                      }}
                      className={cn(
                        "p-4 hover:bg-gray-50/50 dark:hover:bg-white/[0.02] cursor-pointer transition-all flex gap-3 items-start relative group",
                        isSelected 
                          ? "bg-[#5A5A40]/5 dark:bg-[#5A5A40]/10 border-l-4 border-[#5A5A40]" 
                          : isUnread 
                            ? "bg-blue-50/20 dark:bg-blue-500/[0.03] border-l-4 border-blue-500" 
                            : "border-l-4 border-transparent"
                      )}
                    >
                      {/* Checkbox for Multi-Select */}
                      <div 
                        className="mt-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds(prev => [...prev, n.id!]);
                            } else {
                              setSelectedIds(prev => prev.filter(id => id !== n.id));
                            }
                          }}
                          className="rounded border-gray-300 dark:border-white/10 text-[#5A5A40] focus:ring-[#5A5A40] h-4 w-4 cursor-pointer"
                        />
                      </div>

                      {/* Left Badge/Icon */}
                      <div className="mt-1 p-1.5 bg-gray-50 dark:bg-white/[0.03] rounded-xl flex-shrink-0">
                        {getIcon(n.type, 16)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className={cn(
                            "text-xs leading-snug line-clamp-1",
                            isUnread ? "font-bold text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300"
                          )}>
                            {n.title}
                          </h4>
                          <span className="text-[9px] text-gray-400 dark:text-gray-500 whitespace-nowrap mt-0.5">
                            {format(n.createdAt?.toDate ? n.createdAt.toDate() : new Date(), 'MMM d, h:mm a')}
                          </span>
                        </div>
                        
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 leading-relaxed">
                          {n.message}
                        </p>

                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[8px] uppercase tracking-wider font-bold text-gray-400 bg-gray-100 dark:bg-white/5 px-2 py-0.5 rounded-full">
                            {getCategoryLabel(n.type)}
                          </span>
                        </div>
                      </div>

                      {/* Micro actions on hover */}
                      <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white dark:bg-[#1c1c18] pl-2 py-0.5 rounded-full shadow-sm">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isUnread) {
                              markAsRead(n.id!);
                            } else {
                              markAsUnread(n.id!, e);
                            }
                          }}
                          title={isUnread ? "Mark as Read" : "Mark as Unread"}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full"
                        >
                          {isUnread ? <MailOpen size={12} /> : <Mail size={12} />}
                        </button>
                        <button
                          onClick={(e) => deleteNotification(n.id!, e)}
                          title="Delete Message"
                          className="p-1 hover:bg-red-500/10 text-gray-400 hover:text-red-500 rounded-full"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Detailed View */}
          <div className={cn(
            "lg:col-span-7 bg-white dark:bg-[#1c1c18] border border-gray-100 dark:border-white/5 rounded-[32px] flex flex-col overflow-hidden",
            mobileDetailView ? "flex" : "hidden lg:flex"
          )}>
            {selectedNote ? (
              <div className="flex flex-col h-full min-h-[450px]">
                {/* Detail Header / Mobile Back bar */}
                <div className="p-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-[#171714]">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setMobileDetailView(false)}
                      className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"
                    >
                      <ArrowLeft size={18} />
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 bg-[#5A5A40]/10 text-[#5A5A40] dark:text-[#d4d4bc] rounded-xl">
                        {getIcon(selectedNote.type, 18)}
                      </span>
                      <div>
                        <span className="text-[10px] font-bold text-[#5A5A40] dark:text-[#d4d4bc] uppercase tracking-wider block">
                          {getCategoryLabel(selectedNote.type)}
                        </span>
                        <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 text-[10px] mt-0.5">
                          <Clock size={10} />
                          <span>
                            {format(selectedNote.createdAt?.toDate ? selectedNote.createdAt.toDate() : new Date(), 'EEEE, MMMM d, yyyy @ h:mm a')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        if (selectedNote.status === 'unread') {
                          markAsRead(selectedNote.id!);
                        } else {
                          markAsUnread(selectedNote.id!, e);
                        }
                      }}
                      className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-[#f5f5f0] hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"
                      title={selectedNote.status === 'unread' ? "Mark as Read" : "Mark as Unread"}
                    >
                      {selectedNote.status === 'unread' ? <MailOpen size={18} /> : <Mail size={18} />}
                    </button>
                    <button
                      onClick={(e) => deleteNotification(selectedNote.id!, e)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                      title="Delete notification"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* Detail Body */}
                <div className="p-6 sm:p-8 flex-1 overflow-y-auto space-y-6 max-h-[450px] lg:max-h-[550px] no-scrollbar">
                  {/* Styled Message Box */}
                  <div className="bg-[#fcfcf9] dark:bg-[#1a1a17] border border-gray-100 dark:border-white/5 rounded-3xl p-6 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 inset-x-0 h-1.5 bg-[#5A5A40]" />
                    
                    <h2 className="text-xl font-serif font-bold text-[#4A4A30] dark:text-[#d4d4bc] border-b border-gray-100 dark:border-white/5 pb-4 mb-4 leading-snug">
                      {selectedNote.title}
                    </h2>
                    
                    <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed space-y-4 whitespace-pre-wrap font-sans">
                      {selectedNote.message}
                    </div>

                    {selectedNote.link && (
                      <div className="pt-6 mt-6 border-t border-gray-100 dark:border-white/5 flex justify-end">
                        <a
                          href={selectedNote.link}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#5A5A40] text-white text-xs font-bold uppercase tracking-wider rounded-full hover:shadow-md transition-all"
                        >
                          Go to Resource
                          <ChevronRight size={14} />
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="text-center">
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-serif italic max-w-sm mx-auto leading-relaxed">
                      This alert was issued via the KCFC Community Portal. You can manage your notification preferences anytime under My Profile settings.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center min-h-[450px]">
                <div className="w-16 h-16 bg-gray-50 dark:bg-white/[0.02] rounded-full mb-4 flex items-center justify-center text-gray-300 dark:text-gray-600">
                  <InboxIcon size={28} />
                </div>
                <h3 className="text-sm font-serif font-bold text-gray-400 dark:text-gray-500">No Message Selected</h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs">
                  Choose a notification or broadcast from the list on the left to read its full message content here.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
