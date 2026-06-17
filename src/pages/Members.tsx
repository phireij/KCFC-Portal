import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Shield, User as UserIcon, Search, Filter, Star, Hash, Mail, Phone, MapPin } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Members() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // States for search and filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [memberTypeFilter, setMemberTypeFilter] = useState<'all' | 'core' | 'regular'>('all');
  const [ministryFilter, setMinistryFilter] = useState<string>('all');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snap) => {
      const u = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
      setUsers(u.filter(user => user.isVerified && user.email !== 'kcfc.jp@gmail.com'));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const ROLE_ORDER: Record<string, number> = {
    'spiritual_director': 1,
    'president': 2,
    'vice_president': 3,
    'secretary': 4,
    'treasurer': 5,
    'auditor': 6,
    'pro': 7,
    'choir_a_leader': 10,
    'choir_b_leader': 11,
    'lector_commentator_leader': 12,
    'usher_leader': 13,
    'altar_server_leader': 14,
    'kitchen_leader': 15,
    'cleaning_leader': 16,
  };

  const getSortScore = (user: UserProfile) => {
    let bestOrder = 999;
    user.roles.forEach(role => {
      if (ROLE_ORDER[role] < bestOrder) {
        bestOrder = ROLE_ORDER[role];
      }
    });
    return bestOrder;
  };

  // Filter & Search computation
  const filteredUsers = users.filter(u => {
    // 1. Search Query Match (Display Name, Nickname, Email, etc.)
    const query = searchQuery.toLowerCase().trim();
    if (query) {
      const nameMatch = u.displayName.toLowerCase().includes(query) || 
                        (u.nickname && u.nickname.toLowerCase().includes(query)) ||
                        u.email.toLowerCase().includes(query);
      if (!nameMatch) return false;
    }

    // 2. Ministry & Committee Filter Match
    if (ministryFilter !== 'all') {
      if (ministryFilter === 'liturgical_any') {
        const hasLiturgical = u.ministries?.some(m => ['choir_a', 'choir_b', 'lector_commentator', 'usher', 'altar_server'].includes(m));
        if (!hasLiturgical) return false;
      } else if (ministryFilter === 'chore_any') {
        const hasChore = u.ministries?.some(m => ['kitchen', 'cleaning'].includes(m));
        if (!hasChore) return false;
      } else {
        const hasSpecific = u.ministries?.includes(ministryFilter as any);
        if (!hasSpecific) return false;
      }
    }

    return true;
  });

  const displayCoreMembers = filteredUsers
    .filter(u => u.isCoreMember)
    .sort((a, b) => getSortScore(a) - getSortScore(b));
    
  const displayRegularMembers = filteredUsers
    .filter(u => !u.isCoreMember)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  if (loading) return <div className="p-8 text-center font-serif italic text-gray-400">Loading directory...</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 md:py-16">
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-[#5A5A40]/10 rounded-2xl">
              <Users className="text-[#5A5A40]" size={24} />
            </div>
            <h1 className="text-3xl font-serif font-medium tracking-tight text-gray-900 dark:text-white">Community Directory</h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 font-serif italic">Meet the brothers and sisters of our community.</p>
        </div>
        <div className="text-xs font-mono font-bold text-gray-400 bg-gray-50 dark:bg-[#252520] border border-gray-100 dark:border-white/5 rounded-full px-4 py-2 w-fit">
          📖 Verified Accounts: {users.length}
        </div>
      </header>

      {/* 🔍 Search & Filters Panel (Glassmorphism Dashboard style) */}
      <div className="bg-white/60 dark:bg-[#1e1e1a]/60 backdrop-blur-md p-6 rounded-[2.5rem] border border-gray-100/80 dark:border-white/5 shadow-xs mb-10 space-y-4 font-sans">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by name or nickname..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50/70 dark:bg-[#252520]/70 border border-gray-100 dark:border-white/5 rounded-2xl text-xs focus:ring-1 focus:ring-[#5A5A40] outline-none font-medium transition-all text-gray-900 dark:text-[#f5f5f0]"
            />
          </div>

          {/* Member type filter controller */}
          <div className="flex items-center bg-gray-50/80 dark:bg-[#252520]/80 p-1 rounded-2xl border border-gray-100 dark:border-white/5">
            <button
              onClick={() => setMemberTypeFilter('all')}
              className={cn(
                "flex-1 text-center py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all",
                memberTypeFilter === 'all' 
                  ? "bg-white dark:bg-[#1e1e1a] text-gray-800 dark:text-white shadow-3xs" 
                  : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 font-semibold"
              )}
            >
              All
            </button>
            <button
              onClick={() => setMemberTypeFilter('core')}
              className={cn(
                "flex-1 text-center py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all",
                memberTypeFilter === 'core' 
                  ? "bg-[#5A5A40] text-white shadow-3xs" 
                  : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 font-semibold"
              )}
            >
              Core Members
            </button>
            <button
              onClick={() => setMemberTypeFilter('regular')}
              className={cn(
                "flex-1 text-center py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all",
                memberTypeFilter === 'regular' 
                  ? "bg-orange-600 text-white shadow-3xs" 
                  : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 font-semibold"
              )}
            >
              Regular
            </button>
          </div>

          {/* Ministry specific selectors */}
          <div className="relative">
            <select
              value={ministryFilter}
              onChange={e => setMinistryFilter(e.target.value)}
              className="w-full pl-4 pr-10 py-2.5 bg-gray-50/70 dark:bg-[#252520]/70 border border-gray-100 dark:border-white/5 rounded-2xl text-xs focus:ring-1 focus:ring-[#5A5A40] outline-none font-medium transition-all cursor-pointer appearance-none text-gray-600 dark:text-[#f5f5f0]"
            >
              <option value="all">⭐ Filter by Ministry / Committee</option>
              <optgroup label="Liturgical Ministries">
                <option value="liturgical_any">Any Liturgical Ministry</option>
                <option value="choir_a">Choir A</option>
                <option value="choir_b">Choir B</option>
                <option value="lector_commentator">Lector & Commentator</option>
                <option value="usher">Usher</option>
                <option value="altar_server">Altar Server</option>
              </optgroup>
              <optgroup label="Chore Committees">
                <option value="chore_any">Any Chore Committee</option>
                <option value="kitchen">🍳 Kitchen Committee</option>
                <option value="cleaning">🧹 Cleaning Committee</option>
              </optgroup>
            </select>
            <div className="absolute right-3.5 top-3 pointer-events-none text-gray-450">
              <Filter size={14} />
            </div>
          </div>

        </div>
      </div>

      <div className="space-y-16">
        <AnimatePresence mode="wait">
          {/* Core Members block */}
          {(memberTypeFilter === 'all' || memberTypeFilter === 'core') && (
            <motion.section
              key="core-members-section"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 border-b border-gray-100 dark:border-white/5 pb-4">
                <Shield className="text-[#5A5A40] dark:text-[#8a8a65]" size={20} />
                <h2 className="text-xs font-bold text-[#5A5A40] dark:text-[#8a8a65] uppercase tracking-[0.3em]">Core Members Group</h2>
                <span className="text-[10px] bg-[#5A5A40]/10 text-[#5A5A40] dark:bg-[#8a8a65]/20 dark:text-[#8a8a65] px-2.5 py-0.5 rounded-full font-bold">
                  {displayCoreMembers.length}
                </span>
              </div>
              
              {displayCoreMembers.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400 dark:text-gray-500 bg-gray-50/30 dark:bg-[#1e1e1a]/30 border border-dashed rounded-3xl font-serif italic">
                  No Core Members match current filters.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayCoreMembers.map((user, idx) => (
                    <motion.div
                      key={user.uid}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className="bg-white dark:bg-[#1e1e1a] p-6 rounded-[2.2rem] border border-gray-50 dark:border-white/5 shadow-xs hover:shadow-md transition-all group relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#5A5A40]/5 via-transparent to-transparent rounded-bl-full pointer-events-none flex justify-end p-2.5">
                        <Star size={12} className="text-[#5A5A40]/40 dark:text-[#8a8a65]/40" />
                      </div>

                      <div className="flex items-start gap-4 mb-4 font-sans">
                        <img 
                          referrerPolicy="no-referrer"
                          src={user.photoURL} 
                          alt="" 
                          className="w-14 h-14 rounded-full border-2 border-[#5A5A40]/10 shrink-0 object-cover" 
                        />
                        <div className="space-y-1">
                          <h3 className="font-bold text-sm text-[#1a1a1a] dark:text-white flex items-center gap-1.5 flex-wrap">
                            {user.displayName}
                            {user.nickname && (
                              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono tracking-wider font-semibold">({user.nickname})</span>
                            )}
                          </h3>
                          
                          {/* Profile details if available */}
                          {user.phoneNumber && (
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium flex items-center gap-1">
                              <Phone size={10} /> {user.phoneNumber}
                            </span>
                          )}

                          <div className="flex flex-wrap gap-1 pt-1">
                            {user.roles.filter(r => r !== 'member' && r !== 'admin').map(role => (
                              <span key={role} className="text-[8px] font-bold uppercase tracking-widest text-[#5A5A40] dark:text-[#8a8a65] bg-[#5A5A40]/5 dark:bg-[#8a8a65]/10 px-1.5 py-0.5 rounded border border-[#5A5A40]/10 dark:border-[#8a8a65]/20">
                                {role.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Display assigned ministries or committees */}
                      {user.ministries && user.ministries.length > 0 && (
                        <div className="pt-3 border-t border-gray-50 flex flex-wrap gap-1">
                          {user.ministries.map(m => {
                            let icon = '';
                            let badgeStyle = 'bg-gray-50 text-gray-600 border border-gray-100';
                            if (m === 'kitchen') { icon = '🍳 '; badgeStyle = 'bg-orange-50 text-orange-700 border border-orange-100/70'; }
                            else if (m === 'cleaning') { icon = '🧹 '; badgeStyle = 'bg-blue-50 text-blue-700 border border-blue-100/70'; }
                            else if (m === 'choir_a') { icon = '🎵 '; badgeStyle = 'bg-pink-50 text-pink-700 border border-pink-100/70'; }
                            else if (m === 'choir_b') { icon = '🎶 '; badgeStyle = 'bg-purple-50 text-purple-700 border border-purple-100/70'; }
                            else if (m === 'lector_commentator') { icon = '📖 '; badgeStyle = 'bg-emerald-50 text-emerald-700 border border-emerald-100/70'; }
                            else if (m === 'usher') { icon = '⛪ '; badgeStyle = 'bg-amber-50 text-amber-700 border border-amber-100/70'; }
                            else if (m === 'altar_server') { icon = '🕯️ '; badgeStyle = 'bg-red-50 text-red-700 border border-red-100/70'; }
                            
                            if (!icon) return null;
                            return (
                              <span key={m} className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${badgeStyle} flex items-center gap-0.5`}>
                                {icon}{m.replace(/_/g, ' ')}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.section>
          )}

          {/* Regular Members block */}
          {(memberTypeFilter === 'all' || memberTypeFilter === 'regular') && (
            <motion.section
              key="regular-members-section"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 border-b border-gray-100 dark:border-white/5 pb-4">
                <UserIcon className="text-gray-400" size={20} />
                <h2 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.3em]">Regular Members Group</h2>
                <span className="text-[10px] bg-gray-100 dark:bg-[#252520] text-gray-500 dark:text-gray-400 px-2.5 py-0.5 rounded-full font-bold">
                  {displayRegularMembers.length}
                </span>
              </div>

              {displayRegularMembers.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400 dark:text-gray-500 bg-gray-50/30 dark:bg-[#1e1e1a]/30 border border-dashed rounded-3xl font-serif italic">
                  No Regular Members match current filters.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayRegularMembers.map((user, idx) => (
                    <motion.div
                      key={user.uid}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.01 }}
                      className="bg-white/50 dark:bg-[#1e1e1a]/50 p-6 rounded-[2.2rem] border border-gray-100/80 dark:border-white/5 hover:bg-white dark:hover:bg-[#1e1e1a] hover:shadow-xs transition-all relative overflow-hidden"
                    >
                      <div className="flex items-start gap-4 mb-4 font-sans">
                        <img 
                          referrerPolicy="no-referrer"
                          src={user.photoURL} 
                          alt="" 
                          className="w-12 h-12 rounded-full border border-gray-100 dark:border-white/5 shrink-0 object-cover" 
                        />
                        <div className="space-y-1">
                          <h3 className="font-bold text-sm text-gray-700 dark:text-gray-200 flex items-center gap-1.5 flex-wrap">
                            {user.displayName}
                            {user.nickname && (
                              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono tracking-wider font-semibold">({user.nickname})</span>
                            )}
                          </h3>

                          {user.phoneNumber && (
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium flex items-center gap-1">
                              <Phone size={10} /> {user.phoneNumber}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Display assigned ministries or committees */}
                      {user.ministries && user.ministries.length > 0 && (
                        <div className="pt-3 border-t border-gray-50 dark:border-white/5 flex flex-wrap gap-1">
                          {user.ministries.map(m => {
                            let icon = '';
                            let badgeStyle = 'bg-gray-50 text-gray-600 border border-gray-100 dark:bg-[#252520] dark:text-[#f5f5f0] dark:border-white/5';
                            if (m === 'kitchen') { icon = '🍳 '; badgeStyle = 'bg-orange-50 text-orange-700 border border-orange-100/70 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/35'; }
                            else if (m === 'cleaning') { icon = '🧹 '; badgeStyle = 'bg-blue-50 text-blue-700 border border-blue-100/70 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/35'; }
                            else if (m === 'choir_a') { icon = '🎵 '; badgeStyle = 'bg-pink-50 text-pink-700 border border-pink-100/70 dark:bg-pink-950/20 dark:text-pink-400 dark:border-pink-900/35'; }
                            else if (m === 'choir_b') { icon = '🎶 '; badgeStyle = 'bg-purple-50 text-purple-700 border border-purple-100/70 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/35'; }
                            else if (m === 'lector_commentator') { icon = '📖 '; badgeStyle = 'bg-emerald-50 text-emerald-700 border border-emerald-100/70 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/35'; }
                            else if (m === 'usher') { icon = '⛪ '; badgeStyle = 'bg-amber-50 text-amber-700 border border-amber-100/70 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/35'; }
                            else if (m === 'altar_server') { icon = '🕯️ '; badgeStyle = 'bg-red-50 text-red-700 border border-red-100/70 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/35'; }
                            
                            if (!icon) return null;
                            return (
                              <span key={m} className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${badgeStyle} flex items-center gap-0.5`}>
                                {icon}{m.replace(/_/g, ' ')}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        {/* Outer matched check */}
        {filteredUsers.length === 0 && (
          <div className="p-16 text-center bg-gray-50 dark:bg-[#1e1e1a] rounded-[2.5rem] border border-dashed border-gray-200 dark:border-white/5">
            <Users className="w-12 h-12 text-gray-250 dark:text-gray-600 mx-auto mb-4" />
            <h4 className="text-sm font-bold text-gray-700 dark:text-[#f5f5f0]">No Matched Directory Profiles</h4>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Adjust or clear your search input or filters to show more active community members.</p>
          </div>
        )}
      </div>
    </div>
  );
}
