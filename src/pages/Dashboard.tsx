import React, { useEffect, useState } from 'react';
import { useAuth } from '../App';
import { collection, query, getDocs, where, getCountFromServer, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { motion } from 'motion/react';
import { Users, ClipboardCheck, CalendarRange, FolderOpen, AlertCircle, ArrowRight, UserCheck, Wallet, Database as DatabaseIcon, CheckCircle2 as CheckCircle, Loader2, Trash2 } from 'lucide-react';
import { UserProfile, Poll, Resource, Announcement, MinistryType, Transaction } from '../types';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { seedDatabase, purgeAllDummyData } from '../lib/seeder';

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    members: 0,
    activePolls: 0,
    resources: 0,
    pendingUsers: 0
  });
  const [pendingList, setPendingList] = useState<UserProfile[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [committeeCounts, setCommitteeCounts] = useState<{ [key: string]: number }>({});
  const [balance, setBalance] = useState<number | null>(null);
  const [upcomingAssignments, setUpcomingAssignments] = useState<{ type: string, date: string, slot?: string, id?: string, tab?: 'core' | 'liturgical' }[]>([]);

  // Database initialization states
  const [seeding, setSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeSuccess, setPurgeSuccess] = useState(false);

  const isAdmin = (profile?.roles || []).some(r => ['admin', 'president', 'vice_president', 'secretary', 'auditor'].includes(r));
  const isAccountingAuthorized = (profile?.roles || []).some(r => ['admin', 'president', 'treasurer'].includes(r));

  const handleSeedDatabase = async () => {
    if (!profile?.uid) return;
    setSeeding(true);
    try {
      await seedDatabase(profile.uid, profile.email || '');
      setSeedSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      console.error("Failed to seed database:", err);
      alert("Error initializing database: " + err.message);
    } finally {
      setSeeding(false);
    }
  };

  const handlePurgeAllDummyData = async () => {
    if (!profile?.uid) return;
    if (!window.confirm("Are you absolutely sure you want to permanently delete all sample/dummy records (including mock members, mock templates, active polls, contact messages, and sample accounting transactions) from this temporary database? This will NOT affect portal.kcfcjp.com.")) {
      return;
    }
    setPurging(true);
    try {
      await purgeAllDummyData(profile.uid);
      setPurgeSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      console.error("Failed to purge database:", err);
      alert("Error purging database: " + err.message);
    } finally {
      setPurging(false);
    }
  };

  useEffect(() => {
    if (!profile) return;

    // Real-time listener for pending users if admin
    let unsubscribePending = () => {};
    if (isAdmin) {
      unsubscribePending = onSnapshot(query(collection(db, 'users'), where('isVerified', '==', false)), (snap) => {
        const pending = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
        setPendingList(pending);
        setStats(prev => ({ ...prev, pendingUsers: pending.length }));
      }, (err) => {
        console.error("Error listing pending users on Dashboard:", err);
      });
    }

    // Real-time listener for latest published announcements
    const qAnnouncements = query(
      collection(db, 'announcements'), 
      where('status', '==', 'published'),
      orderBy('createdAt', 'desc'),
      limit(3)
    );
    const unsubscribeAnnouncements = onSnapshot(qAnnouncements, (snap) => {
      setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() } as Announcement)));
    }, (err) => {
      console.error("Error listening to announcements on Dashboard:", err);
    });

    // Real-time listener for users to compute committee stats
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const users = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)).filter(u => u.email !== 'kcfc.jp@gmail.com');
      const counts: { [key: string]: number } = {};
      
      users.forEach(u => {
        u.ministries?.forEach(m => {
          counts[m] = (counts[m] || 0) + 1;
        });
      });
      
      setCommitteeCounts(counts);
      setStats(prev => ({ ...prev, members: users.length }));
    }, (err) => {
      console.error("Error listing users on Dashboard:", err);
    });

    let unsubscribeAccounting = () => {};
    if (isAccountingAuthorized) {
      unsubscribeAccounting = onSnapshot(collection(db, 'accounting'), (snap) => {
        const trans = snap.docs.map(d => d.data() as Transaction);
        const bal = trans.reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0);
        setBalance(bal);
      }, (err) => {
        console.error("Error listening to accounting on Dashboard:", err);
      });
    }

    const fetchOtherStats = async () => {
      try {
        const [pollsSnap, resourcesCount] = await Promise.all([
          getDocs(query(collection(db, 'polls'), where('status', '==', 'active'))),
          getDocs(collection(db, 'resources'))
        ]);

        setStats(prev => ({
          ...prev,
          activePolls: pollsSnap.size,
          resources: resourcesCount.size
        }));
      } catch (err) {
        console.error("Dashboard Stats Error: ", err);
      }
    };

    fetchOtherStats();

    // Fetch user's upcoming assignments
    const fetchUpcoming = async () => {
      if (!profile?.uid) return;
      try {
        const assignments: { type: string, date: string, slot?: string, id?: string, tab? : 'core' | 'liturgical' }[] = [];
        const now = new Date().toISOString();

        // 1. Check duties collection
        const dutiesQ = query(
          collection(db, 'duties'),
          where('userId', '==', profile.uid),
          where('date', '>=', now),
          orderBy('date', 'asc'),
          limit(5)
        );
        const dutiesSnap = await getDocs(dutiesQ);
        dutiesSnap.docs.forEach(d => {
          const data = d.data();
          assignments.push({
            type: data.type === 'kitchen' ? 'Kitchen Duty' : data.type === 'cleaning' ? 'Cleaning Duty' : 'Ministry Duty',
            date: data.date,
            slot: data.slot,
            id: data.pollId,
            tab: (data.type === 'kitchen' || data.type === 'cleaning') ? 'core' : 'liturgical'
          });
        });

        // 2. Check polls for liturgical assignments
        const pollsQ = query(collection(db, 'polls'), where('status', '==', 'active'));
        const pollsSnap = await getDocs(pollsQ);
        pollsSnap.docs.forEach(d => {
          const poll = d.data() as Poll;
          if (poll.assignments) {
            Object.entries(poll.assignments).forEach(([date, dateAssignments]) => {
              if (date >= now && dateAssignments[profile.uid]) {
                assignments.push({
                  type: 'Liturgical: ' + dateAssignments[profile.uid],
                  date: date,
                  slot: poll.title,
                  id: d.id,
                  tab: 'liturgical'
                });
              }
            });
          }
        });

        // Sort and take top 2
        const sorted = assignments.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 2);
        setUpcomingAssignments(sorted);
      } catch (err) {
        console.error("Error fetching upcoming assignments:", err);
      }
    };

    fetchUpcoming();

    return () => {
      unsubscribePending();
      unsubscribeAnnouncements();
      unsubscribeUsers();
      unsubscribeAccounting();
    };
  }, [profile, isAdmin, isAccountingAuthorized]);

  const MINISTRY_LABELS: { [key in MinistryType]: string } = {
    choir_a: 'Choir A',
    choir_b: 'Choir B',
    lector_commentator: 'Lectors/Comm.',
    usher: 'Ushers',
    altar_server: 'Altar Servers',
    kitchen: 'Kitchen',
    cleaning: 'Cleaning',
    cleaning_toilet_ok: 'Toilet OK',
    cleaning_toilet_ng: 'Toilet NG'
  };

  const liturgicalCommittees = ['choir_a', 'choir_b', 'lector_commentator', 'usher', 'altar_server'];
  const choreCommittees = ['kitchen', 'cleaning'];

  const statCards = [
    { label: 'Community Members', value: stats.members, icon: Users, color: 'blue', path: '/members' },
    { label: 'Pending Approval', value: stats.pendingUsers, icon: UserCheck, color: 'orange', hidden: !isAdmin, path: '/admin' },
    { label: 'Treasury Balance', value: balance === null ? '...' : `¥${balance.toLocaleString()}`, icon: Wallet, color: 'green', hidden: !isAccountingAuthorized, path: '/accounting' },
    { label: 'Active Polls', value: stats.activePolls, icon: ClipboardCheck, color: 'green', path: '/polls' },
    { label: 'Library Items', value: stats.resources, icon: FolderOpen, color: 'purple', path: '/resources' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-serif text-[#1a1a1a] dark:text-white">Welcome back, {profile?.nickname?.trim() || profile?.displayName}</h1>
          <p className="text-gray-500 dark:text-gray-400 font-serif italic mt-1">Here's what's happening in the community.</p>
        </div>
        <div className="flex gap-2">
          {(profile?.roles || []).map(role => {
            const displayRole = (role === 'member' && profile?.isCoreMember) ? 'Core Member' : role;
            return (
              <span key={role} className="px-3 py-1 bg-[#5A5A40] text-white text-[10px] uppercase tracking-wider rounded-full font-bold">
                {displayRole.replace('_', ' ')}
              </span>
            );
          })}
        </div>
      </header>

      {/* 🚀 Brand New Database / Initialization Banner */}
      {isAdmin && stats.members <= 25 && (
        <section className="bg-gradient-to-r from-[#5A5A40]/10 via-[#8a8a65]/5 to-transparent border border-[#5A5A40]/20 rounded-[32px] overflow-hidden p-8 backdrop-blur-md">
          <div className="max-w-3xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#5A5A40] rounded-2xl flex items-center justify-center text-white">
                <DatabaseIcon size={24} />
              </div>
              <div>
                <h2 className="text-xl font-serif font-bold text-gray-900 dark:text-white">
                  {stats.members <= 1 ? "Initialize Your Workspace" : "Populate KCFC Sample Records"}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {stats.members <= 1 ? "Database Connection Confirmed • Clean Environment" : "Database Workspace Manager • Re-seeding Available"}
                </p>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-300 font-serif leading-relaxed">
              {stats.members <= 1 
                ? "Your KCFC Portal is successfully connected to your newly provisioned Firebase Firestore database. Since this is a completely brand new, secure environment, there are no existing records yet."
                : `Your KCFC Portal is successfully connected to Firestore and has detected ${stats.members} user record(s). If your previous attempt was interrupted, or if you have pending membership requests, you can re-seed the sample database to ensure all data points are fully populated.`}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300 font-serif leading-relaxed">
              Click below to instantly populate your database with high-fidelity sample records (including **chore duty templates**, **active mass polls**, **financial logs**, and **message inbox logs**) or permanently purge all dummy records to work with a clean, correct environment.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                onClick={handleSeedDatabase}
                disabled={seeding || seedSuccess || purging}
                className="px-6 py-3 bg-[#5A5A40] hover:bg-[#4a4a35] disabled:bg-[#5A5A40]/50 text-white font-bold rounded-2xl text-xs uppercase tracking-wider flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                {seeding ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Initializing Records...
                  </>
                ) : seedSuccess ? (
                  <>
                    <CheckCircle className="text-green-400" size={16} />
                    Database Seeding Successful!
                  </>
                ) : (
                  <>
                    <DatabaseIcon size={16} />
                    {stats.members <= 1 ? "Populate KCFC Sample Records" : "Re-populate KCFC Sample Records"}
                  </>
                )}
              </button>

              {stats.members > 1 && (
                <button
                  onClick={handlePurgeAllDummyData}
                  disabled={purging || purgeSuccess || seeding}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white font-bold rounded-2xl text-xs uppercase tracking-wider flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer"
                >
                  {purging ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Purging Database...
                    </>
                  ) : purgeSuccess ? (
                    <>
                      <CheckCircle className="text-green-400" size={16} />
                      Purge Successful!
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Purge Dummy/Sample Data
                    </>
                  )}
                </button>
              )}

              {(seeding || purging) && (
                <span className="text-xs text-[#5A5A40] dark:text-[#8a8a65] font-mono font-bold animate-pulse">
                  {seeding ? "Deploying templates, categories & transactions..." : "Cleaning out dummy files & records..."}
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {isAdmin && stats.pendingUsers > 0 && (
        <section className="bg-yellow-50/50 dark:bg-yellow-950/10 border border-yellow-100 dark:border-yellow-500/20 rounded-[32px] overflow-hidden">
          <div className="p-6 border-b border-yellow-100 dark:border-yellow-500/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-950/30 rounded-full flex items-center justify-center text-yellow-700 dark:text-yellow-400">
                <AlertCircle size={20} />
              </div>
              <div>
                <h2 className="font-bold text-yellow-900 dark:text-yellow-200">Membership Requests</h2>
                <p className="text-xs text-yellow-600 dark:text-yellow-400/85">{stats.pendingUsers} {stats.pendingUsers === 1 ? 'person is' : 'people are'} waiting for your approval.</p>
              </div>
            </div>
            <Link to="/admin" className="text-xs font-bold text-yellow-700 dark:text-yellow-400 hover:underline flex items-center gap-1 group">
              View All <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
          <div className="p-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {pendingList.slice(0, 3).map(user => (
              <Link 
                key={user.uid} 
                to={`/admin?uid=${user.uid}`}
                className="bg-white dark:bg-[#1e1e1a] hover:bg-[#5A5A40]/5 dark:hover:bg-[#8a8a65]/5 transition-all p-4 rounded-2xl flex items-center justify-between border border-yellow-101/50 dark:border-yellow-500/10 cursor-pointer block"
              >
                <div className="flex items-center gap-3">
                  <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full border border-gray-100 dark:border-white/5" referrerPolicy="no-referrer" />
                  <div>
                    <div className="text-sm font-bold truncate max-w-[120px] text-gray-900 dark:text-[#f5f5f0]">{user.displayName}</div>
                    <div className="text-[10px] text-gray-400 dark:text-gray-550 truncate max-w-[120px]">{user.email}</div>
                  </div>
                </div>
                <div className="p-2 text-[#5A5A40] dark:text-[#8a8a65] hover:bg-gray-100 dark:hover:bg-[#252520] rounded-lg transition-colors">
                  <UserCheck size={18} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.filter(s => !s.hidden).map((stat, i) => (
          <Link
            key={stat.label}
            to={stat.path}
            className="block"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white dark:bg-[#1e1e1a] p-6 rounded-[24px] shadow-sm border border-gray-100 dark:border-white/5 flex items-start gap-4 hover:border-[#5A5A40] hover:shadow-md transition-all h-full"
            >
              <div className="p-3 rounded-2xl bg-gray-50 dark:bg-[#252520]">
                <stat.icon className="w-6 h-6 text-[#5A5A40]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900 dark:text-[#f5f5f0]">{stat.value}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">{stat.label}</div>
              </div>
            </motion.div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white dark:bg-[#1e1e1a] p-8 rounded-[32px] border border-gray-100 dark:border-white/5 shadow-sm">
            <h2 className="text-xl font-serif mb-6 flex items-center gap-2 text-gray-900 dark:text-white">
              <span className="w-2 h-8 bg-[#5A5A40] rounded-full"></span>
              Recent Announcements
            </h2>
            <div className="space-y-4">
              {announcements.length === 0 ? (
                <div className="text-center py-8 text-gray-400 dark:text-gray-500 italic text-sm">No recent announcements.</div>
              ) : announcements.map(announcement => (
                <Link key={announcement.id} to="/announcements" className="block p-4 bg-gray-50 dark:bg-[#252520] rounded-2xl hover:bg-gray-100 dark:hover:bg-[#2c2c25] transition-all border-l-4 border-[#5A5A40]">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-sm text-gray-900 dark:text-white">{announcement.title}</h3>
                    <span className="text-[9px] text-gray-400 dark:text-gray-500 uppercase font-bold whitespace-nowrap ml-2">
                       {announcement.publishedAt ? format((announcement.publishedAt as any).toDate(), 'MMM d') : ''}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{announcement.content}</p>
                </Link>
              ))}
              {announcements.length > 0 && (
                <Link to="/announcements" className="text-xs font-bold text-[#5A5A40] dark:text-[#8a8a65] hover:underline flex items-center justify-center gap-1 mt-4">
                  View All Announcements <ArrowRight size={14} />
                </Link>
              )}
            </div>
          </section>

          <section className="bg-white dark:bg-[#1e1e1a] p-8 rounded-[32px] border border-gray-100 dark:border-white/5 shadow-sm">
            <h2 className="text-xl font-serif mb-6 flex items-center gap-2 text-gray-900 dark:text-white">
              <span className="w-2 h-8 bg-[#5A5A40] rounded-full"></span>
              My Upcoming Assignments
            </h2>
            <div className="space-y-4">
              {upcomingAssignments.length === 0 ? (
                <div className="text-center py-12 text-gray-400 dark:text-gray-500 italic font-serif">
                  No upcoming assignments found.
                </div>
              ) : (
                upcomingAssignments.map((assignment, i) => (
                  <div key={i} className="flex flex-col md:flex-row md:items-center justify-between p-6 bg-gray-50 dark:bg-[#252520] rounded-2xl border-l-4 border-[#5A5A40] gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white dark:bg-[#1e1e1a] rounded-2xl flex items-center justify-center text-[#5A5A40] dark:text-[#f5f5f0] shadow-sm font-bold text-center leading-none">
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase">{format(new Date(assignment.date), 'MMM')}</span>
                          <span className="text-lg">{format(new Date(assignment.date), 'dd')}</span>
                        </div>
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">{assignment.type}</h3>
                        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-widest">{assignment.slot || 'Regular Assignment'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-medium text-gray-400 dark:text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <CalendarRange size={14} />
                        {format(new Date(assignment.date), 'EEEE, MMMM dd')}
                      </div>
                      <Link 
                        to={assignment.tab === 'liturgical' 
                          ? `/duties?tab=liturgical&pollId=${assignment.id}` 
                          : `/duties?tab=core&pollId=${assignment.id}`} 
                        className="text-[#5A5A40] dark:text-[#8a8a65] font-bold hover:underline"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="bg-white dark:bg-[#1e1e1a] p-8 rounded-[32px] border border-gray-100 dark:border-white/5 shadow-sm">
            <h2 className="text-xl font-serif mb-6 flex items-center gap-2 text-gray-900 dark:text-white">
              <span className="w-2 h-8 bg-[#5A5A40] rounded-full"></span>
              Committee Summary
            </h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Liturgical Committee</h3>
                <div className="space-y-3">
                  {liturgicalCommittees.map(m => (
                    <div key={m} className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600 dark:text-[#f5f5f0]">{MINISTRY_LABELS[m as MinistryType]}</span>
                      <div className="flex items-center gap-2 flex-1 justify-end">
                        <div className="w-24 h-1.5 bg-gray-50 dark:bg-[#252520] rounded-full overflow-hidden">
                          <div 
                            className="bg-blue-400 h-full transition-all duration-1000" 
                            style={{ width: `${Math.min(100, ((committeeCounts[m] || 0) / stats.members) * 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 min-w-[20px] text-right">{committeeCounts[m] || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3">Chore Committee</h3>
                <div className="space-y-3">
                  {choreCommittees.map(m => (
                    <div key={m} className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600 dark:text-[#f5f5f0]">{MINISTRY_LABELS[m as MinistryType]}</span>
                      <div className="flex items-center gap-2 flex-1 justify-end">
                        <div className="w-24 h-1.5 bg-gray-50 dark:bg-[#252520] rounded-full overflow-hidden">
                          <div 
                            className="bg-orange-400 h-full transition-all duration-1000" 
                            style={{ width: `${Math.min(100, ((committeeCounts[m] || 0) / stats.members) * 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 min-w-[20px] text-right">{committeeCounts[m] || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
