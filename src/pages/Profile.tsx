import React, { useState } from 'react';
import { useAuth } from '../App';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { motion } from 'motion/react';
import { User, Mail, Phone, Home, Calendar, AtSign, Save, ShieldCheck, BellRing, Palette } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Profile() {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
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
      darkMode: false,
      fontSize: 'normal' as 'small' | 'normal' | 'medium' | 'big',
    }
  });

  React.useEffect(() => {
    if (profile) {
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
          darkMode: profile.preferences?.darkMode ?? false,
          fontSize: profile.preferences?.fontSize ?? 'normal',
        }
      });
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!window.confirm('Are you sure you want to save these changes?')) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        ...formData,
        updatedAt: serverTimestamp()
      });
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to update profile.' });
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Check file size (limit to 500KB for base64 storage)
    if (file.size > 500 * 1024) {
      alert("Image is too large. Please choose an image smaller than 500KB.");
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          photoURL: base64String,
          updatedAt: serverTimestamp()
        });
        setMessage({ type: 'success', text: 'Profile picture updated!' });
      } catch (err) {
        console.error(err);
        setMessage({ type: 'error', text: 'Failed to update photo.' });
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header>
        <h1 className="text-4xl font-serif text-[#1a1a1a] dark:text-white">My Profile</h1>
        <p className="text-gray-500 font-serif italic mt-2">Manage your personal information and community presence.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-[#1e1e1a] rounded-[40px] p-8 shadow-sm border border-gray-100 dark:border-white/5 flex flex-col items-center text-center">
            <div className="relative group">
              <div className={cn(
                "w-32 h-32 rounded-full border-4 border-gray-50 shadow-inner overflow-hidden",
                uploading && "animate-pulse"
              )}>
                <img 
                  src={profile?.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName}&background=5A5A40&color=fff`} 
                  alt={profile?.displayName} 
                  className="w-full h-full object-cover"
                />
              </div>
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer disabled:cursor-not-allowed"
              >
                <span className="text-white text-[10px] font-bold uppercase tracking-widest">
                  {uploading ? 'Processing...' : 'Change Photo'}
                </span>
              </button>
              <input 
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
            </div>
            
            <h2 className="mt-6 text-xl font-bold text-gray-900 dark:text-[#f5f5f0]">{profile?.displayName}</h2>
            <p className="text-gray-400 dark:text-gray-500 text-sm">{profile?.email}</p>
            
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {profile?.roles.map(role => (
                <span key={role} className="px-3 py-1 bg-[#5A5A40]/10 text-[#5A5A40] text-[10px] font-bold uppercase tracking-widest rounded-full">
                  {role}
                </span>
              ))}
            </div>

            <div className="mt-8 w-full pt-8 border-t border-gray-50 dark:border-white/10 space-y-4">
              <div className="flex items-center gap-3 text-left">
                <div className="w-8 h-8 bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-500 rounded-lg flex items-center justify-center">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Member Status</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-[#f5f5f0]">
                    {profile?.email === 'kcfc.jp@gmail.com' ? (
                      <span className="text-purple-600 font-bold tracking-tight">SUPER MEMBER</span>
                    ) : (
                      profile?.isVerified ? (profile?.isCoreMember ? 'Core Member' : 'Regular Member') : 'Pending Verification'
                    )}
                  </div>
                </div>
              </div>

              {(profile?.ministries && profile.ministries.length > 0) && (
                <div className="space-y-4 pt-4 border-t border-gray-50 dark:border-white/10">
                  <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] text-left">Committees & Affiliations</h3>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {profile.ministries.map(m => {
                      const mStr = m as string;
                      if ((mStr === 'cleaning' || mStr === 'cleaning_leader') && ((profile.ministries as any)?.includes('cleaning_toilet_ok') || (profile.ministries as any)?.includes('cleaning_toilet_ng'))) {
                        return null;
                      }
                      
                      let label = m.replace(/_/g, ' ');
                      let colorClass = "bg-blue-50 text-blue-600";
                      
                      if (m === 'cleaning_toilet_ok') {
                        label = "Cleaning: Toilet OK";
                        colorClass = "bg-green-100 text-green-700 border border-green-200";
                      } else if (m === 'cleaning_toilet_ng') {
                        label = "Cleaning: Toilet NG";
                        colorClass = "bg-red-100 text-red-700 border border-red-200";
                      }

                      return (
                        <span key={m} className={cn("px-3 py-1 text-[9px] font-bold uppercase tracking-widest rounded-lg", colorClass)}>
                          {label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <div className="lg:col-span-2">
          <motion.form 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit}
            className="bg-white dark:bg-[#1e1e1a] rounded-[40px] p-8 md:p-10 shadow-sm border border-gray-100 dark:border-white/5 space-y-8"
          >
            {message && (
              <div className={cn(
                "p-4 rounded-2xl text-sm font-medium",
                message.type === 'success' ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              )}>
                {message.text}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-4">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    required
                    value={formData.displayName}
                    onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-[#252520] border-none rounded-2xl focus:ring-2 focus:ring-[#5A5A40] transition-all text-gray-900 dark:text-[#f5f5f0] outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-4">Nickname</label>
                <div className="relative">
                  <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    value={formData.nickname}
                    onChange={e => setFormData({ ...formData, nickname: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-[#252520] border-none rounded-2xl focus:ring-2 focus:ring-[#5A5A40] transition-all text-gray-900 dark:text-[#f5f5f0] outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-4">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-[#252520] border-none rounded-2xl focus:ring-2 focus:ring-[#5A5A40] transition-all text-gray-900 dark:text-[#f5f5f0] outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-4">Birthdate</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="date"
                    value={formData.birthdate}
                    onChange={e => setFormData({ ...formData, birthdate: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-[#252520] border-none rounded-2xl focus:ring-2 focus:ring-[#5A5A40] transition-all text-gray-900 dark:text-[#f5f5f0] outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-4">Home Address</label>
                <div className="relative">
                  <Home className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <textarea
                    rows={2}
                    value={formData.homeAddress}
                    onChange={e => setFormData({ ...formData, homeAddress: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-[#252520] border-none rounded-2xl focus:ring-2 focus:ring-[#5A5A40] transition-all text-gray-900 dark:text-[#f5f5f0] outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Notification Preferences */}
            <div className="space-y-6 pt-8 border-t border-gray-50 dark:border-white/10">
              <div className="flex items-center gap-3">
                <BellRing className="text-[#5A5A40]" size={20} />
                <h3 className="text-sm font-bold text-gray-900 dark:text-[#f5f5f0] uppercase tracking-widest">Notification Preferences</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: 'announcements', label: 'Announcements', desc: 'New community posts' },
                  { id: 'duties', label: 'Duties', desc: 'Assignment reminders' },
                  { id: 'broadcasts', label: 'Broadcasts', desc: 'Direct group messages' }
                ].map((pref) => (
                  <label 
                    key={pref.id}
                    className="flex flex-col p-4 bg-gray-50 dark:bg-[#252520] rounded-2xl cursor-pointer hover:bg-gray-100 dark:hover:bg-[#2d2d25] transition-all border border-transparent has-[:checked]:border-[#5A5A40]/30 has-[:checked]:bg-[#5A5A40]/5 dark:has-[:checked]:bg-[#5A5A40]/10"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-gray-900 dark:text-[#f5f5f0]">{pref.label}</span>
                      <input 
                        type="checkbox"
                        checked={(formData.preferences as any)[pref.id]}
                        onChange={(e) => setFormData({
                          ...formData,
                          preferences: {
                            ...formData.preferences,
                            [pref.id]: e.target.checked
                          }
                        })}
                        className="w-4 h-4 rounded border-gray-300 dark:border-white/10 text-[#5A5A40] focus:ring-[#5A5A40]"
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-serif italic">{pref.desc}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Appearance settings */}
            <div className="space-y-6 pt-8 border-t border-gray-50 dark:border-white/10">
              <div className="flex items-center gap-3">
                <Palette className="text-[#5A5A40]" size={20} />
                <h3 className="text-sm font-bold text-gray-900 dark:text-[#f5f5f0] uppercase tracking-widest">Appearance Settings</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label 
                  className="flex flex-col p-4 bg-gray-50 dark:bg-[#252520] rounded-2xl cursor-pointer hover:bg-gray-100 dark:hover:bg-[#2d2d25] transition-all border border-transparent has-[:checked]:border-[#5A5A40]/30 has-[:checked]:bg-[#5A5A40]/5 dark:has-[:checked]:bg-[#5A5A40]/10 h-full"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-gray-900 dark:text-[#f5f5f0]">Dark Mode</span>
                    <input 
                      type="checkbox"
                      checked={formData.preferences?.darkMode ?? false}
                      onChange={(e) => setFormData({
                        ...formData,
                        preferences: {
                          ...formData.preferences,
                          darkMode: e.target.checked
                        }
                      })}
                      className="w-4 h-4 rounded border-gray-300 dark:border-white/10 text-[#5A5A40] focus:ring-[#5A5A40]"
                    />
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-550 font-serif italic">Use dark canvas and background panels</span>
                </label>

                {/* Font Size Setting Card */}
                <div className="md:col-span-2 flex flex-col p-4 bg-gray-50 dark:bg-[#252520] rounded-2xl border border-transparent">
                  <span className="text-xs font-bold text-gray-900 dark:text-[#f5f5f0] mb-3">Font Size setting</span>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 'small', label: 'Small', desc: 'Smaller than normal' },
                      { id: 'normal', label: 'Normal', desc: 'Normal size' },
                      { id: 'medium', label: 'Medium', desc: 'Bigger than normal' },
                      { id: 'big', label: 'Big', desc: 'Bigger than medium' }
                    ].map((opt) => {
                      const isSelected = (formData.preferences?.fontSize || 'normal') === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setFormData({
                            ...formData,
                            preferences: {
                              ...formData.preferences,
                              fontSize: opt.id as any
                            }
                          })}
                          className={cn(
                            "flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center cursor-pointer",
                            isSelected 
                              ? "bg-[#5A5A40] text-white border-[#5A5A40] shadow-xs"
                              : "bg-white dark:bg-[#1e1e1a] text-gray-700 dark:text-gray-300 border-gray-150 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-[#2d2d25]"
                          )}
                        >
                          <span className={cn(
                            "text-xs font-bold",
                            opt.id === 'small' && "text-[11px]",
                            opt.id === 'normal' && "text-[13px]",
                            opt.id === 'medium' && "text-[15px]",
                            opt.id === 'big' && "text-[17px]"
                          )}>
                            {opt.label}
                          </span>
                          <span className={cn(
                            "text-[8px] mt-1 font-serif italic block leading-tight",
                            isSelected ? "text-white/85" : "text-gray-400 dark:text-gray-500"
                          )}>
                            {opt.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button
                type="submit"
                disabled={loading}
                className="w-full md:w-auto px-12 py-4 bg-[#5A5A40] text-white rounded-2xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:bg-[#4a4a35] transition-all disabled:opacity-50 shadow-lg shadow-[#5A5A40]/20"
              >
                {loading ? 'Updating...' : (
                  <>
                    <Save size={18} />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </motion.form>
        </div>
      </div>
    </div>
  );
}
