import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query, updateDoc, where, writeBatch, deleteDoc } from 'firebase/firestore';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  Inbox as InboxIcon,
  Info,
  Mail,
  MailOpen,
  Megaphone,
  MessageSquare,
  Search,
  Trash2,
} from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../App';
import { Notification as NotificationType, NotificationDelivery } from '../types';
import { cn } from '../lib/utils';

const tabs = ['all', 'unread', 'announcement', 'availability', 'assignment', 'duty', 'broadcast', 'system'] as const;
type Tab = typeof tabs[number];

const toDate = (value: any): Date | null => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value: any) => {
  const date = toDate(value);
  if (!date) return 'Recent';
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return new Intl.DateTimeFormat(undefined, sameDay ? { hour: 'numeric', minute: '2-digit' } : { month: 'short', day: 'numeric' }).format(date);
};

const matchesTab = (item: NotificationType, tab: Tab) => {
  if (tab === 'all') return true;
  if (tab === 'unread') return item.status === 'unread';
  if (tab === 'availability' || tab === 'assignment') return item.sourceType === tab;
  return item.type === tab;
};

const deliveryTone = (status: NotificationDelivery['status']) => {
  if (status === 'delivered' || status === 'read') return 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300';
  if (status === 'failed') return 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300';
  if (status === 'skipped') return 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300';
  return 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300';
};

export default function Inbox() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<NotificationType | null>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [mobileDetail, setMobileDetail] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'notifications'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const next = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as NotificationType));
      setNotifications(next);
      setLoading(false);
    }, (error) => {
      console.error('Inbox: failed to load messages', error);
      setLoading(false);
    });
  }, [user]);

  useEffect(() => {
    const id = searchParams.get('id') || searchParams.get('noteId');
    if (!id || notifications.length === 0) return;
    const target = notifications.find((item) => item.id === id);
    if (target) {
      setSelected(target);
      setMobileDetail(true);
    }
  }, [notifications, searchParams]);

  useEffect(() => {
    if (!selected?.id || selected.status !== 'unread') return;
    updateDoc(doc(db, 'notifications', selected.id), { status: 'read' }).catch((error) => console.error('Inbox: failed to mark message read', error));
  }, [selected]);

  useEffect(() => {
    if (!selected?.id) return;
    const latest = notifications.find((item) => item.id === selected.id);
    if (latest) setSelected(latest);
  }, [notifications, selected?.id]);

  const unreadCount = notifications.filter((item) => item.status === 'unread').length;

  const visible = useMemo(() => notifications.filter((item) => {
    if (!matchesTab(item, tab)) return false;
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return `${item.title} ${item.message} ${item.sourceType || ''} ${(item.channels || []).join(' ')}`.toLowerCase().includes(needle);
  }), [notifications, search, tab]);

  const markAllRead = async () => {
    const unread = notifications.filter((item) => item.status === 'unread' && item.id);
    if (!unread.length) return;
    const batch = writeBatch(db);
    unread.forEach((item) => batch.update(doc(db, 'notifications', item.id!), { status: 'read' }));
    await batch.commit();
  };

  const toggleUnread = async (item: NotificationType) => {
    if (!item.id) return;
    await updateDoc(doc(db, 'notifications', item.id), { status: item.status === 'unread' ? 'read' : 'unread' });
  };

  const removeMessage = async (item: NotificationType) => {
    if (!item.id || !window.confirm('Delete this message from your KCFC Inbox?')) return;
    await deleteDoc(doc(db, 'notifications', item.id));
    if (selected?.id === item.id) {
      setSelected(null);
      setMobileDetail(false);
    }
  };

  const openMessage = (item: NotificationType) => {
    setSelected(item);
    setMobileDetail(true);
  };

  const followMessage = () => {
    if (selected?.link) navigate(selected.link);
  };

  return (
    <div className="kcfc-page space-y-5 pb-4">
      <section className="overflow-hidden rounded-[26px] border border-blue-100 bg-gradient-to-br from-[#123B66] via-[#174E83] to-[#2563EB] p-5 text-white shadow-[0_18px_45px_rgba(18,59,102,0.18)] sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-blue-100"><InboxIcon className="h-4 w-4" /><span className="text-[11px] font-extrabold uppercase tracking-[0.13em]">KCFC Inbox</span></div>
            <h1 className="text-[28px] font-extrabold tracking-[-0.03em] sm:text-[34px]">Every important message, in one place.</h1>
            <p className="mt-2 max-w-2xl text-[14px] leading-6 text-blue-50/90">Push, email and future connected apps are delivery channels. Your KCFC Inbox is the durable record you can always return to.</p>
          </div>
          {unreadCount > 0 && (
            <button type="button" onClick={markAllRead} className="inline-flex min-h-11 w-fit items-center gap-2 rounded-2xl bg-white px-4 text-[12px] font-bold text-[#123B66] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><CheckCheck className="h-4 w-4" /> Mark all read</button>
          )}
        </div>
      </section>

      <section className="grid min-h-[610px] overflow-hidden rounded-[24px] border border-slate-200 bg-white lg:grid-cols-[420px_1fr] dark:border-white/10 dark:bg-[#10243a]">
        <div className={cn('border-r border-slate-100 dark:border-white/10', mobileDetail && 'hidden lg:block')}>
          <div className="space-y-3 border-b border-slate-100 p-4 dark:border-white/10">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input aria-label="Search KCFC Inbox" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search messages" className="min-h-11 w-full rounded-xl border border-slate-200 bg-[#F7F9FC] pl-10 pr-3 text-[13px] text-[#172033] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:ring-blue-500/20" />
            </div>
            <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar" aria-label="Inbox filters">
              {tabs.map((item) => {
                const count = item === 'all' ? notifications.length : notifications.filter((note) => matchesTab(note, item)).length;
                if (count === 0 && !['all', 'unread'].includes(item)) return null;
                return <button key={item} type="button" aria-pressed={tab === item} onClick={() => setTab(item)} className={cn('min-h-9 shrink-0 rounded-xl px-3 text-[10px] font-bold capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500', tab === item ? 'bg-[#123B66] text-white' : 'bg-[#F7F9FC] text-slate-500 dark:bg-white/5 dark:text-slate-300')}>{item}{count > 0 && <span className="ml-1.5 opacity-70">{count}</span>}</button>;
              })}
            </div>
          </div>

          {loading ? (
            <div className="space-y-2 p-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/5" />)}</div>
          ) : visible.length === 0 ? (
            <EmptyList search={search} />
          ) : (
            <div className="max-h-[520px] overflow-y-auto p-2">
              {visible.map((item) => <MessageRow key={item.id} item={item} selected={selected?.id === item.id} onOpen={() => openMessage(item)} />)}
            </div>
          )}
        </div>

        <div className={cn('min-w-0', !mobileDetail && 'hidden lg:block')}>
          {!selected ? (
            <div className="flex h-full min-h-[520px] flex-col items-center justify-center px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200"><Mail className="h-7 w-7" /></div>
              <h2 className="mt-4 text-[18px] font-extrabold text-[#172033] dark:text-white">Choose a message</h2>
              <p className="mt-2 max-w-sm text-[13px] leading-5 text-slate-500 dark:text-slate-400">Announcements, assignments, availability requests and important notices will remain here even after you dismiss a push alert.</p>
            </div>
          ) : (
            <article className="flex h-full min-h-[520px] flex-col">
              <div className="flex items-center gap-2 border-b border-slate-100 p-3 dark:border-white/10 lg:hidden">
                <button type="button" aria-label="Back to Inbox" onClick={() => setMobileDetail(false)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F7F9FC] text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-white/5 dark:text-slate-300"><ArrowLeft className="h-5 w-5" /></button>
                <span className="text-[12px] font-bold text-slate-500 dark:text-slate-400">Back to Inbox</span>
              </div>
              <div className="flex-1 p-5 sm:p-7">
                <div className="flex flex-wrap items-center gap-2">
                  <MessageIcon type={selected.type} />
                  <span className="rounded-full bg-[#EAF3FF] px-2.5 py-1 text-[10px] font-extrabold capitalize text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200">{categoryLabel(selected)}</span>
                  {selected.urgency && selected.urgency !== 'normal' && <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase', selected.urgency === 'urgent' ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300')}>{selected.urgency}</span>}
                  <span className="ml-auto text-[11px] font-medium text-slate-400">{formatDate(selected.createdAt)}</span>
                </div>
                <h2 className="mt-5 text-[24px] font-extrabold leading-tight tracking-[-0.02em] text-[#172033] dark:text-white sm:text-[28px]">{selected.title}</h2>
                <p className="mt-4 whitespace-pre-wrap text-[14px] leading-7 text-slate-600 dark:text-slate-300">{selected.message}</p>

                {selected.channels && selected.channels.length > 0 && (
                  <div className="mt-6 rounded-2xl bg-[#F7F9FC] p-4 dark:bg-white/5">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-400">Planned delivery channels</p>
                    <div className="mt-2 flex flex-wrap gap-2">{selected.channels.map((channel) => <span key={channel} className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold capitalize text-slate-500 shadow-sm dark:bg-white/10 dark:text-slate-300">{channel}</span>)}</div>
                    <p className="mt-2 text-[10px] leading-4 text-slate-400">A channel listed here is part of the routing plan; it does not by itself prove provider delivery.</p>
                  </div>
                )}

                {selected.deliveries && selected.deliveries.length > 0 && (
                  <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-400">Delivery diagnostics</p>
                    <div className="mt-3 space-y-2">
                      {selected.deliveries.map((delivery, index) => (
                        <div key={`${delivery.channel}-${index}`} className="flex flex-wrap items-center gap-2 rounded-xl bg-[#F7F9FC] px-3 py-2 dark:bg-white/5">
                          <span className="text-[11px] font-bold capitalize text-[#172033] dark:text-white">{delivery.channel}</span>
                          <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide', deliveryTone(delivery.status))}>{delivery.status}</span>
                          {delivery.detail && <span className="w-full text-[10px] leading-4 text-slate-500 dark:text-slate-400 sm:ml-auto sm:w-auto">{delivery.detail}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selected.link && (
                  <button type="button" onClick={followMessage} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#123B66] px-4 text-[12px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Open related page <ChevronRight className="h-4 w-4" /></button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 border-t border-slate-100 p-4 dark:border-white/10">
                <button type="button" onClick={() => toggleUnread(selected)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#F7F9FC] px-3 text-[11px] font-bold text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:bg-white/5 dark:text-slate-300">{selected.status === 'unread' ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4" />}{selected.status === 'unread' ? 'Mark read' : 'Mark unread'}</button>
                <button type="button" onClick={() => removeMessage(selected)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-red-50 px-3 text-[11px] font-bold text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:bg-red-500/10 dark:text-red-300"><Trash2 className="h-4 w-4" /> Delete</button>
              </div>
            </article>
          )}
        </div>
      </section>
    </div>
  );
}

function MessageRow({ item, selected, onOpen }: { item: NotificationType; selected: boolean; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} className={cn('mb-1 flex min-h-[78px] w-full items-start gap-3 rounded-2xl p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500', selected ? 'bg-[#EAF3FF] dark:bg-blue-500/15' : 'hover:bg-[#F7F9FC] dark:hover:bg-white/5')}><div className={cn('mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl', item.status === 'unread' ? 'bg-[#123B66] text-white' : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300')}><MessageIcon type={item.type} plain /></div><div className="min-w-0 flex-1"><div className="flex items-start gap-2"><p className={cn('line-clamp-1 text-[13px] text-[#172033] dark:text-white', item.status === 'unread' ? 'font-extrabold' : 'font-semibold')}>{item.title}</p><span className="ml-auto shrink-0 text-[9px] font-medium text-slate-400">{formatDate(item.createdAt)}</span></div><p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500 dark:text-slate-400">{item.message}</p></div>{item.status === 'unread' && <span className="mt-4 h-2 w-2 shrink-0 rounded-full bg-[#2563EB]" />}</button>;
}

function MessageIcon({ type, plain = false }: { type: NotificationType['type']; plain?: boolean }) {
  const className = plain ? 'h-4 w-4' : 'h-4 w-4 text-[#2563EB]';
  if (type === 'announcement') return <Megaphone className={className} />;
  if (type === 'duty') return <CalendarDays className={className} />;
  if (type === 'broadcast') return <MessageSquare className={className} />;
  return <Info className={className} />;
}

function categoryLabel(item: NotificationType) {
  if (item.sourceType === 'availability') return 'Availability';
  if (item.sourceType === 'assignment') return 'Assignment';
  if (item.type === 'announcement') return 'Announcement';
  if (item.type === 'duty') return 'Duty';
  if (item.type === 'broadcast') return 'Broadcast';
  return 'System';
}

function EmptyList({ search }: { search: string }) {
  return <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200">{search ? <Search className="h-6 w-6" /> : <InboxIcon className="h-6 w-6" />}</div><h3 className="mt-4 text-[15px] font-extrabold text-[#172033] dark:text-white">{search ? 'No matching messages' : 'Nothing here right now'}</h3><p className="mt-2 max-w-xs text-[12px] leading-5 text-slate-500 dark:text-slate-400">{search ? 'Try another keyword or change the message filter.' : 'New KCFC notices will appear here automatically.'}</p></div>;
}
