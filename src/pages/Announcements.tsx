import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../App';
import { useSearchParams } from 'react-router-dom';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Announcement, ConnectedCommunicationApp, NotificationPreferences } from '../types';
import {
  Bell,
  Check,
  Clock3,
  Edit3,
  Globe2,
  Megaphone,
  Plus,
  Save,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { buildCommunicationRoutingPlan } from '../lib/communicationRouting';
import { buildNotificationRecord } from '../lib/notificationRecord';
import { CommunicationAudience, isProfileEligibleForAudience } from '../lib/communicationAudience';

type Audience = CommunicationAudience;
type ExtendedAnnouncement = Announcement & {
  audience?: Audience;
  summary?: string;
  channels?: string[];
  expireAt?: unknown;
  publishAt?: unknown;
  websiteSlug?: string;
  websiteSyncStatus?: 'not_requested' | 'pending' | 'synced' | 'failed';
};

type FormState = {
  title: string;
  summary: string;
  content: string;
  audience: Audience;
  push: boolean;
};

const emptyForm: FormState = {
  title: '',
  summary: '',
  content: '',
  audience: 'kcfc_members',
  push: true,
};

const formatDate = (value: unknown) => {
  if (!value) return 'Just now';
  try {
    const candidate = value as { toDate?: () => Date; seconds?: number };
    const date = typeof candidate.toDate === 'function'
      ? candidate.toDate()
      : typeof candidate.seconds === 'number'
        ? new Date(candidate.seconds * 1000)
        : new Date(value as string | number | Date);
    if (Number.isNaN(date.getTime())) return 'Recently';
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
  } catch {
    return 'Recently';
  }
};

const audienceLabel = (audience?: Audience) => {
  if (audience === 'public') return 'Public';
  if (audience === 'parishioners') return 'Registered Parishioners';
  if (audience === 'leadership') return 'Leadership';
  return 'KCFC Members';
};

const audienceIcon = (audience?: Audience) => {
  if (audience === 'public') return Globe2;
  if (audience === 'leadership') return ShieldCheck;
  return UsersRound;
};

const connectedProvidersFor = (apps?: ConnectedCommunicationApp[]) =>
  (apps || [])
    .filter((app) => app.status === 'connected')
    .map((app) => app.provider);

export default function Announcements() {
  const { profile, user } = useAuth();
  const [searchParams] = useSearchParams();
  const focusedAnnouncementId = searchParams.get('id');
  const [announcements, setAnnouncements] = useState<ExtendedAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [queryText, setQueryText] = useState('');
  const [scope, setScope] = useState<'published' | 'all'>('published');
  const [form, setForm] = useState<FormState>(emptyForm);

  const canCreate = (profile?.roles || []).some((role) =>
    ['admin', 'president', 'vice_president', 'spiritual_director', 'secretary', 'pro'].includes(role),
  );
  const canEditOthers = (profile?.roles || []).some((role) => ['admin', 'president'].includes(role));

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setAnnouncements(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as ExtendedAnnouncement)));
      setLoading(false);
    }, (error) => {
      console.error('Announcements: failed to load updates', error);
      setLoading(false);
    });
  }, []);

  const visibleAnnouncements = useMemo(() => {
    const needle = queryText.trim().toLowerCase();
    return announcements.filter((announcement) => {
      const draftVisible = announcement.authorId === user?.uid || canEditOthers;
      if (announcement.status === 'draft' && !draftVisible) return false;
      if (scope === 'published' && announcement.status !== 'published') return false;
      if (!needle) return true;
      return [announcement.title, announcement.summary || '', announcement.content, announcement.authorName]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [announcements, user?.uid, canEditOthers, scope, queryText]);

  useEffect(() => {
    if (!focusedAnnouncementId || loading) return;
    if (!visibleAnnouncements.some((announcement) => announcement.id === focusedAnnouncementId)) return;

    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(`announcement-${focusedAnnouncementId}`);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [focusedAnnouncementId, loading, visibleAnnouncements]);

  const resetEditor = () => {
    setEditingId(null);
    setForm(emptyForm);
    setEditorOpen(false);
  };

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setEditorOpen(true);
  };

  const openEdit = (announcement: ExtendedAnnouncement) => {
    setEditingId(announcement.id || null);
    setForm({
      title: announcement.title,
      summary: announcement.summary || '',
      content: announcement.content,
      audience: announcement.audience || 'kcfc_members',
      push: (announcement.channels || []).includes('push') || !announcement.channels,
    });
    setEditorOpen(true);
  };

  const publishNotifications = async (announcementId: string, title: string, audience: Audience, push: boolean) => {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const batch = writeBatch(db);
    const recipientTokens = new Set<string>();

    usersSnapshot.docs.forEach((userDoc) => {
      const userData = userDoc.data() as {
        isDisabled?: boolean;
        isVerified?: boolean;
        roles?: any[];
        preferences?: NotificationPreferences;
        connectedCommunicationApps?: ConnectedCommunicationApp[];
        fcmTokens?: unknown[];
      };

      if (!isProfileEligibleForAudience(userData, audience)) return;

      const routing = buildCommunicationRoutingPlan({
        kind: 'announcement',
        preferences: userData.preferences,
        connectedProviders: connectedProvidersFor(userData.connectedCommunicationApps),
        allowPwa: push,
        allowEmail: true,
        allowExternalConnectors: false,
      });

      const notificationRef = doc(collection(db, 'notifications'));
      batch.set(notificationRef, {
        ...buildNotificationRecord({
          userId: userDoc.id,
          title: 'KCFC Update',
          message: title,
          type: 'announcement',
          link: `/announcements?id=${announcementId}`,
          sourceId: announcementId,
          sourceType: 'announcement',
          urgency: routing.urgency,
          channels: routing.channels,
          extra: {
            audience,
            routingRationale: routing.rationale,
          },
        }),
        createdAt: serverTimestamp(),
      });

      if (push && routing.channels.includes('pwa') && Array.isArray(userData.fcmTokens)) {
        userData.fcmTokens.forEach((token) => {
          if (typeof token === 'string' && token.trim()) recipientTokens.add(token.trim());
        });
      }
    });

    await batch.commit();

    if (push && recipientTokens.size > 0 && user) {
      try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/admin/broadcast-announcement-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({
            title: `KCFC Update: ${title}`,
            body: form.summary || form.content,
            recipientTokens: Array.from(recipientTokens),
          }),
        });
        if (!response.ok) console.warn('Announcements: push broadcast returned non-success status');
      } catch (error) {
        console.error('Announcements: push broadcast failed; Inbox records were still created', error);
      }
    }
  };

  const handleSave = async (status: 'draft' | 'published') => {
    if (!user || !profile || saving) return;
    if (!form.title.trim() || !form.content.trim()) return;

    setSaving(true);
    try {
      const channels = ['portal', ...(form.push ? ['push'] : [])];
      const data = {
        title: form.title.trim(),
        summary: form.summary.trim(),
        content: form.content.trim(),
        audience: form.audience,
        channels,
        status,
        updatedAt: serverTimestamp(),
        authorId: user.uid,
        authorName: profile.displayName,
        websiteSyncStatus: 'not_requested',
        ...(status === 'published' ? { publishedAt: serverTimestamp() } : {}),
      };

      let announcementId = editingId;
      const previouslyPublished = editingId ? announcements.find((item) => item.id === editingId)?.status === 'published' : false;
      if (editingId) {
        await updateDoc(doc(db, 'announcements', editingId), data);
      } else {
        const created = await addDoc(collection(db, 'announcements'), { ...data, createdAt: serverTimestamp() });
        announcementId = created.id;
      }

      if (status === 'published' && announcementId && !previouslyPublished) {
        await publishNotifications(announcementId, form.title.trim(), form.audience, form.push);
      }
      resetEditor();
    } catch (error) {
      console.error('Announcements: failed to save', error);
      alert('This update could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (announcement: ExtendedAnnouncement) => {
    if (!announcement.id) return;
    if (!window.confirm(`Delete “${announcement.title}”? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, 'announcements', announcement.id));
    } catch (error) {
      console.error('Announcements: failed to delete', error);
      alert('This update could not be deleted.');
    }
  };

  return (
    <div className="kcfc-page space-y-5 pb-4">
      <section className="overflow-hidden rounded-[26px] border border-blue-100 bg-gradient-to-br from-[#123B66] via-[#174E83] to-[#2563EB] p-5 text-white shadow-[0_18px_45px_rgba(18,59,102,0.18)] sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl"><div className="mb-2 flex items-center gap-2 text-blue-100"><Megaphone className="h-4 w-4" /><span className="text-[11px] font-extrabold uppercase tracking-[0.13em]">Updates</span></div><h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[34px]">Everything important, easy to find.</h1><p className="mt-2 max-w-xl text-[14px] leading-6 text-blue-50/90">KCFC announcements stay in the Portal even if a push alert is missed. Published updates are the durable record members can return to anytime.</p></div>
          {canCreate && <button type="button" onClick={openNew} className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-[12px] font-bold text-[#123B66] shadow-sm"><Plus className="h-4 w-4" />New update</button>}
        </div>
      </section>

      <section className="kcfc-surface overflow-hidden">
        <div className="border-b border-slate-100 p-4 sm:p-5 dark:border-white/10">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div><h2 className="text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white">Community updates</h2><p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">Browse published notices, schedules, reminders and community news.</p></div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center"><div className="relative"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Search updates…" className="min-h-11 min-w-[230px] rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-[12px] text-[#172033] outline-none focus:border-blue-400 dark:border-white/10 dark:bg-white/5 dark:text-white" /></div>{canCreate && <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-white/5"><ScopeButton active={scope === 'published'} onClick={() => setScope('published')} label="Published" /><ScopeButton active={scope === 'all'} onClick={() => setScope('all')} label="All + drafts" /></div>}</div>
          </div>
        </div>

        {loading ? <div className="space-y-3 p-4 sm:p-5">{[0, 1, 2].map((item) => <div key={item} className="h-32 animate-pulse rounded-2xl bg-slate-100 dark:bg-white/5" />)}</div> : visibleAnnouncements.length === 0 ? <EmptyState queryText={queryText} canCreate={canCreate} onCreate={openNew} /> : <div className="divide-y divide-slate-100 dark:divide-white/10">{visibleAnnouncements.map((announcement) => <AnnouncementCard key={announcement.id} announcement={announcement} focused={focusedAnnouncementId === announcement.id} canEdit={announcement.authorId === user?.uid || canEditOthers} onEdit={() => openEdit(announcement)} onDelete={() => handleDelete(announcement)} />)}</div>}
      </section>

      {editorOpen && <EditorSheet form={form} setForm={setForm} editing={Boolean(editingId)} saving={saving} onClose={resetEditor} onSave={handleSave} />}
    </div>
  );
}

function AnnouncementCard({ announcement, focused, canEdit, onEdit, onDelete }: { announcement: ExtendedAnnouncement; focused: boolean; canEdit: boolean; onEdit: () => void; onDelete: () => void }) {
  const AudienceIcon = audienceIcon(announcement.audience);
  const isDraft = announcement.status === 'draft';
  return (
    <article id={announcement.id ? `announcement-${announcement.id}` : undefined} tabIndex={focused ? -1 : undefined} aria-current={focused ? 'true' : undefined} className={cn('p-4 transition-colors sm:p-5', focused && 'bg-blue-50/60 ring-2 ring-inset ring-blue-400 dark:bg-blue-500/10 dark:ring-blue-400/70')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide', isDraft ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300')}>{isDraft ? <Clock3 className="h-3 w-3" /> : <Check className="h-3 w-3" />}{isDraft ? 'Draft' : 'Published'}</span><span className="inline-flex items-center gap-1 rounded-full bg-[#F7F9FC] px-2.5 py-1 text-[10px] font-bold text-slate-500 dark:bg-white/5 dark:text-slate-300"><AudienceIcon className="h-3 w-3" />{audienceLabel(announcement.audience)}</span></div><h3 className="mt-3 text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white sm:text-[20px]">{announcement.title}</h3>{announcement.summary && <p className="mt-2 text-[13px] font-semibold leading-5 text-slate-600 dark:text-slate-300">{announcement.summary}</p>}<p className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-slate-500 dark:text-slate-400">{announcement.content}</p><div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-medium text-slate-400"><span>{announcement.authorName}</span><span>•</span><span>{formatDate(announcement.publishedAt || announcement.updatedAt || announcement.createdAt)}</span>{(announcement.channels || []).includes('push') && <><span>•</span><span className="inline-flex items-center gap-1"><Bell className="h-3 w-3" />Push enabled</span></>}</div></div>
        {canEdit && <div className="flex shrink-0 items-center gap-1"><button type="button" onClick={onEdit} aria-label="Edit announcement" className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-[#EAF3FF] hover:text-[#123B66] dark:text-slate-400 dark:hover:bg-blue-500/10"><Edit3 className="h-4 w-4" /></button><button type="button" onClick={onDelete} aria-label="Delete announcement" className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button></div>}
      </div>
    </article>
  );
}

function EditorSheet({ form, setForm, editing, saving, onClose, onSave }: { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>>; editing: boolean; saving: boolean; onClose: () => void; onSave: (status: 'draft' | 'published') => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/40 backdrop-blur-[2px] sm:items-center sm:p-4">
      <section role="dialog" aria-modal="true" aria-label={editing ? 'Edit KCFC update' : 'Create KCFC update'} className="max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] bg-white shadow-2xl sm:max-w-2xl sm:rounded-[28px] dark:bg-[#10243a]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-4 py-4 backdrop-blur sm:px-5 dark:border-white/10 dark:bg-[#10243a]/95"><div><p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#2563EB]">Updates</p><h2 className="mt-1 text-[20px] font-extrabold text-[#172033] dark:text-white">{editing ? 'Edit update' : 'Create update'}</h2></div><button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-300" aria-label="Close update editor"><X className="h-5 w-5" /></button></div>
        <div className="space-y-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
          <label className="block"><span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Title</span><input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Clear, useful headline" className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[13px] text-[#172033] outline-none focus:border-blue-400 dark:border-white/10 dark:bg-white/5 dark:text-white" /></label>
          <label className="block"><span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Short summary</span><input value={form.summary} onChange={(event) => setForm((current) => ({ ...current, summary: event.target.value }))} placeholder="One-line summary shown before the full message" className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-[13px] text-[#172033] outline-none focus:border-blue-400 dark:border-white/10 dark:bg-white/5 dark:text-white" /></label>
          <label className="block"><span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Message</span><textarea rows={7} value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} placeholder="Write the complete update…" className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[13px] leading-6 text-[#172033] outline-none focus:border-blue-400 dark:border-white/10 dark:bg-white/5 dark:text-white" /></label>

          <div><span className="mb-2 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Audience</span><div className="grid grid-cols-2 gap-2">{(['kcfc_members', 'leadership', 'parishioners', 'public'] as Audience[]).map((audience) => { const Icon = audienceIcon(audience); const active = form.audience === audience; return <button key={audience} type="button" onClick={() => setForm((current) => ({ ...current, audience }))} className={cn('flex min-h-12 items-center gap-2 rounded-xl border px-3 text-left text-[11px] font-bold', active ? 'border-blue-300 bg-[#EAF3FF] text-[#123B66] dark:border-blue-400/30 dark:bg-blue-500/15 dark:text-blue-200' : 'border-slate-200 text-slate-500 dark:border-white/10 dark:text-slate-300')}><Icon className="h-4 w-4" />{audienceLabel(audience)}</button>; })}</div><p className="mt-2 text-[10px] leading-4 text-slate-400">Public website publishing will be enabled later as a separate channel. Selecting Public here does not publish to the website yet.</p></div>

          <div className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10"><button type="button" role="switch" aria-checked={form.push} aria-label="PWA Web Push alert" onClick={() => setForm((current) => ({ ...current, push: !current.push }))} className={cn('flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500', form.push ? 'bg-[#2563EB]' : 'bg-slate-300 dark:bg-slate-600')}><span className={cn('h-5 w-5 rounded-full bg-white shadow-sm transition-transform', form.push && 'translate-x-4')} /></button><div><p className="text-[12px] font-bold text-[#172033] dark:text-white">PWA / Web Push alert</p><p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">The Portal notification record is still created even if push delivery is disabled or fails.</p></div></div>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end dark:border-white/10"><button type="button" onClick={() => onSave('draft')} disabled={saving || !form.title.trim() || !form.content.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-[11px] font-bold text-slate-600 disabled:opacity-45 dark:border-white/10 dark:text-slate-300"><Save className="h-4 w-4" />Save draft</button><button type="button" onClick={() => onSave('published')} disabled={saving || !form.title.trim() || !form.content.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#123B66] px-4 text-[11px] font-bold text-white disabled:opacity-45">{saving ? <Clock3 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{saving ? 'Saving…' : editing ? 'Save & publish' : 'Publish update'}</button></div>
        </div>
      </section>
    </div>
  );
}

function ScopeButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) { return <button type="button" onClick={onClick} className={cn('min-h-9 rounded-lg px-3 text-[10px] font-bold', active ? 'bg-white text-[#123B66] shadow-sm dark:bg-[#123B66] dark:text-white' : 'text-slate-500 dark:text-slate-400')}>{label}</button>; }
function EmptyState({ queryText, canCreate, onCreate }: { queryText: string; canCreate: boolean; onCreate: () => void }) { return <div className="px-5 py-14 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200"><Megaphone className="h-6 w-6" /></div><h3 className="mt-4 text-[16px] font-extrabold text-[#172033] dark:text-white">{queryText ? 'No updates match your search' : 'No updates yet'}</h3><p className="mx-auto mt-2 max-w-md text-[13px] leading-5 text-slate-500 dark:text-slate-400">{queryText ? 'Try a shorter search or clear the search box.' : 'Published KCFC announcements will appear here.'}</p>{canCreate && !queryText && <button type="button" onClick={onCreate} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#123B66] px-4 text-[11px] font-bold text-white"><Plus className="h-4 w-4" />Create first update</button>}</div>; }
