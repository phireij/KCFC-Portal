import React, { useEffect, useState } from 'react';
import { useAuth } from '../App';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Announcement, UserRole } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Megaphone, Plus, Trash2, Edit3, Send, Save, X, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

export default function Announcements() {
  const { profile, user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    content: ''
  });

  // Permissions
  const canCreate = (profile?.roles || []).some(r => 
    ['admin', 'president', 'vice_president', 'spiritual_director', 'secretary', 'pro'].includes(r)
  );

  const canEditOthers = (profile?.roles || []).some(r => 
    ['admin', 'president'].includes(r)
  );

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (status: 'draft' | 'published') => {
    if (!user || !profile) return;
    if (!formData.title || !formData.content) return;

    const data = {
      title: formData.title,
      content: formData.content,
      status,
      updatedAt: serverTimestamp(),
      authorId: user.uid,
      authorName: profile.displayName,
      ...(status === 'published' && { publishedAt: serverTimestamp() })
    };

    try {
      let announcementId = editingId;
      if (editingId) {
        await updateDoc(doc(db, 'announcements', editingId), data);
      } else {
        const docRef = await addDoc(collection(db, 'announcements'), {
          ...data,
          createdAt: serverTimestamp()
        });
        announcementId = docRef.id;
      }

      // Create notifications if published
      if (status === 'published') {
        const usersSnap = await getDocs(collection(db, 'users'));
        const batch = writeBatch(db);
        
        usersSnap.docs.forEach(userDoc => {
          // Skip if user disabled announcement notifications in preferences (default is active)
          const userData = userDoc.data();
          if (userData.preferences?.announcements === false) return;

          const notificationRef = doc(collection(db, 'notifications'));
          batch.set(notificationRef, {
            userId: userDoc.id,
            title: 'New Announcement',
            message: formData.title,
            type: 'announcement',
            status: 'unread',
            link: '/announcements',
            createdAt: serverTimestamp()
          });
        });
        
        await batch.commit();

        // Dispatch Firebase Cloud Messaging push broadcast via our backend service
        try {
          const recipientTokens: string[] = [];
          usersSnap.docs.forEach(userDoc => {
            const userData = userDoc.data();
            if (userData.preferences?.announcements === false) return;
            const tokens = userData.fcmTokens || [];
            if (Array.isArray(tokens)) {
              recipientTokens.push(...tokens.filter((tk: any) => typeof tk === "string" && tk.trim() !== ""));
            }
          });

          const idToken = await user.getIdToken();
          const pResponse = await fetch('/api/admin/broadcast-announcement-push', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              title: `New Announcement: ${formData.title}`,
              body: formData.content,
              recipientTokens: recipientTokens
            })
          });
          const pResult = await pResponse.json();
          console.log("FCM push broadcast response:", pResult);
        } catch (pushError) {
          console.error("FCM push notification dispatch failed:", pushError);
        }
      }

      setIsEditorOpen(false);
      setEditingId(null);
      setFormData({ title: '', content: '' });
    } catch (err) {
      console.error(err);
      alert("Failed to save announcement");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this announcement?")) return;
    try {
      await deleteDoc(doc(db, 'announcements', id));
    } catch (err) {
      console.error(err);
    }
  };

  const startEdit = (a: Announcement) => {
    setEditingId(a.id || null);
    setFormData({ title: a.title, content: a.content });
    setIsEditorOpen(true);
  };

  const filteredAnnouncements = announcements.filter(a => {
    if (a.status === 'published') return true;
    // Drafts only visible to authors or admins/presidents
    return a.authorId === user?.uid || canEditOthers;
  });

  if (loading) return <div className="p-8 text-center font-serif italic text-gray-400">Loading announcements...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12 space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif flex items-center gap-3 text-gray-900 dark:text-white">
            <Megaphone className="text-[#5A5A40] dark:text-[#8a8a65]" />
            Community News
          </h1>
          <p className="text-gray-500 dark:text-gray-400 font-serif italic text-sm mt-1">Stay updated with the latest from KCFC.</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setIsEditorOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-[#5A5A40] dark:bg-[#8a8a65] text-white dark:text-[#11110f] rounded-full font-bold text-xs uppercase tracking-widest shadow-soft hover:shadow-lg transition-all"
          >
            <Plus size={16} />
            Post New
          </button>
        )}
      </header>

      <AnimatePresence>
        {isEditorOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <div className="bg-white dark:bg-[#1e1e1a] w-full max-w-2xl rounded-[32px] overflow-hidden shadow-2xl border dark:border-white/5">
              <div className="p-8 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-[#252520]/50">
                <h2 className="text-xl font-serif font-medium text-gray-900 dark:text-white">{editingId ? 'Edit Announcement' : 'New Announcement'}</h2>
                <button onClick={() => setIsEditorOpen(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-[#252520] rounded-full transition-colors text-gray-400">
                  <X size={20} />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-2">Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-6 py-4 bg-gray-50 dark:bg-[#252520] border-none rounded-2xl focus:ring-2 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] text-gray-900 dark:text-white transition-all font-medium outline-none"
                    placeholder="Brief headline..."
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-2">Content</label>
                  <textarea
                    rows={6}
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    className="w-full px-6 py-4 bg-gray-50 dark:bg-[#252520] border-none rounded-2xl focus:ring-2 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] text-gray-900 dark:text-white transition-all resize-none outline-none"
                    placeholder="What would you like to share with the community?"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => handleSubmit('published')}
                    className="flex-1 flex items-center justify-center gap-2 py-4 bg-[#5A5A40] text-white rounded-full font-bold text-xs uppercase tracking-widest shadow-soft hover:shadow-lg transition-all"
                  >
                    <Send size={16} />
                    {editingId ? 'Save & Publish' : 'Send Announcement'}
                  </button>
                  <button
                    onClick={() => handleSubmit('draft')}
                    className="flex-1 flex items-center justify-center gap-2 py-4 bg-gray-100 dark:bg-[#252520] text-gray-600 dark:text-gray-400 rounded-full font-bold text-xs uppercase tracking-widest hover:bg-gray-200 dark:hover:bg-[#2c2c25] transition-all"
                  >
                    <Save size={16} />
                    Save as Draft
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        {filteredAnnouncements.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-[#1e1e1a] rounded-[32px] border border-gray-100 dark:border-white/5 italic font-serif text-gray-400 dark:text-gray-500">
            No announcements yet.
          </div>
        ) : (
          filteredAnnouncements.map((a, idx) => {
            const isAuthor = a.authorId === user?.uid;
            const canManage = isAuthor || canEditOthers;
            
            return (
              <motion.article
                key={a.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={cn(
                  "bg-white dark:bg-[#1e1e1a] p-8 rounded-[32px] border transition-all hover:shadow-soft dark:hover:shadow-none",
                  a.status === 'draft' 
                    ? "border-dashed border-gray-200 dark:border-white/10" 
                    : "border-gray-50 dark:border-white/5"
                )}
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                       {a.status === 'draft' ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-50 dark:bg-yellow-950/20 text-yellow-600 dark:text-yellow-400 text-[8px] font-bold uppercase rounded-full">
                          <Clock size={10} /> Draft
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 text-[8px] font-bold uppercase rounded-full">
                          <CheckCircle2 size={10} /> Published
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                        {a.createdAt ? format((a.createdAt as any).toDate(), 'PPP p') : 'Pending...'}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-[#f5f5f0] leading-tight">{a.title}</h2>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => startEdit(a)}
                        className="p-2 text-gray-400 hover:text-[#5A5A40] dark:hover:text-[#8a8a65] hover:bg-gray-50 dark:hover:bg-[#252520] rounded-full transition-all"
                      >
                        <Edit3 size={18} />
                      </button>
                      <button 
                         onClick={() => a.id && handleDelete(a.id)}
                         className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-full transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="prose prose-sm max-w-none text-gray-600 dark:text-gray-300 whitespace-pre-wrap font-serif">
                  {a.content}
                </div>
                <div className="mt-8 pt-4 border-t border-gray-50 dark:border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-gray-100 dark:bg-[#252520] rounded-full flex items-center justify-center text-[10px] font-bold text-gray-400 dark:text-gray-500">
                      {a.authorName.charAt(0)}
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">{a.authorName}</span>
                  </div>
                </div>
              </motion.article>
            );
          })
        )}
      </div>
    </div>
  );
}
