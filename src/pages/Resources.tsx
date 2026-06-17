import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { collection, query, getDocs, orderBy, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Resource } from '../types';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { FileText, Image as ImageIcon, ExternalLink, Plus, Trash2, Search } from 'lucide-react';
import { format } from 'date-fns';

export default function Resources() {
  const { profile, user } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newResource, setNewResource] = useState({
    title: '',
    description: '',
    ministry: 'Choir',
    fileUrl: '',
    fileType: 'pdf'
  });

  const isAdmin = profile?.roles.some(r => ['admin', 'president', 'vice_president', 'secretary', 'auditor', 'choir_a_leader', 'choir_b_leader', 'lector_commentator_leader', 'usher_leader', 'altar_server_leader', 'kitchen_leader', 'kitchen_sub_leader', 'cleaning_leader', 'cleaning_sub_leader'].includes(r));

  useEffect(() => {
    const fetchResources = async () => {
      try {
        const q = query(collection(db, 'resources'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setResources(snap.docs.map(d => ({ id: d.id, ...d.data() } as Resource)));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchResources();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    try {
      const resourceData: Omit<Resource, 'id'> = {
        ...newResource,
        uploadedBy: user.uid,
        createdAt: new Date().toISOString()
      };
      const docRef = await addDoc(collection(db, 'resources'), {
        ...resourceData,
        createdAt: serverTimestamp()
      });
      setResources(prev => [{ id: docRef.id, ...resourceData }, ...prev]);
      setShowAddForm(false);
      setNewResource({ title: '', description: '', ministry: 'Choir', fileUrl: '', fileType: 'pdf' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this document?")) return;
    try {
      await deleteDoc(doc(db, 'resources', id));
      setResources(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const filteredResources = filter === 'all' 
    ? resources 
    : resources.filter(r => r.ministry.toLowerCase() === filter.toLowerCase());

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-gray-900 dark:text-white">Ministry Resources</h1>
          <p className="text-gray-500 dark:text-gray-400 font-serif italic text-sm mt-1">Guides, music sheets, and liturgical materials.</p>
        </div>
        {isAdmin && !showAddForm && (
          <button 
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#5A5A40] dark:bg-[#8a8a65] text-white dark:text-[#11110f] rounded-full text-sm font-medium hover:bg-[#4a4a35] transition-all"
          >
            <Plus size={18} />
            Library Addition
          </button>
        )}
      </div>

      {showAddForm && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-[#1e1e1a] p-8 rounded-[32px] border border-gray-100 dark:border-white/5 shadow-lg space-y-6"
        >
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add to Library</h2>
            <button onClick={() => setShowAddForm(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 font-bold">Cancel</button>
          </div>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              required
              placeholder="Document Title"
              value={newResource.title}
              onChange={e => setNewResource({...newResource, title: e.target.value})}
              className="px-4 py-3 bg-gray-50 dark:bg-[#252520] text-gray-900 dark:text-white rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] outline-none"
            />
            <select
              value={newResource.ministry}
              onChange={e => setNewResource({...newResource, ministry: e.target.value})}
              className="px-4 py-3 bg-gray-50 dark:bg-[#252520] text-gray-900 dark:text-white rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] outline-none"
            >
              <option className="bg-white dark:bg-[#1e1e1a]">Choir</option>
              <option className="bg-white dark:bg-[#1e1e1a]">Lector</option>
              <option className="bg-white dark:bg-[#1e1e1a]">Usher</option>
              <option className="bg-white dark:bg-[#1e1e1a]">Altar Server</option>
              <option className="bg-white dark:bg-[#1e1e1a]">Other</option>
            </select>
            <input
              required
              placeholder="File URL (e.g., Google Drive link)"
              value={newResource.fileUrl}
              onChange={e => setNewResource({...newResource, fileUrl: e.target.value})}
              className="px-4 py-3 bg-gray-50 dark:bg-[#252520] text-gray-900 dark:text-white rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] col-span-full outline-none"
            />
            <textarea
              placeholder="Short description..."
              value={newResource.description}
              onChange={e => setNewResource({...newResource, description: e.target.value})}
              className="px-4 py-3 bg-gray-50 dark:bg-[#252520] text-gray-900 dark:text-white rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] col-span-full h-24 outline-none"
            />
            <button 
              type="submit"
              className="px-6 py-3 bg-[#5A5A40] dark:bg-[#8a8a65] text-white dark:text-[#11110f] rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-[#4a4a35] transition-all"
            >
              Add Document
            </button>
          </form>
        </motion.div>
      )}

      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {['All', 'Choir', 'Lector', 'Usher', 'Altar Server'].map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat.toLowerCase() === 'all' ? 'all' : cat)}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap",
              (filter === 'all' && cat === 'All') || (filter.toLowerCase() === cat.toLowerCase())
                ? "bg-[#5A5A40] dark:bg-[#8a8a65] text-white dark:text-[#11110f]"
                : "bg-white dark:bg-[#1e1e1a] text-gray-400 dark:text-gray-500 border border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-[#252520]"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-20 text-gray-400 dark:text-gray-500">Loading resources...</div>
        ) : filteredResources.length === 0 ? (
          <div className="col-span-full text-center py-20 bg-white dark:bg-[#1e1e1a] rounded-[32px] border border-dashed border-gray-200 dark:border-white/10">
            <p className="text-gray-400 dark:text-gray-500 font-serif italic">No documents found for this category.</p>
          </div>
        ) : (
          filteredResources.map((res, i) => (
            <motion.div
              key={res.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white dark:bg-[#1e1e1a] p-6 rounded-[24px] border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow group relative"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gray-50 dark:bg-[#252520] rounded-2xl">
                  {res.fileType.includes('image') ? (
                    <ImageIcon size={24} className="text-[#5A5A40] dark:text-[#8a8a65]" />
                  ) : (
                    <FileText size={24} className="text-[#5A5A40] dark:text-[#8a8a65]" />
                  )}
                </div>
                <div className="text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-gray-500">
                  {res.ministry}
                </div>
              </div>
              
              <h3 className="text-lg font-bold line-clamp-1 text-gray-900 dark:text-white">{res.title}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2 min-h-[32px]">{res.description || 'No description provided.'}</p>
              
              <div className="mt-6 pt-4 border-t border-gray-50 dark:border-white/5 flex items-center justify-between">
                <span className="text-[10px] text-gray-400 dark:text-gray-550">
                  {format(new Date(res.createdAt), 'MMM dd, yyyy')}
                </span>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <button 
                      onClick={() => res.id && handleDelete(res.id)}
                      className="p-2 text-gray-200 dark:text-gray-600 hover:text-red-500 rounded-full transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <a 
                    href={res.fileUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="p-2 bg-gray-50 dark:bg-[#252520] text-gray-400 dark:text-gray-500 hover:text-[#5A5A40] dark:hover:text-[#8a8a65] hover:bg-gray-100 dark:hover:bg-[#2d2d25] rounded-full transition-colors"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
