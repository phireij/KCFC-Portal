import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../App';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Resource } from '../types';
import { cn } from '../lib/utils';
import {
  BookOpen,
  ExternalLink,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Music2,
  Plus,
  Search,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react';

type ResourceForm = {
  title: string;
  description: string;
  ministry: string;
  fileUrl: string;
  fileType: string;
};

const initialForm: ResourceForm = {
  title: '',
  description: '',
  ministry: 'General',
  fileUrl: '',
  fileType: 'link',
};

const categories = [
  'All',
  'General',
  'Choir',
  'Lector & Commentator',
  'Usher',
  'Altar Server',
  'Kitchen',
  'Cleaning',
  'Other',
];

const managerRoles = [
  'admin',
  'president',
  'vice_president',
  'secretary',
  'auditor',
  'choir_a_leader',
  'choir_b_leader',
  'lector_commentator_leader',
  'usher_leader',
  'altar_server_leader',
  'kitchen_leader',
  'kitchen_sub_leader',
  'cleaning_leader',
  'cleaning_sub_leader',
];

const formatDate = (value: unknown) => {
  if (!value) return 'Recently added';
  try {
    const candidate = value as { toDate?: () => Date; seconds?: number };
    const date = typeof candidate.toDate === 'function'
      ? candidate.toDate()
      : typeof candidate.seconds === 'number'
        ? new Date(candidate.seconds * 1000)
        : new Date(value as string | number | Date);
    if (Number.isNaN(date.getTime())) return 'Recently added';
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
  } catch {
    return 'Recently added';
  }
};

const resourceIcon = (resource: Resource) => {
  const type = (resource.fileType || '').toLowerCase();
  if (type.includes('image')) return ImageIcon;
  if (type.includes('music') || type.includes('audio')) return Music2;
  return FileText;
};

export default function Resources() {
  const { profile, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const categoryParam = searchParams.get('category');
  const category = categories.includes(categoryParam || '') ? categoryParam! : 'All';
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ResourceForm>(initialForm);

  const canManage = (profile?.roles || []).some((role) => managerRoles.includes(role));

  useEffect(() => {
    const q = query(collection(db, 'resources'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setResources(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Resource)));
      setLoading(false);
    }, (error) => {
      console.error('Resources: failed to load library', error);
      setLoading(false);
    });
  }, []);

  const filteredResources = useMemo(() => {
    const needle = searchText.trim().toLowerCase();
    return resources.filter((resource) => {
      const matchesCategory = category === 'All' || resource.ministry?.toLowerCase() === category.toLowerCase();
      if (!matchesCategory) return false;
      if (!needle) return true;
      return [resource.title, resource.description || '', resource.ministry, resource.fileType]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [resources, searchText, category]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !profile || saving) return;
    if (!form.title.trim() || !form.fileUrl.trim()) return;

    setSaving(true);
    try {
      await addDoc(collection(db, 'resources'), {
        title: form.title.trim(),
        description: form.description.trim(),
        ministry: form.ministry,
        fileUrl: form.fileUrl.trim(),
        fileType: form.fileType,
        uploadedBy: user.uid,
        uploaderName: profile.displayName,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setForm(initialForm);
      setShowAddForm(false);
    } catch (error) {
      console.error('Resources: failed to create item', error);
      alert('This resource could not be added. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (resource: Resource) => {
    if (!resource.id) return;
    if (!window.confirm(`Delete “${resource.title}” from the KCFC library?`)) return;
    try {
      await deleteDoc(doc(db, 'resources', resource.id));
    } catch (error) {
      console.error('Resources: failed to delete item', error);
      alert('This resource could not be deleted.');
    }
  };

  const setResourceCategory = (nextCategory: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (nextCategory === 'All') next.delete('category');
      else next.set('category', nextCategory);
      return next;
    });
  };

  const resetFilters = () => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('category');
      return next;
    });
    setSearchText('');
  };

  return (
    <div className="kcfc-page space-y-5 pb-4">
      <section className="overflow-hidden rounded-[26px] border border-blue-100 bg-gradient-to-br from-[#123B66] via-[#174E83] to-[#2563EB] p-5 text-white shadow-[0_18px_45px_rgba(18,59,102,0.18)] sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-2 flex items-center gap-2 text-blue-100">
              <BookOpen className="h-4 w-4" />
              <span className="text-[11px] font-extrabold uppercase tracking-[0.13em]">KCFC Resource Library</span>
            </div>
            <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[34px]">Find what your ministry needs.</h1>
            <p className="mt-2 max-w-xl text-[14px] leading-6 text-blue-50/90">
              Browse liturgical guides, music sheets, ministry references and community documents from one mobile-friendly library.
            </p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-[13px] font-bold text-[#123B66] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Plus className="h-4 w-4" /> Add resource
            </button>
          )}
        </div>
      </section>

      <section className="kcfc-surface overflow-hidden">
        <div className="border-b border-slate-100 p-4 sm:p-5 dark:border-white/10">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-[18px] font-extrabold tracking-tight text-[#172033] dark:text-white">Browse library</h2>
              <p className="mt-1 text-[12px] leading-5 text-slate-500 dark:text-slate-400">Search by title, description, ministry or file type.</p>
            </div>
            <div className="relative w-full lg:max-w-sm">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search resources..."
                className="kcfc-input min-h-11 w-full pl-10"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setResourceCategory(item)}
                className={cn(
                  'min-h-10 shrink-0 rounded-xl px-3.5 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                  category === item
                    ? 'bg-[#123B66] text-white'
                    : 'border border-slate-200 bg-white text-slate-500 hover:text-[#123B66] dark:border-white/10 dark:bg-white/5 dark:text-slate-300',
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="h-44 animate-pulse rounded-[22px] bg-slate-100 dark:bg-white/5" />)}
          </div>
        ) : filteredResources.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200"><FolderOpen className="h-6 w-6" /></div>
            <h3 className="mt-4 text-[16px] font-extrabold text-[#172033] dark:text-white">No matching resources</h3>
            <p className="mx-auto mt-2 max-w-md text-[13px] leading-5 text-slate-500 dark:text-slate-400">Try another ministry or clear the current search.</p>
            {(category !== 'All' || searchText) && (
              <button type="button" onClick={resetFilters} className="mt-4 min-h-10 rounded-xl bg-[#123B66] px-4 text-[12px] font-bold text-white">Clear filters</button>
            )}
          </div>
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
            {filteredResources.map((resource) => {
              const Icon = resourceIcon(resource);
              return (
                <article key={resource.id} className="flex min-h-[190px] flex-col rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200"><Icon className="h-5 w-5" /></div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wide text-slate-500 dark:bg-white/5 dark:text-slate-300">{resource.ministry || 'General'}</span>
                  </div>

                  <h3 className="mt-4 line-clamp-2 text-[16px] font-extrabold leading-5 text-[#172033] dark:text-white">{resource.title}</h3>
                  <p className="mt-1.5 line-clamp-3 text-[12px] leading-5 text-slate-500 dark:text-slate-400">{resource.description || 'KCFC ministry resource.'}</p>

                  <div className="mt-auto flex items-end justify-between gap-3 border-t border-slate-100 pt-3 dark:border-white/10">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-slate-400">{formatDate(resource.createdAt)}</p>
                      <p className="mt-0.5 truncate text-[9px] uppercase tracking-wide text-slate-400">{resource.fileType || 'resource'}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => handleDelete(resource)}
                          className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 dark:hover:bg-red-500/10"
                          aria-label={`Delete ${resource.title}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                      <a
                        href={resource.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#123B66] px-3 text-[11px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        Open <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {showAddForm && canManage && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setShowAddForm(false); }}>
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-[26px] bg-white shadow-2xl sm:max-w-2xl sm:rounded-[26px] dark:bg-[#172033]">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-4 sm:px-5 dark:border-white/10 dark:bg-[#172033]">
              <div>
                <h2 className="text-[18px] font-extrabold text-[#172033] dark:text-white">Add resource</h2>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Add a trusted link or document reference to the KCFC library.</p>
              </div>
              <button type="button" onClick={() => setShowAddForm(false)} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleCreate} className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-slate-400">Title</span>
                <input required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="kcfc-input" placeholder="Resource title" />
              </label>

              <label className="space-y-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-slate-400">Ministry</span>
                <select value={form.ministry} onChange={(event) => setForm((current) => ({ ...current, ministry: event.target.value }))} className="kcfc-input">
                  {categories.filter((item) => item !== 'All').map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-slate-400">Type</span>
                <select value={form.fileType} onChange={(event) => setForm((current) => ({ ...current, fileType: event.target.value }))} className="kcfc-input">
                  <option value="link">Web / Drive link</option>
                  <option value="pdf">PDF</option>
                  <option value="image">Image</option>
                  <option value="music">Music / audio</option>
                  <option value="document">Document</option>
                </select>
              </label>

              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-slate-400">Resource URL</span>
                <input required type="url" value={form.fileUrl} onChange={(event) => setForm((current) => ({ ...current, fileUrl: event.target.value }))} className="kcfc-input" placeholder="https://..." />
              </label>

              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-slate-400">Description</span>
                <textarea rows={4} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="kcfc-input resize-none py-3" placeholder="What is this resource for?" />
              </label>

              <div className="sm:col-span-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setShowAddForm(false)} className="min-h-11 rounded-xl border border-slate-200 px-4 text-[12px] font-bold text-slate-500 dark:border-white/10 dark:text-slate-300">Cancel</button>
                <button type="submit" disabled={saving || !form.title.trim() || !form.fileUrl.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#123B66] px-4 text-[12px] font-bold text-white disabled:opacity-45">
                  <Plus className="h-4 w-4" /> {saving ? 'Adding…' : 'Add to library'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-400/10 dark:bg-blue-500/5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#123B66] shadow-sm dark:bg-white/10 dark:text-blue-200"><UsersRound className="h-5 w-5" /></div>
          <div>
            <p className="text-[13px] font-extrabold text-[#172033] dark:text-white">Shared ministry knowledge</p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">Resources stay inside the authenticated KCFC Portal unless an authorized future publishing workflow deliberately marks an item public.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
