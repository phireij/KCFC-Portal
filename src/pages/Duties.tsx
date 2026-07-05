import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../App';

import { collection, query, getDocs, orderBy, deleteDoc, doc, where, limit, addDoc, serverTimestamp, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DutyAssignment, UserProfile, Poll, PollResponse } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, Plus, Users, Sparkles, Calendar, BookOpen, ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertCircle, ThumbsUp, Check, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { CommitteeAssignments } from '../components/CommitteeAssignments';
import ChoreCommitteeDashboard from '../components/ChoreCommitteeDashboard';

import { autoAssignDuties } from '../services/dutyService';

export default function Duties() {
  const { profile, user } = useAuth();
  const [searchParams] = useSearchParams();
  const [duties, setDuties] = useState<DutyAssignment[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [activeTab, setActiveTab] = useState<'core' | 'liturgical'>((searchParams.get('tab') as any) === 'core' ? 'core' : 'liturgical');
  
  // Committee polls state
  const [committeePolls, setCommitteePolls] = useState<Poll[]>([]);
  const [chorePolls, setChorePolls] = useState<Poll[]>([]);
  const [pollResponses, setPollResponses] = useState<Record<string, PollResponse[]>>({});
  const [expandedPolls, setExpandedPolls] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (searchParams.get('tab') === 'liturgical') {
      setActiveTab('liturgical');
      const pollId = searchParams.get('pollId');
      if (pollId) {
        setExpandedPolls(prev => ({ ...prev, [pollId]: true }));
        setTimeout(() => {
          const el = document.getElementById(`assignment-${pollId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            el.classList.add('ring-2', 'ring-blue-500', 'ring-offset-8', 'rounded-[32px]');
            setTimeout(() => el.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-8'), 3000);
          }
        }, 800);
      }
    }
  }, [searchParams]);

  const [showManualForm, setShowManualForm] = useState(false);
  const [manualDuty, setManualDuty] = useState({
    userId: '',
    type: 'kitchen' as any,
    date: new Date().toISOString().split('T')[0],
    slot: ''
  });

  const isAdmin = (profile?.roles || []).some(r => ['admin', 'president', 'vice_president', 'secretary', 'auditor', 'choir_a_leader', 'choir_b_leader', 'lector_commentator_leader', 'usher_leader', 'altar_server_leader', 'kitchen_leader', 'kitchen_sub_leader', 'cleaning_leader', 'cleaning_sub_leader'].includes(r));

  const fetchDuties = async () => {
    try {
      const q = query(collection(db, 'duties'), orderBy('date', 'desc'));
      const snap = await getDocs(q);
      setDuties(snap.docs.map(d => ({ id: d.id, ...d.data() } as DutyAssignment)));
    } catch (err) {
      console.error("Failed to fetch duties", err);
    } finally {
      setLoading(false);
    }
  };

  const [submittingReasonId, setSubmittingReasonId] = useState<string | null>(null);
  const [notDoneReason, setNotDoneReason] = useState('');
  const [editingDutyIds, setEditingDutyIds] = useState<string[]>([]);
  const [leaderRemarksMap, setLeaderRemarksMap] = useState<Record<string, string>>({});

  const handleRecordDutyStatus = async (dutyId: string, status: 'done' | 'not_done', reasonStr = '') => {
    try {
      await updateDoc(doc(db, 'duties', dutyId), {
        completed: status,
        reason: reasonStr,
        updatedAt: new Date().toISOString()
      });
      setDuties(prev => prev.map(d => d.id === dutyId ? { ...d, completed: status, reason: reasonStr } : d));
      setSubmittingReasonId(null);
      setNotDoneReason('');
      setEditingDutyIds(prev => prev.filter(id => id !== dutyId));
    } catch (err) {
      console.error("Failed to update duty status", err);
      alert("Error updating duty status: " + (err as Error).message);
    }
  };

  const handleLeaderApprove = async (dutyId: string, remarksArg = '') => {
    if (!profile) return;
    try {
      await updateDoc(doc(db, 'duties', dutyId), {
        approvedByLeader: true,
        leaderApprovedBy: profile.displayName || 'Leader',
        leaderApprovedAt: new Date().toISOString(),
        leaderRemarks: remarksArg
      });
      setDuties(prev => prev.map(d => d.id === dutyId ? { 
        ...d, 
        approvedByLeader: true, 
        leaderApprovedBy: profile.displayName || 'Leader', 
        leaderApprovedAt: new Date().toISOString(),
        leaderRemarks: remarksArg 
      } : d));
    } catch (err) {
      console.error("Failed to approve duty", err);
      alert("Error approving duty: " + (err as Error).message);
    }
  };

  const canApproveDuty = (dutyType: 'cleaning' | 'kitchen' | 'ministry') => {
    if (!profile) return false;
    const userRoles = profile.roles || [];
    if (userRoles.some(r => ['admin', 'president'].includes(r))) return true;
    if (dutyType === 'kitchen' && userRoles.some(r => ['kitchen_leader', 'kitchen_sub_leader'].includes(r))) return true;
    if (dutyType === 'cleaning' && userRoles.some(r => ['cleaning_leader', 'cleaning_sub_leader'].includes(r))) return true;
    return false;
  };

  useEffect(() => {
    fetchDuties();
    
    // Listen to users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)).filter(u => u.email !== 'kcfc.jp@gmail.com'));
    }, (err) => {
      console.error("Error listening to users in Duties page:", err);
    });

    // Listen to committee and attendance polls
    const pollsQ = query(
      collection(db, 'polls'), 
      where('category', 'in', ['committee', 'core_member']),
      orderBy('createdAt', 'desc')
    );
    
    const unsubPolls = onSnapshot(pollsQ, async (snap) => {
      const polls = snap.docs.map(d => ({ id: d.id, ...d.data() } as Poll));
      setCommitteePolls(polls.filter(p => p.category === 'committee'));
      setChorePolls(polls.filter(p => p.category === 'core_member'));
      
      const responses: Record<string, PollResponse[]> = {};
      for (const poll of polls) {
        const respSnap = await getDocs(query(collection(db, `polls/${poll.id}/responses`)));
        responses[poll.id] = respSnap.docs.map(d => ({ id: d.id, ...d.data() } as PollResponse));
      }
      setPollResponses(responses);
    }, (err) => {
      console.error("Error listening to polls in Duties page:", err);
    });

    return () => {
      unsubUsers();
      unsubPolls();
    };
  }, []);

  const handleManualAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !user || !profile) return;
    
    const targetUser = users.find(u => u.uid === manualDuty.userId);
    if (!targetUser) return;

    try {
      const assignment: Omit<DutyAssignment, 'id'> = {
        userId: manualDuty.userId,
        userDisplayName: targetUser.displayName,
        type: manualDuty.type,
        date: new Date(manualDuty.date).toISOString(),
        slot: manualDuty.slot,
        assignedBy: profile.displayName,
        assignedAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'duties'), {
        ...assignment,
        assignedAt: serverTimestamp()
      });

      setDuties(prev => [{ id: docRef.id, ...assignment }, ...prev]);
      
      // Create notification for the assigned user
      try {
        await addDoc(collection(db, 'notifications'), {
          userId: manualDuty.userId,
          title: 'New Duty Assignment',
          message: `You have been assigned to ${manualDuty.type} duty on ${format(new Date(manualDuty.date), 'MMM dd')}.`,
          type: 'duty',
          status: 'unread',
          link: '/duties',
          createdAt: serverTimestamp()
        });
      } catch (err) {
        console.error("Failed to create notification", err);
      }

      setShowManualForm(false);
      setManualDuty({ userId: '', type: 'kitchen', date: new Date().toISOString().split('T')[0], slot: '' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleAutoAssign = async () => {
    if (!isAdmin) return;
    setAssigning(true);
    try {
      // Find the most recent active poll
      const pollsQ = query(collection(db, 'polls'), where('status', '==', 'active'), limit(1));
      const pollsSnap = await getDocs(pollsQ);
      if (pollsSnap.empty) {
        alert("No active polls found to assign from.");
        return;
      }
      const poll = pollsSnap.docs[0];
      const pollData = poll.data();
      
      const result = await autoAssignDuties(poll.id, pollData.targetDate || new Date().toISOString());
      if (result.success) {
        alert("Duties assigned successfully!");
        fetchDuties();
      } else {
        alert(result.message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAssigning(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin || !confirm("Delete this assignment?")) return;
    try {
      await deleteDoc(doc(db, 'duties', id));
      setDuties(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif text-gray-900 dark:text-white">Ministry Assignments</h1>
          <p className="text-gray-500 dark:text-gray-400 font-serif italic text-sm">Organizing kitchen, cleaning, and liturgical duties.</p>
        </div>
        {isAdmin && activeTab === 'core' && (
          <div className="flex gap-2">
            <button 
              onClick={() => setShowManualForm(!showManualForm)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                showManualForm ? "bg-gray-200 text-gray-700" : "bg-[#5A5A40] text-white hover:bg-[#4a4a35]"
              )}
            >
              <Plus size={18} />
              {showManualForm ? 'Cancel' : 'Assign Manually'}
            </button>
            {!showManualForm && (
              <button 
                onClick={handleAutoAssign}
                disabled={assigning}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-full text-sm font-medium disabled:opacity-50 hover:bg-purple-700 transition-all shadow-sm"
              >
                <Sparkles size={18} />
                {assigning ? 'Assigning...' : 'Auto-Assign Next'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-white/50 dark:bg-[#1e1e1a]/50 p-1.5 rounded-[2rem] border border-gray-100 dark:border-white/5 w-fit">
        <button
          onClick={() => setActiveTab('liturgical')}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-all",
            activeTab === 'liturgical' 
              ? "bg-blue-600 dark:bg-blue-500 text-white shadow-lg" 
              : "text-gray-400 dark:text-gray-500 hover:bg-white dark:hover:bg-[#252520]"
          )}
        >
          <BookOpen size={16} />
          Liturgical Ministry Assignment & Scheduling
        </button>
        <button
          onClick={() => setActiveTab('core')}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-all",
            activeTab === 'core' 
              ? "bg-[#5A5A40] dark:bg-[#8a8a65] text-white dark:text-[#11110f] shadow-lg" 
              : "text-gray-400 dark:text-gray-500 hover:bg-white dark:hover:bg-[#252520]"
          )}
        >
          <Users size={16} />
          Chore Assignment
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'core' ? (
          <motion.div
            key="core-tab"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-12"
          >
            {/* 📋 MY CHORE DUTIES TRACKING SECTIONS */}
            {(() => {
              const myChoreAssignments = duties.filter(d => d.userId === user?.uid && (d.type === 'kitchen' || d.type === 'cleaning'));
              if (myChoreAssignments.length === 0) return null;

              return (
                <div className="bg-gradient-to-br from-[#5A5A40]/10 dark:from-[#5A5A40]/5 via-white dark:via-[#1e1e1a] to-orange-50/5 dark:to-[#1e1e1a] p-6 rounded-[2.5rem] border border-[#5A5A40]/10 dark:border-white/5 shadow-sm space-y-4 font-sans">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800 dark:text-[#f5f5f0] flex items-center gap-2">
                      <CheckCircle2 className="text-[#5A5A40] dark:text-[#8a8a65] w-5 h-5" />
                      My Assigned Chore Duties Tracking
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Record your work state or provide reasons if you was unable to execute the chore.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {myChoreAssignments.map(duty => {
                      const isSubmittingReason = submittingReasonId === duty.id;

                      return (
                        <div key={duty.id} className="p-5 bg-white dark:bg-[#141411] rounded-3xl border border-gray-100/80 dark:border-white/5 shadow-xs space-y-3">
                          <div className="flex items-center justify-between">
                            <span className={cn(
                              "px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                              duty.type === 'kitchen' ? "bg-orange-50 text-orange-600" : "bg-blue-50 text-blue-600"
                            )}>
                              {duty.type === 'kitchen' ? '🍳 Kitchen Committee' : '🧹 Cleaning Committee'}
                            </span>
                            <span className="text-[10px] text-gray-400 font-bold">{duty.date ? format(new Date(duty.date), 'MMM dd, yyyy') : ''}</span>
                          </div>

                          <div>
                            <h4 className="font-bold text-gray-800 dark:text-white">{duty.slot}</h4>
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">Assigned by {duty.assignedBy}</p>
                          </div>

                          {/* Recording controls */}
                          {(!duty.completed || (duty.id && editingDutyIds.includes(duty.id))) ? (
                            <div className="pt-2">
                              {!isSubmittingReason ? (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => duty.id && handleRecordDutyStatus(duty.id, 'done')}
                                      className="flex-1 py-2 px-3 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                      <Check size={14} /> I Did My Job
                                    </button>
                                    <button
                                      onClick={() => duty.id && setSubmittingReasonId(duty.id)}
                                      className="flex-1 py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                      <XCircle size={14} /> I Could Not Do It
                                    </button>
                                  </div>
                                  {duty.id && editingDutyIds.includes(duty.id) && (
                                    <button
                                      type="button"
                                      onClick={() => duty.id && setEditingDutyIds(prev => prev.filter(id => id !== duty.id))}
                                      className="w-full py-1 text-center text-gray-400 hover:text-gray-600 font-bold text-[10px] uppercase tracking-wider"
                                    >
                                      Keep Original Selection
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <label className="text-[10px] uppercase font-bold text-gray-400 block">Reason for non-completion</label>
                                  <textarea
                                    required
                                    placeholder="e.g., sudden sickness, family emergency..."
                                    value={notDoneReason}
                                    onChange={e => setNotDoneReason(e.target.value)}
                                    className="w-full p-2.5 bg-gray-50 dark:bg-[#252520] border border-gray-100 dark:border-white/5 text-gray-900 dark:text-white rounded-xl text-xs focus:ring-1 focus:ring-red-500 outline-none"
                                    rows={2}
                                  />
                                  <div className="flex justify-end gap-2 text-[10px] font-bold">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSubmittingReasonId(null);
                                        setNotDoneReason('');
                                      }}
                                      className="px-3 py-1.5 text-gray-400 hover:text-gray-600"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      disabled={!notDoneReason.trim()}
                                      onClick={() => duty.id && handleRecordDutyStatus(duty.id, 'not_done', notDoneReason)}
                                      className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 transition-all cursor-pointer"
                                    >
                                      Submit Reason
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="pt-2 border-t border-gray-50 space-y-1.5">
                              <div className="flex items-center justify-between gap-1.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {duty.completed === 'done' ? (
                                    <span className="text-xs text-green-600 font-bold flex items-center gap-1">
                                      <CheckCircle2 size={14} /> Recorded: Done
                                    </span>
                                  ) : (
                                    <span className="text-xs text-red-600 font-bold flex items-center gap-1">
                                      <XCircle size={14} /> Recorded: Not Done
                                    </span>
                                  )}
                                  {!duty.approvedByLeader ? (
                                    <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full font-bold">
                                      Waiting sub/leader approval
                                    </span>
                                  ) : (
                                    <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                                      <Check size={10} /> Verified by {duty.leaderApprovedBy}
                                    </span>
                                  )}
                                </div>

                                {!duty.approvedByLeader && duty.id && (
                                  <button
                                    onClick={() => duty.id && setEditingDutyIds(prev => [...prev, duty.id!])}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 hover:text-amber-800 rounded-lg text-[10px] font-bold transition-all cursor-pointer border border-amber-500/20"
                                    title="Modify your reported status"
                                  >
                                    <Edit2 size={10} /> Edit Report
                                  </button>
                                )}
                              </div>
                              {duty.reason && (
                                <p className="text-xs text-gray-500 bg-red-50/40 p-2.5 rounded-xl border border-red-100/30">
                                  <span className="font-bold text-[10px] uppercase block tracking-wider text-red-500 mb-0.5 font-sans">Reported reason:</span>
                                  "{duty.reason}"
                                </p>
                              )}
                              {duty.leaderRemarks && (
                                <p className="text-xs text-gray-500 bg-green-50/40 p-2.5 rounded-xl border border-green-100/30">
                                  <span className="font-bold text-[10px] uppercase block tracking-wider text-green-600 mb-0.5 font-sans">Leader Remarks:</span>
                                  "{duty.leaderRemarks}"
                                </p>
                              )}
                              {duty.approvedByLeader && duty.leaderApprovedAt && (
                                <p className="text-[10px] text-gray-400 italic">
                                  Approved by leader on {format(new Date(duty.leaderApprovedAt), 'MMM dd, yyyy HH:mm')}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* 📋 CHORE COMMITTEE LEADERS APPROVAL QUEUE */}
            {(() => {
              const isCommitteeLeader = (profile?.roles || []).some(r => ['admin', 'president', 'kitchen_leader', 'kitchen_sub_leader', 'cleaning_leader', 'cleaning_sub_leader'].includes(r));
              if (!isCommitteeLeader) return null;

              // Filter duties matching the leader's purview (allow edit even if confirmed already)
              const relevantChoreDuties = duties
                .filter(d => 
                  (d.type === 'kitchen' || d.type === 'cleaning') &&
                  d.completed && 
                  canApproveDuty(d.type)
                )
                .sort((a, b) => {
                  const aApproved = a.approvedByLeader ? 1 : 0;
                  const bApproved = b.approvedByLeader ? 1 : 0;
                  if (aApproved !== bApproved) {
                    return aApproved - bApproved;
                  }
                  return new Date(b.date).getTime() - new Date(a.date).getTime();
                });

              if (relevantChoreDuties.length === 0) return null;

              return (
                <div className="bg-gradient-to-br from-amber-50/10 dark:from-amber-955/5 via-white dark:via-[#1e1e1a] to-amber-50/5 dark:to-[#1e1e1a] p-6 rounded-[2.5rem] border border-amber-200/50 dark:border-white/5 shadow-xs space-y-4 font-sans border-dashed">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800 dark:text-[#f5f5f0] flex items-center gap-2">
                      <ThumbsUp className="text-amber-600 dark:text-amber-400 w-5 h-5 animate-bounce" />
                      Chore Approvals Queue ({relevantChoreDuties.filter(d => !d.approvedByLeader).length} Pending / {relevantChoreDuties.length} Total)
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">As a leader, review, confirm and write notes for reported chore status declarations. You can update confirmed records anytime.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {relevantChoreDuties.map(duty => {
                      const remarksVal = leaderRemarksMap[duty.id!] !== undefined 
                        ? leaderRemarksMap[duty.id!] 
                        : (duty.leaderRemarks || '');

                      return (
                        <div key={duty.id} className={cn(
                          "p-4 bg-white dark:bg-[#141411] rounded-2xl border shadow-3xs space-y-3 transition-all",
                          duty.approvedByLeader ? "border-green-100 dark:border-green-500/20 bg-green-50/5 dark:bg-green-950/10" : "border-amber-100 dark:border-amber-500/20"
                        )}>
                          <div className="flex items-center justify-between">
                            <span className={cn(
                              "px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                              duty.type === 'kitchen' ? "bg-orange-50 text-orange-600" : "bg-blue-50 text-blue-600"
                            )}>
                              {duty.type === 'kitchen' ? '🍳 Kitchen' : '🧹 Cleaning'}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {duty.approvedByLeader && (
                                <span className="text-[8px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                  Confirmed
                                </span>
                              )}
                              <span className="text-[10px] text-gray-400 font-bold">{duty.date ? format(new Date(duty.date), 'MMM dd') : ''}</span>
                            </div>
                          </div>

                          <div>
                            <span className="text-[10px] uppercase font-bold text-gray-400 block">Volunteer member</span>
                            <h4 className="font-bold text-gray-800 text-sm">{duty.userDisplayName}</h4>
                            <p className="text-xs font-medium text-gray-600 mt-1">Chore: <span className="font-bold text-[#5A5A40]">{duty.slot}</span></p>
                          </div>

                          <div className="p-2.5 rounded-xl border flex flex-col gap-1.5 shadow-3xs bg-gray-50/50">
                            <div className="flex items-center gap-1.5">
                              {duty.completed === 'done' ? (
                                <span className="text-xs text-green-600 font-bold flex items-center gap-1">
                                  <CheckCircle2 size={13} /> Reported: Done
                                </span>
                              ) : (
                                <span className="text-xs text-red-600 font-bold flex items-center gap-1">
                                  <XCircle size={13} /> Reported: Not Done
                                </span>
                              )}
                            </div>
                            {duty.reason && (
                              <p className="text-xs text-gray-500 italic">
                                Reason: "{duty.reason}"
                              </p>
                            )}
                          </div>

                          {/* Leader Remarks Field */}
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-gray-400 block">Leader Remarks</label>
                            <textarea
                              rows={2}
                              placeholder="Optional notes or feedback..."
                              value={remarksVal}
                              onChange={e => setLeaderRemarksMap(prev => ({ ...prev, [duty.id!]: e.target.value }))}
                              className="w-full px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:ring-1 focus:ring-amber-500 outline-none resize-none font-medium text-gray-700"
                            />
                          </div>

                          <button
                            onClick={() => duty.id && handleLeaderApprove(duty.id, remarksVal)}
                            className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer"
                          >
                            <Check size={14} /> 
                            {duty.approvedByLeader ? "Update Confirmed Records" : "Confirmed & Log Completed"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Chore/Attendance Polls */}
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-400 uppercase tracking-[0.2em] ml-2">Attendance Polls (Chore)</h2>
              {chorePolls.length === 0 ? (
                 <div className="bg-white/50 dark:bg-[#1e1e1a]/50 p-8 rounded-[32px] border border-dashed border-gray-200 dark:border-white/10 text-center">
                    <p className="text-gray-400 dark:text-gray-500 font-serif italic text-sm">No chore polls found.</p>
                 </div>
              ) : (
                chorePolls.map(poll => (
                  <div key={poll.id} className="bg-white dark:bg-[#1e1e1a] rounded-[32px] border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
                    <button 
                      onClick={() => setExpandedPolls(prev => ({ ...prev, [poll.id]: !prev[poll.id] }))}
                      className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-[#252520] transition-all text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-orange-50 dark:bg-orange-950/20 rounded-2xl flex items-center justify-center text-orange-600 dark:text-orange-400">
                           <Calendar size={20} />
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-900 dark:text-white">{poll.title}</h3>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-widest">
                            {format(new Date(poll.startDate), 'MMM dd')} - {format(new Date(poll.endDate), 'MMM dd')}
                          </p>
                        </div>
                      </div>
                      {expandedPolls[poll.id] ? <ChevronDown size={20} className="text-gray-400 dark:text-gray-500" /> : <ChevronRight size={20} className="text-gray-400 dark:text-gray-500" />}
                    </button>
                    
                    {expandedPolls[poll.id] && (
                      <div className="p-6 pt-0 border-t border-gray-50 dark:border-white/5">
                        <ChoreCommitteeDashboard 
                          poll={poll} 
                          pollResponses={pollResponses[poll.id] || []} 
                          profile={profile} 
                          users={users} 
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-400 uppercase tracking-[0.2em] ml-2">Completed Assignments</h2>
              {showManualForm && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-[#1e1e1a] p-8 rounded-[32px] border border-gray-100 dark:border-white/5 shadow-lg space-y-6"
                >
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Manual Duty Assignment</h2>
                  <form onSubmit={handleManualAssign} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 ml-2">Member</label>
                      <select
                        required
                        value={manualDuty.userId}
                        onChange={e => setManualDuty({...manualDuty, userId: e.target.value})}
                        className="px-4 py-3 bg-gray-50 dark:bg-[#252520] text-gray-900 dark:text-white rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] outline-none"
                      >
                        <option value="" className="bg-white dark:bg-[#1e1e1a]">Select Member</option>
                        {users.map(u => (
                          <option key={u.uid} value={u.uid} className="bg-white dark:bg-[#1e1e1a]">{u.displayName}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 ml-2">Duty Type</label>
                      <select
                        value={manualDuty.type}
                        onChange={e => setManualDuty({...manualDuty, type: e.target.value as any})}
                        className="px-4 py-3 bg-gray-50 dark:bg-[#252520] text-gray-900 dark:text-white rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] outline-none"
                      >
                        <option value="kitchen" className="bg-white dark:bg-[#1e1e1a]">Kitchen</option>
                        <option value="cleaning" className="bg-white dark:bg-[#1e1e1a]">Cleaning</option>
                        <option value="ministry" className="bg-white dark:bg-[#1e1e1a]">Ministry</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 ml-2">Date</label>
                      <input
                        type="date"
                        required
                        value={manualDuty.date}
                        onChange={e => setManualDuty({...manualDuty, date: e.target.value})}
                        className="px-4 py-3 bg-gray-50 dark:bg-[#252520] text-gray-900 dark:text-white rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-gray-400 dark:text-gray-500 ml-2">Slot/Role</label>
                      <input
                        placeholder="Morning, Main Hall, etc."
                        value={manualDuty.slot}
                        onChange={e => setManualDuty({...manualDuty, slot: e.target.value})}
                        className="px-4 py-3 bg-gray-50 dark:bg-[#252520] text-gray-900 dark:text-white rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] outline-none"
                      />
                    </div>
                    <button 
                      type="submit"
                      className="lg:col-span-full px-6 py-3 bg-[#5A5A40] dark:bg-[#8a8a65] text-white dark:text-[#11110f] rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-[#4a4a35] dark:hover:bg-[#a5a575] transition-all"
                    >
                      Confirm Assignment
                    </button>
                  </form>
                </motion.div>
              )}

              <div className="bg-white dark:bg-[#1e1e1a] rounded-[32px] overflow-hidden shadow-sm border border-gray-100 dark:border-white/5">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-[#252520] border-b border-gray-100 dark:border-white/5">
                        <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-gray-550">Date</th>
                        <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-gray-550">Member</th>
                        <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-gray-550">Duty Type</th>
                        <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-gray-550">Slot/Role</th>
                        <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-gray-550">Status</th>
                        <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-gray-550">Verified By</th>
                        <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-gray-550">Assigned By</th>
                        {isAdmin && <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-gray-550 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                       {loading ? (
                        <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-400 dark:text-gray-500">Loading assignments...</td></tr>
                      ) : duties.length === 0 ? (
                        <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-400 dark:text-gray-500 italic font-serif">No duties assigned yet.</td></tr>
                      ) : (
                        duties.map((duty) => (
                          <tr key={duty.id} className="hover:bg-gray-50/50 dark:hover:bg-[#252520]/20 transition-colors">
                            <td className="px-6 py-4 font-medium text-sm text-gray-900 dark:text-[#f5f5f0]">
                              {format(new Date(duty.date), 'MMM dd, yyyy')}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center font-bold text-xs uppercase text-gray-500 dark:text-gray-300">
                                  {duty.userDisplayName.charAt(0)}
                                </div>
                                <span className="text-sm font-bold text-gray-900 dark:text-[#f5f5f0]">{duty.userDisplayName}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                duty.type === 'kitchen' ? "bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400" :
                                duty.type === 'cleaning' ? "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400" :
                                "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400"
                              )}>
                                {duty.type}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400 font-medium">
                              {duty.slot || '-'}
                            </td>
                            <td className="px-6 py-4">
                              {duty.completed ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded text-[10px] font-bold w-fit uppercase tracking-wider leading-none",
                                    duty.completed === 'done' ? "bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-400" : "bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-400"
                                  )}>
                                    {duty.completed === 'done' ? 'Done' : 'Not Done'}
                                  </span>
                                  {duty.reason && (
                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 italic block max-w-[12rem] truncate" title={duty.reason}>
                                      "{duty.reason}"
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-300 dark:text-gray-600 italic">No record</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400 font-mono">
                              {duty.approvedByLeader ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-green-600 dark:text-green-400 font-bold flex items-center gap-0.5" title={`Approved at ${duty.leaderApprovedAt}`}>
                                    <Check size={12} /> {duty.leaderApprovedBy}
                                  </span>
                                  {duty.leaderRemarks && (
                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 italic block max-w-[12rem] truncate" title={duty.leaderRemarks}>
                                      "{duty.leaderRemarks}"
                                    </span>
                                  )}
                                </div>
                              ) : duty.completed ? (
                                <span className="text-amber-500 dark:text-amber-400 font-bold italic text-[11px]">Pending approval</span>
                              ) : (
                                <span className="text-gray-300 dark:text-gray-700">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-xs text-gray-400 dark:text-gray-500 italic">
                              {duty.assignedBy}
                            </td>
                            {isAdmin && (
                              <td className="px-6 py-4 text-right">
                                <button 
                                  onClick={() => duty.id && handleDelete(duty.id)}
                                  className="p-2 text-gray-300 dark:text-gray-600 hover:text-red-500 rounded-full transition-all cursor-pointer"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="liturgical-tab"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-12"
          >
            {committeePolls.length === 0 ? (
              <div className="bg-white dark:bg-[#1e1e1a] p-20 rounded-[32px] border border-dashed border-gray-200 dark:border-white/10 text-center">
                <Calendar className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-4" />
                <p className="text-gray-400 dark:text-gray-500 font-serif italic text-sm">No liturgical scheduling polls found.</p>
                <a href="/polls" className="text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-widest mt-4 inline-block hover:underline">
                  Create a Poll to Start Scheduling
                </a>
              </div>
            ) : (
              committeePolls.map(poll => (
                <div key={poll.id} id={`assignment-${poll.id}`} className="bg-white dark:bg-[#1e1e1a] rounded-[32px] border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
                   <button 
                    onClick={() => setExpandedPolls(prev => ({ ...prev, [poll.id]: !prev[poll.id] }))}
                    className="w-full border-l-4 border-blue-500 flex flex-col md:flex-row md:items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-[#252520] transition-all text-left gap-4"
                  >
                    <div>
                      <h2 className="text-xl font-serif font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        {poll.title}
                        {expandedPolls[poll.id] ? <ChevronDown size={18} className="text-gray-400 dark:text-gray-500" /> : <ChevronRight size={18} className="text-gray-400 dark:text-gray-500" />}
                      </h2>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-widest mt-1">
                        Original Poll: {format(new Date(poll.startDate), 'MMM dd')} - {format(new Date(poll.endDate), 'MMM dd')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                       <a 
                        href={`/polls?id=${poll.id}`} 
                        onClick={e => e.stopPropagation()}
                        className="px-4 py-2 bg-gray-50 dark:bg-[#252520] text-gray-500 dark:text-gray-400 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-gray-100 dark:hover:bg-[#2d2d25] transition-all border border-gray-100 dark:border-white/5"
                      >
                        View Original Poll
                      </a>
                    </div>
                  </button>
                  
                  {expandedPolls[poll.id] && (
                    <div className="p-6 pt-0 border-t border-gray-50 dark:border-white/5">
                      <CommitteeAssignments 
                        poll={poll} 
                        pollResponses={pollResponses[poll.id] || []} 
                        profile={profile} 
                        users={users} 
                      />
                    </div>
                  )}
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
