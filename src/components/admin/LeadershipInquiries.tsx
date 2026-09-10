import React, { useEffect, useMemo, useState } from 'react';
import { Archive, ArrowLeft, CheckCircle2, Inbox, Mail, Search } from 'lucide-react';
import { collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { ContactMessage } from '../../types';
import { cn } from '../../lib/utils';

type Filter = 'unread' | 'active' | 'archived';

function messageDate(message: ContactMessage) {
  const raw = message.createdAt as unknown as { toDate?: () => Date } | string | number | Date | undefined;
  try {
    const date = raw && typeof raw === 'object' && 'toDate' in raw && typeof raw.toDate === 'function'
      ? raw.toDate()
      : new Date((raw as string | number | Date | undefined) || 0);
    if (Number.isNaN(date.getTime())) return 'Date unavailable';
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
  } catch {
    return 'Date unavailable';
  }
}

export default function LeadershipInquiries() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [filter, setFilter] = useState<Filter>('unread');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'messages'),
      (snapshot) => {
        const next = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data(), status: entry.data().status || 'unread' } as ContactMessage));
        next.sort((a, b) => {
          const aDate = Date.parse(messageDate(a));
          const bDate = Date.parse(messageDate(b));
          return (Number.isNaN(bDate) ? 0 : bDate) - (Number.isNaN(aDate) ? 0 : aDate);
        });
        setMessages(next);
        setLoading(false);
      },
      (error) => {
        console.error('Leadership inquiry subscription failed', error);
        setFeedback('Inquiries could not be loaded. The preserved legacy administration workspace remains available in Advanced tools.');
        setLoading(false);
      },
    );
    return unsubscribe;
  }, []);

  const counts = useMemo(() => ({
    unread: messages.filter((message) => message.status === 'unread').length,
    active: messages.filter((message) => message.status !== 'archived').length,
    archived: messages.filter((message) => message.status === 'archived').length,
  }), [messages]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return messages.filter((message) => {
      const matchesFilter = filter === 'unread'
        ? message.status === 'unread'
        : filter === 'archived'
          ? message.status === 'archived'
          : message.status !== 'archived';
      if (!matchesFilter) return false;
      if (!needle) return true;
      return [message.name, message.email, message.subject, message.message]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [messages, filter, search]);

  const selected = messages.find((message) => message.id === selectedId) || null;

  const setStatus = async (message: ContactMessage, status: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      await updateDoc(doc(db, 'messages', message.id), { status });
      setFeedback(status === 'archived' ? 'Inquiry archived.' : status === 'unread' ? 'Inquiry marked unread.' : 'Inquiry marked read.');
    } catch (error) {
      console.error('Inquiry status update failed', error);
      setFeedback('Could not update this inquiry. No message content was changed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="kcfc-surface overflow-hidden" aria-labelledby="leadership-inquiries-title">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-5 dark:border-white/10">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200">
            <Inbox className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[#2563EB]">Inbound communication</span>
            <h2 id="leadership-inquiries-title" className="mt-1 text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white">Website inquiries</h2>
            <p className="mt-1 max-w-2xl text-[12px] leading-5 text-slate-500 dark:text-slate-400">Review, mark and archive incoming messages without mixing them with member deletion, security or broadcast controls. Email replies remain intentionally outside this focused queue for now.</p>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-100 p-3 sm:p-4 dark:border-white/10">
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Inquiry filters">
          {([
            ['unread', 'Unread', counts.unread],
            ['active', 'Active', counts.active],
            ['archived', 'Archived', counts.archived],
          ] as const).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              onClick={() => { setFilter(id); setSelectedId(null); }}
              className={cn(
                'min-h-11 shrink-0 rounded-xl border px-4 text-[11px] font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                filter === id
                  ? 'border-[#2563EB] bg-[#EAF3FF] text-[#123B66] dark:border-blue-400/40 dark:bg-blue-500/10 dark:text-blue-100'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300',
              )}
            >
              {label} <span className="ml-1 opacity-60">{count}</span>
            </button>
          ))}
        </div>

        <label className="relative mt-3 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <span className="sr-only">Search inquiries</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search sender, email, subject or message"
            className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-[13px] text-[#172033] outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-500/20 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
          />
        </label>
      </div>

      {feedback && <div className="mx-4 mt-4 rounded-xl border border-blue-200 bg-[#EAF3FF] px-4 py-3 text-[11px] text-[#123B66] dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-100" role="status">{feedback}</div>}

      <div className="grid min-h-[420px] lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.4fr)]">
        <div className={cn('border-r-0 border-slate-100 p-3 lg:border-r dark:border-white/10', selected && 'hidden lg:block')}>
          {loading ? (
            <div className="px-4 py-12 text-center text-[12px] text-slate-400">Loading inquiries…</div>
          ) : visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center dark:border-white/10">
              <CheckCircle2 className="mx-auto h-6 w-6 text-slate-300" />
              <p className="mt-2 text-[12px] font-bold text-slate-500 dark:text-slate-400">No inquiries in this view.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {visible.map((message) => (
                <button
                  key={message.id}
                  type="button"
                  onClick={() => setSelectedId(message.id)}
                  className={cn(
                    'min-h-[92px] w-full rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                    selectedId === message.id
                      ? 'border-blue-300 bg-[#EAF3FF] dark:border-blue-400/30 dark:bg-blue-500/10'
                      : message.status === 'unread'
                        ? 'border-amber-200 bg-amber-50/50 hover:border-amber-300 dark:border-amber-400/20 dark:bg-amber-500/[0.05]'
                        : 'border-slate-200 bg-white hover:border-blue-200 dark:border-white/10 dark:bg-white/[0.03]',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-extrabold text-[#172033] dark:text-white">{message.name || 'Unknown sender'}</p>
                      <p className="mt-0.5 truncate text-[10px] text-slate-400">{message.email}</p>
                    </div>
                    {message.status === 'unread' && <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" aria-label="Unread" />}
                  </div>
                  <p className="mt-2 truncate text-[11px] font-bold text-slate-700 dark:text-slate-300">{message.subject || '(No subject)'}</p>
                  <p className="mt-1 text-[9px] uppercase tracking-wide text-slate-400">{messageDate(message)}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={cn('p-4 sm:p-5', !selected && 'hidden lg:flex lg:items-center lg:justify-center')}>
          {selected ? (
            <article className="w-full">
              <button type="button" onClick={() => setSelectedId(null)} className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-[11px] font-bold text-slate-600 lg:hidden dark:border-white/10 dark:text-slate-300">
                <ArrowLeft className="h-4 w-4" /> Back to inquiries
              </button>

              <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between dark:border-white/10">
                <div>
                  <span className={cn('inline-flex min-h-7 items-center rounded-full px-2.5 text-[9px] font-extrabold uppercase tracking-wide', selected.status === 'unread' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : selected.status === 'archived' ? 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300')}>{selected.status || 'unread'}</span>
                  <h3 className="mt-3 text-[19px] font-extrabold tracking-tight text-[#172033] dark:text-white">{selected.subject || '(No subject)'}</h3>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">From <strong>{selected.name || 'Unknown sender'}</strong> · {messageDate(selected)}</p>
                  <a href={`mailto:${selected.email}`} className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#2563EB] hover:underline"><Mail className="h-3.5 w-3.5" />{selected.email}</a>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-[13px] leading-6 text-slate-700 whitespace-pre-wrap dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200">{selected.message}</div>

              <div className="mt-4 flex flex-wrap gap-2">
                {selected.status === 'unread' ? (
                  <button type="button" disabled={busy} onClick={() => setStatus(selected, 'read')} className="min-h-11 rounded-xl bg-[#123B66] px-4 text-[11px] font-extrabold text-white hover:bg-[#0f3156] disabled:opacity-60">Mark read</button>
                ) : selected.status !== 'archived' ? (
                  <button type="button" disabled={busy} onClick={() => setStatus(selected, 'unread')} className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-[11px] font-extrabold text-slate-700 hover:border-blue-200 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200">Mark unread</button>
                ) : null}

                {selected.status === 'archived' ? (
                  <button type="button" disabled={busy} onClick={() => setStatus(selected, 'read')} className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-[11px] font-extrabold text-slate-700 hover:border-blue-200 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200">Restore to active</button>
                ) : (
                  <button type="button" disabled={busy} onClick={() => setStatus(selected, 'archived')} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[11px] font-extrabold text-slate-700 hover:border-amber-300 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-200"><Archive className="h-4 w-4" /> Archive</button>
                )}
              </div>
            </article>
          ) : (
            <div className="text-center">
              <Inbox className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-[12px] font-bold text-slate-500 dark:text-slate-400">Select an inquiry to review it.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
