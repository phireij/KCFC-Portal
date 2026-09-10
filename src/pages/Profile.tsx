import React, { useState } from 'react';
import { useAuth } from '../App';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  AtSign,
  BellRing,
  Calendar,
  Camera,
  Home,
  Mail,
  Palette,
  Phone,
  Save,
  ShieldCheck,
  User,
} from 'lucide-react';
import { cn } from '../lib/utils';
import InstallPWA from '../components/InstallPWA';
import NotificationHealth from '../components/NotificationHealth';

export default function Profile() {
  const { profile, user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    displayName: '',
    nickname: '',
    phoneNumber: '',
    homeAddress: '',
    birthdate: '',
    preferences: {
      announcements: true,
      duties: true,
      broadcasts: true,
      availability: true,
      assignments: true,
      urgentNotices: true,
      emailPartner: true,
      darkMode: false,
      fontSize: 'normal' as 'small' | 'normal' | 'medium' | 'big',
    },
  });

  React.useEffect(() => {
    if (!profile) return;
    setFormData({
      displayName: profile.displayName || '',
      nickname: profile.nickname || '',
      phoneNumber: profile.phoneNumber || '',
      homeAddress: profile.homeAddress || '',
      birthdate: profile.birthdate || '',
      preferences: {
        announcements: profile.preferences?.announcements ?? true,
        duties: profile.preferences?.duties ?? true,
        broadcasts: profile.preferences?.broadcasts ?? true,
        availability: profile.preferences?.availability ?? true,
        assignments: profile.preferences?.assignments ?? true,
        urgentNotices: profile.preferences?.urgentNotices ?? true,
        emailPartner: profile.preferences?.emailPartner ?? true,
        darkMode: profile.preferences?.darkMode ?? false,
        fontSize: profile.preferences?.fontSize ?? 'normal',
      },
    });
  }, [profile]);

  const updatePreference = (key: keyof typeof formData.preferences, value: boolean | string) => {
    setFormData((current) => ({
      ...current,
      preferences: { ...current.preferences, [key]: value },
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        ...formData,
        updatedAt: serverTimestamp(),
      });
      setMessage({ type: 'success', text: 'Your profile and communication preferences were saved.' });
    } catch (error) {
      console.error(error);
      setMessage({ type: 'error', text: 'We could not save your changes. Please try again.' });
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 500 * 1024) {
      alert('Please choose an image smaller than 500 KB.');
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          photoURL: reader.result as string,
          updatedAt: serverTimestamp(),
        });
        setMessage({ type: 'success', text: 'Profile photo updated.' });
      } catch (error) {
        console.error(error);
        setMessage({ type: 'error', text: 'We could not update your photo.' });
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const roleLabel = (profile?.roles || []).map((role) => role.replaceAll('_', ' ')).join(' • ') || 'KCFC member';

  return (
    <div className="kcfc-page space-y-5 pb-4">
      <section className="overflow-hidden rounded-[26px] border border-blue-100 bg-gradient-to-br from-[#123B66] via-[#174E83] to-[#2563EB] p-5 text-white shadow-[0_18px_45px_rgba(18,59,102,0.18)] sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-[26px] border-2 border-white/30 bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Change profile photo"
          >
            <img
              src={profile?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.displayName || 'KCFC')}&background=123B66&color=fff`}
              alt=""
              className={cn('h-full w-full object-cover', uploading && 'opacity-50')}
            />
            <span className="absolute inset-0 flex items-center justify-center bg-slate-950/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <Camera className="h-6 w-6" />
            </span>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-blue-100">My KCFC Profile</p>
            <h1 className="mt-1 truncate text-[28px] font-extrabold tracking-[-0.03em] sm:text-[34px]">{profile?.displayName || 'KCFC Member'}</h1>
            <p className="mt-1 truncate text-[13px] text-blue-50/85">{profile?.email}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold capitalize text-white">{roleLabel}</span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-bold text-white">{profile?.isVerified ? (profile?.isCoreMember ? 'Core Member' : 'Verified Member') : 'Pending Verification'}</span>
            </div>
          </div>
        </div>
      </section>

      <NotificationHealth />

      <form onSubmit={handleSubmit} className="space-y-5">
        {message && (
          <div className={cn('rounded-2xl border px-4 py-3 text-[13px] font-semibold', message.type === 'success' ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-400/20 dark:bg-green-500/10 dark:text-green-300' : 'border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300')}>
            {message.text}
          </div>
        )}

        <section className="kcfc-surface overflow-hidden">
          <SectionHeader icon={User} title="Personal information" body="Your private profile details are not shown in the general member directory unless the Portal explicitly provides a future sharing control." />
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <Field label="Full name" icon={User}><input required value={formData.displayName} onChange={(event) => setFormData({ ...formData, displayName: event.target.value })} className="kcfc-input" /></Field>
            <Field label="Nickname" icon={AtSign}><input value={formData.nickname} onChange={(event) => setFormData({ ...formData, nickname: event.target.value })} className="kcfc-input" /></Field>
            <Field label="Phone number" icon={Phone}><input type="tel" value={formData.phoneNumber} onChange={(event) => setFormData({ ...formData, phoneNumber: event.target.value })} className="kcfc-input" /></Field>
            <Field label="Birthdate" icon={Calendar}><input type="date" value={formData.birthdate} onChange={(event) => setFormData({ ...formData, birthdate: event.target.value })} className="kcfc-input" /></Field>
            <Field label="Home address" icon={Home} wide><textarea rows={2} value={formData.homeAddress} onChange={(event) => setFormData({ ...formData, homeAddress: event.target.value })} className="kcfc-input resize-none py-3" /></Field>
          </div>
        </section>

        <section className="kcfc-surface overflow-hidden">
          <SectionHeader icon={BellRing} title="What should KCFC alert me about?" body="Inbox keeps the record. These preferences control which routine alerts should also reach your notification channels." />
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 sm:p-5">
            <PreferenceCard label="Announcements" detail="Community news and published notices" checked={formData.preferences.announcements} onChange={(value) => updatePreference('announcements', value)} />
            <PreferenceCard label="Availability requests" detail="When leaders ask when you can serve" checked={formData.preferences.availability} onChange={(value) => updatePreference('availability', value)} />
            <PreferenceCard label="Assignments" detail="Published ministry assignments and changes" checked={formData.preferences.assignments} onChange={(value) => updatePreference('assignments', value)} />
            <PreferenceCard label="Community duties" detail="Kitchen, cleaning and other service duties" checked={formData.preferences.duties} onChange={(value) => updatePreference('duties', value)} />
            <PreferenceCard label="Broadcasts" detail="Messages sent to groups you belong to" checked={formData.preferences.broadcasts} onChange={(value) => updatePreference('broadcasts', value)} />
            <PreferenceCard label="Urgent notices" detail="Important operational or schedule changes" checked={formData.preferences.urgentNotices} onChange={(value) => updatePreference('urgentNotices', value)} locked />
          </div>

          <div className="border-t border-slate-100 p-4 sm:p-5 dark:border-white/10">
            <div className="flex flex-col gap-3 rounded-2xl bg-[#F7F9FC] p-4 sm:flex-row sm:items-center sm:justify-between dark:bg-white/5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#123B66] shadow-sm dark:bg-white/10 dark:text-blue-200"><Mail className="h-5 w-5" /></div>
                <div>
                  <p className="text-[13px] font-extrabold text-[#172033] dark:text-white">Email partner channel</p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">Keep email paired with important KCFC alerts. PWA remains the primary alert channel.</p>
                </div>
              </div>
              <Toggle checked={formData.preferences.emailPartner} onChange={(value) => updatePreference('emailPartner', value)} label="Email partner" />
            </div>
          </div>
        </section>

        <section className="kcfc-surface overflow-hidden">
          <SectionHeader icon={Palette} title="Appearance" body="Choose a comfortable reading experience across phone, tablet and desktop." />
          <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[.75fr_1.25fr]">
            <div className="rounded-2xl bg-[#F7F9FC] p-4 dark:bg-white/5">
              <div className="flex items-center justify-between gap-4">
                <div><p className="text-[13px] font-bold text-[#172033] dark:text-white">Dark mode</p><p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Use a darker Portal canvas.</p></div>
                <Toggle checked={formData.preferences.darkMode} onChange={(value) => updatePreference('darkMode', value)} label="Dark mode" />
              </div>
            </div>
            <div className="rounded-2xl bg-[#F7F9FC] p-4 dark:bg-white/5">
              <p className="text-[13px] font-bold text-[#172033] dark:text-white">Reading size</p>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {(['small', 'normal', 'medium', 'big'] as const).map((size) => (
                  <button key={size} type="button" onClick={() => updatePreference('fontSize', size)} className={cn('min-h-11 rounded-xl px-2 text-[11px] font-bold capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500', formData.preferences.fontSize === size ? 'bg-[#123B66] text-white' : 'bg-white text-slate-500 dark:bg-white/5 dark:text-slate-300')}>{size}</button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="sticky bottom-[82px] z-20 flex justify-end xl:bottom-4">
          <button type="submit" disabled={saving} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#123B66] px-5 text-[13px] font-bold text-white shadow-lg shadow-blue-950/15 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </form>

      <InstallPWA />
    </div>
  );
}

function SectionHeader({ icon: Icon, title, body }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  return <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-4 sm:px-5 dark:border-white/10"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200"><Icon className="h-5 w-5" /></div><div><h2 className="text-[17px] font-extrabold tracking-tight text-[#172033] dark:text-white">{title}</h2><p className="mt-1 max-w-2xl text-[12px] leading-5 text-slate-500 dark:text-slate-400">{body}</p></div></div>;
}

function Field({ label, icon: Icon, wide = false, children }: { label: string; icon: React.ComponentType<{ className?: string }>; wide?: boolean; children: React.ReactNode }) {
  return <label className={cn('space-y-1.5', wide && 'sm:col-span-2')}><span className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.07em] text-slate-400"><Icon className="h-3.5 w-3.5" />{label}</span>{children}</label>;
}

function PreferenceCard({ label, detail, checked, onChange, locked = false }: { label: string; detail: string; checked: boolean; onChange: (value: boolean) => void; locked?: boolean }) {
  return <div className="flex min-h-[92px] items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]"><div className="min-w-0 flex-1"><p className="text-[13px] font-bold text-[#172033] dark:text-white">{label}</p><p className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">{detail}</p>{locked && <p className="mt-1 text-[9px] font-bold text-amber-600 dark:text-amber-300">Recommended on</p>}</div><Toggle checked={checked} onChange={onChange} label={label} /></div>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={cn('relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500', checked ? 'bg-[#2563EB]' : 'bg-slate-300 dark:bg-slate-600')}><span className={cn('absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform', checked ? 'translate-x-6' : 'translate-x-1')} /></button>;
}
