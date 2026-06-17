import React, { useState, useEffect, useRef } from 'react';
import { Poll, PollResponse, COMMITTEE_ROLES, ROLE_COLORS, UserProfile } from '../types';
import { doc, updateDoc, collection, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { format } from 'date-fns';
import { Check, ChevronDown, CheckSquare, Square, Loader2, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { sendGmail } from '../lib/gmail';

interface CommitteeAssignmentsProps {
  poll: Poll;
  pollResponses: PollResponse[];
  profile: UserProfile | null;
  users?: UserProfile[];
}

export function CommitteeAssignments({ poll, pollResponses, profile, users = [] }: CommitteeAssignmentsProps) {
  const [assigningCell, setAssigningCell] = useState<{ userId: string, date: string } | null>(null);
  const [shownUserInfo, setShownUserInfo] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [stagedAssignments, setStagedAssignments] = useState<Record<string, Record<string, string>>>({});
  const [isApplying, setIsApplying] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const userInfoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setAssigningCell(null);
      }
      if (userInfoRef.current && !userInfoRef.current.contains(event.target as Node)) {
        setShownUserInfo(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuRef, userInfoRef]);

  const completed = poll.completedAssignments || [];
  
  let currentPhase: 'lector' | 'altar_server' | 'usher' | 'ppt' | 'completed' = 'completed';
  if (!completed.includes('lector')) currentPhase = 'lector';
  else if (!completed.includes('altar_server')) currentPhase = 'altar_server';
  else if (!completed.includes('usher')) currentPhase = 'usher';
  else if (!completed.includes('ppt')) currentPhase = 'ppt';

  const userRoles = profile?.roles || [];
  const isAdminOrPresident = userRoles.includes('admin') || userRoles.includes('president');
  const isExecutive = isAdminOrPresident || userRoles.includes('vice_president') || userRoles.includes('secretary') || userRoles.includes('treasurer') || userRoles.includes('auditor') || userRoles.includes('pro');
  
  const canAssignLector = isAdminOrPresident || userRoles.includes('lector_commentator_leader');
  const canAssignAltar = isAdminOrPresident || userRoles.includes('altar_server_leader');
  const canAssignUsher = isAdminOrPresident || userRoles.includes('usher_leader');
  const canAssignPPT = isExecutive;

  const canEditCurrentPhase = 
    (currentPhase === 'lector' && canAssignLector) ||
    (currentPhase === 'altar_server' && canAssignAltar) ||
    (currentPhase === 'usher' && canAssignUsher) ||
    (currentPhase === 'ppt' && canAssignPPT) ||
    (currentPhase === 'completed' && isAdminOrPresident) ||
    (currentPhase === 'completed' && (
      (canAssignLector) || 
      (canAssignAltar) || 
      (canAssignUsher)
    ));

  const assignments = poll.assignments || {};

  // Merge staged changes for local view
  const effectiveAssignments = JSON.parse(JSON.stringify(assignments));
  Object.entries(stagedAssignments).forEach(([date, userDrafts]) => {
    if (!effectiveAssignments[date]) effectiveAssignments[date] = {};
    Object.entries(userDrafts).forEach(([uid, role]) => {
      if (role === '') {
        delete effectiveAssignments[date][uid];
      } else {
        effectiveAssignments[date][uid] = role;
      }
    });
  });

  const hasStagedChanges = Object.keys(stagedAssignments).length > 0;

  // Detailed assignment counters per user
  const userStats = new Map<string, { total: number, lector: number, commentator: number, altar: number, usher: number, ppt: number }>();
  
  Object.entries(effectiveAssignments).forEach(([date, dateAssignments]: [string, any]) => {
    Object.entries(dateAssignments).forEach(([uid, role]: [string, any]) => {
      if (!userStats.has(uid)) {
        userStats.set(uid, { total: 0, lector: 0, commentator: 0, altar: 0, usher: 0, ppt: 0 });
      }
      const stats = userStats.get(uid)!;
      stats.total++;
      if (role === 'Commentator') stats.commentator++;
      else if (role.includes('Lector')) stats.lector++;
      else if (role.includes('Altar Server')) stats.altar++;
      else if (role.includes('Usher')) stats.usher++;
      else if (role === 'PPT') stats.ppt++;
    });
  });

  // Extract all unique users who responded to ANY option
  const respondersMap = new Map<string, { id: string, name: string }>();
  pollResponses.forEach(r => {
    if (r.selectedOptions && r.selectedOptions.length > 0) {
      if (r.userId && r.userDisplayName) {
        respondersMap.set(r.userId, { id: r.userId, name: r.userDisplayName });
      }
    }
  });

  // Exclude Admin from responders
  const adminProfiles = users.filter(u => u.email === 'kcfc.jp@gmail.com').map(u => u.uid);
  adminProfiles.forEach(adminId => respondersMap.delete(adminId));

  const responders = Array.from(respondersMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  const handleAssignRole = async (date: string, userId: string, role: string) => {
    // Duplicate check within the same mass
    if (role !== '') {
      const dateAssignments = effectiveAssignments[date] || {};
      const alreadyAssigned = Object.entries(dateAssignments).find(([uid, r]) => r === role && uid !== userId);
      if (alreadyAssigned) {
        const assignedUserName = responders.find(r => r.id === alreadyAssigned[0])?.name || 'Someone else';
        alert(`Duplicate Assignment Error: ${role} is already assigned to ${assignedUserName} for this mass.`);
        return;
      }
    }

    if (currentPhase === 'completed') {
      // Stage the change instead of real-time update
      setStagedAssignments(prev => {
        const next = { ...prev };
        if (!next[date]) next[date] = {};
        next[date][userId] = role;
        return next;
      });
      setAssigningCell(null);
      return;
    }

    const newAssignments = { ...assignments };
    if (!newAssignments[date]) newAssignments[date] = {};
    if (role === '') {
      delete newAssignments[date][userId];
    } else {
      newAssignments[date][userId] = role;
    }

    try {
      await updateDoc(doc(db, 'polls', poll.id), {
        assignments: newAssignments
      });
      setAssigningCell(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'polls');
    }
  };

  const handleCompletePhase = async () => {
    if (!canEditCurrentPhase) return;
    if (currentPhase === 'completed') return;

    // Validation
    const allDates = poll.massDates?.map(m => m.date) || [];
    for (const date of allDates) {
      const dateAssignments = Object.values(assignments[date] || {});
      
      if (currentPhase === 'lector') {
        const hasCommentator = dateAssignments.includes('Commentator');
        const hasLector1 = dateAssignments.includes('Lector 1');
        if (!hasCommentator || !hasLector1) {
          alert(`Mass on ${format(new Date(date), 'MMM dd')} is missing a Commentator or Lector 1.`);
          return;
        }
      }

      if (currentPhase === 'altar_server') {
        const hasAltarServer = dateAssignments.some(role => role.startsWith('Altar Server'));
        if (!hasAltarServer) {
          alert(`Mass on ${format(new Date(date), 'MMM dd')} must have at least 1 Altar Server.`);
          return;
        }
      }

      if (currentPhase === 'usher') {
        const hasUsher = dateAssignments.some(role => role.startsWith('Usher'));
        if (!hasUsher) {
          let availableUshersCount = 0;
          for (const user of responders) {
            const hasSelectedDate = pollResponses.some(r => r.userId === user.id && r.selectedOptions?.includes(date));
            const userProfile = users.find(u => u.uid === user.id);
            const isUsher = userProfile?.ministries?.includes('usher');
            const isNotAssigned = !assignments[date]?.[user.id];
            if (hasSelectedDate && isUsher && isNotAssigned) {
              availableUshersCount++;
            }
          }
          if (availableUshersCount > 0) {
            alert(`Mass on ${format(new Date(date), 'MMM dd')} has no Ushers assigned, but there are available members. Please assign at least 1 Usher.`);
            return;
          }
        }
      }
    }

    if (!confirm(`Mark ${currentPhase.replace('_', ' ')} assignments as completed?`)) return;

    setIsCompleting(true);
    const newCompleted = [...completed, currentPhase];
    
    try {
      await updateDoc(doc(db, 'polls', poll.id), {
        completedAssignments: newCompleted
      });

      if (newCompleted.includes('lector') && newCompleted.includes('altar_server') && newCompleted.includes('usher') && newCompleted.includes('ppt')) {
        // All assignments completed, send notifications to everyone assigned
        const usersSnap = await getDocs(collection(db, 'users'));
        const batch = writeBatch(db);
        
        const assignedUserIds = new Set<string>();
        Object.values(assignments).forEach(dateAssignments => {
          Object.keys(dateAssignments).forEach(uid => assignedUserIds.add(uid));
        });

        const usersToEmail: UserProfile[] = [];

        usersSnap.docs.forEach(userDoc => {
          if (assignedUserIds.has(userDoc.id)) {
            usersToEmail.push({ uid: userDoc.id, ...userDoc.data() } as UserProfile);
            const notificationRef = doc(collection(db, 'notifications'));
            batch.set(notificationRef, {
              userId: userDoc.id,
              title: `Assignment: ${poll.title}`,
              message: `You have new assignments for the upcoming masses. Please check the poll.`,
              type: 'system',
              status: 'unread',
              link: '/polls',
              createdAt: serverTimestamp()
            });
          }
        });
        await batch.commit();

        const clientId = (import.meta as any).env.VITE_CLIENT_ID;
        if (clientId && usersToEmail.length > 0) {
          const subject = `[KCFC] New Assignments: ${poll.title}`;
          const baseUrl = window.location.origin;
          const body = `
            <div style="font-family: serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 20px; overflow: hidden;">
              <div style="background-color: #00e5ff; color: #004d55; padding: 40px; text-align: center;">
                <h1 style="margin: 0; font-size: 24px; font-weight: normal;">Liturgical Assignments Published</h1>
              </div>
              <div style="padding: 40px; line-height: 1.6;">
                <p>Dear Committee Member,</p>
                <p>The liturgical assignments for "${poll.title}" have been finalized by all leaders.</p>
                <p style="text-align: center; margin: 40px 0;">
                  <a href="${baseUrl}/polls" style="background-color: #008b99; color: white; padding: 15px 30px; text-decoration: none; border-radius: 10px; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">
                    View My Assignments
                  </a>
                </p>
              </div>
            </div>
          `;
          let successCount = 0;
          for (const member of usersToEmail) {
            if (member.email) {
              try {
                await sendGmail(member.email, subject, body);
                successCount++;
              } catch (err) {
                console.error(`Failed to send email to ${member.email}`, err);
              }
            }
          }
          alert(`Assignments completed! Sent email to ${successCount} members.`);
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'polls');
    } finally {
      setIsCompleting(false);
    }
  };

  const applyStagedChanges = async () => {
    if (!hasStagedChanges) return;
    setIsApplying(true);
    try {
      await updateDoc(doc(db, 'polls', poll.id), {
        assignments: effectiveAssignments,
        updatedAt: serverTimestamp()
      });
      setStagedAssignments({});
      alert("Changes applied successfully!");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'polls');
    } finally {
      setIsApplying(false);
    }
  };

  const discardStagedChanges = () => {
    if (confirm("Discard all unpublished changes?")) {
      setStagedAssignments({});
    }
  };

  const getAvailableRolesForUser = (date: string, userId: string, requestedPhase: typeof currentPhase) => {
    if (requestedPhase === 'completed' && !canEditCurrentPhase) return [];
    
    // Check user's committee boundaries
    const userProfile = users.find(u => u.uid === userId);
    const ministries = userProfile?.ministries || [];
    const lcRoles = userProfile?.lcRoles || [];
    
    // Does the user have the required ministry?
    const hasLector = ministries.includes('lector_commentator');
    const hasAltar = ministries.includes('altar_server');
    const hasUsher = ministries.includes('usher');
    
    let allowedRolesForUser: string[] = [];

    if ((requestedPhase === 'lector' || requestedPhase === 'completed') && (hasLector || isAdminOrPresident)) {
      if (lcRoles.some(r => r.includes('Commentator'))) allowedRolesForUser.push('Commentator');
      if (lcRoles.some(r => r.includes('Lector'))) allowedRolesForUser.push('Lector 1', 'Lector 2');
    }
    
    if ((requestedPhase === 'altar_server' || requestedPhase === 'completed') && (hasAltar || isAdminOrPresident)) {
      allowedRolesForUser.push(...COMMITTEE_ROLES['altar_server']);
    }

    if ((requestedPhase === 'usher' || requestedPhase === 'completed') && (hasUsher || isAdminOrPresident)) {
      allowedRolesForUser.push(...COMMITTEE_ROLES['usher']);
    }

    if (requestedPhase === 'ppt' || requestedPhase === 'completed') {
      allowedRolesForUser.push(...COMMITTEE_ROLES['ppt']);
    }

    const dateAssignments = assignments[date] || {};
    const assignedRoles = Object.values(dateAssignments);
    
    return allowedRolesForUser.filter(r => !assignedRoles.includes(r) || dateAssignments[userId] === r);
  };

  return (
    <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 mt-8">
      <div className="p-6 bg-[#00e5ff]/20 border-b border-[#00e5ff]/30 text-center">
        <h3 className="uppercase tracking-widest font-bold text-[#008b99] text-sm">Liturgical Ministry Assignment & Scheduling</h3>
      </div>
      
      {/* Workflow Tracker */}
      <div className="px-6 py-4 flex flex-wrap gap-4 items-center justify-between bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
          <span className={cn(
            "px-3 py-1 rounded-full",
            completed.includes('lector') ? "bg-green-100 text-green-700" : currentPhase === 'lector' ? "bg-blue-100 text-blue-700 ring-2 ring-blue-500 ring-offset-2" : "bg-gray-200 text-gray-500"
          )}>
            1. Lector/Commentator
          </span>
          <span className="text-gray-400">→</span>
          <span className={cn(
            "px-3 py-1 rounded-full",
            completed.includes('altar_server') ? "bg-green-100 text-green-700" : currentPhase === 'altar_server' ? "bg-blue-100 text-blue-700 ring-2 ring-blue-500 ring-offset-2" : "bg-gray-200 text-gray-500"
          )}>
            2. Altar Server
          </span>
          <span className="text-gray-400">→</span>
          <span className={cn(
            "px-3 py-1 rounded-full",
            completed.includes('usher') ? "bg-green-100 text-green-700" : currentPhase === 'usher' ? "bg-blue-100 text-blue-700 ring-2 ring-blue-500 ring-offset-2" : "bg-gray-200 text-gray-500"
          )}>
            3. Usher
          </span>
          <span className="text-gray-400">→</span>
          <span className={cn(
            "px-3 py-1 rounded-full",
            completed.includes('ppt') ? "bg-green-100 text-green-700" : currentPhase === 'ppt' ? "bg-blue-100 text-blue-700 ring-2 ring-blue-500 ring-offset-2" : "bg-gray-200 text-gray-500"
          )}>
            4. PPT
          </span>
        </div>

        {canEditCurrentPhase && currentPhase !== 'completed' && (
          <button
            onClick={handleCompletePhase}
            disabled={isCompleting}
            className="flex items-center gap-2 px-4 py-2 bg-[#5A5A40] text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-[#4a4a35] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCompleting ? <Loader2 size={14} className="animate-spin" /> : null}
            Mark {currentPhase === 'lector' ? 'Lector' : currentPhase === 'altar_server' ? 'Altar Server' : currentPhase === 'usher' ? 'Usher' : 'PPT'} Done
          </button>
        )}

        {hasStagedChanges && (
          <div className="flex items-center gap-2">
             <button
              onClick={discardStagedChanges}
              className="px-4 py-2 bg-gray-100 text-gray-500 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-gray-200 transition-all"
            >
              Discard Changes
            </button>
            <button
              onClick={applyStagedChanges}
              disabled={isApplying}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-green-700 transition-all shadow-md"
            >
              {isApplying ? <Loader2 size={14} className="animate-spin" /> : null}
              Apply Changes
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-max">
          <thead>
            <tr>
              <th className="p-4 border-b border-r border-[#00e5ff]/20 bg-[#00e5ff]/10 text-xs font-bold text-center">NAME</th>
              {(poll.massDates || []).map(option => {
                let availableCount = 0;
                if (currentPhase !== 'completed') {
                  for (const r of responders) {
                    const hasSelectedDate = pollResponses.some(resp => resp.userId === r.id && resp.selectedOptions?.includes(option.date));
                    if (!hasSelectedDate) continue;
                    
                    const userProfile = users.find(u => u.uid === r.id);
                    const ministries = userProfile?.ministries || [];
                    
                    let isAvailable = false;
                    if (currentPhase === 'lector' && ministries.includes('lector_commentator')) isAvailable = true;
                    if (currentPhase === 'altar_server' && ministries.includes('altar_server')) isAvailable = true;
                    if (currentPhase === 'usher' && ministries.includes('usher')) isAvailable = true;
                    if (currentPhase === 'ppt') isAvailable = true;
                    
                    const currentAssignment = assignments[option.date]?.[r.id];
                    if (isAvailable && !currentAssignment) {
                      availableCount++;
                    }
                  }
                }
                
                return (
                  <th key={option.date} className="p-3 border-b border-r border-[#00e5ff]/20 bg-[#00e5ff]/10">
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-xs font-bold text-[#008b99]">{format(new Date(option.date), 'MMM dd')} - {format(new Date(option.date), 'EEEE')}</span>
                      {option.description && (
                        <span className="text-[10px] text-[#008b99]/70 italic mt-0.5 text-center px-1">{option.description}</span>
                      )}
                      {currentPhase !== 'completed' && (
                        <span className="text-[9px] mt-1 bg-[#00e5ff]/20 text-[#008b99] px-2 py-0.5 rounded-full font-bold">
                          {availableCount} Available
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {responders.map((user, idx) => {
              const stats = userStats.get(user.id) || { total: 0, lector: 0, commentator: 0, altar: 0, usher: 0, ppt: 0 };
              const count = stats.total;
              const userProfile = users.find(u => u.uid === user.id);

              return (
                <tr key={user.id} className="border-b border-gray-100 last:border-none hover:bg-gray-50/50">
                  <td 
                    className="p-4 border-r border-gray-100 font-medium text-sm text-gray-700 whitespace-nowrap bg-white sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)] group cursor-help"
                    onClick={() => setShownUserInfo(user.id)}
                  >
                    <div className="flex flex-col relative">
                      <span>{idx + 1}. {user.name}</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className={cn(
                          "text-[8px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap",
                          count === 0 ? "bg-gray-100 text-gray-400" :
                          count === 1 ? "bg-blue-50 text-blue-600" :
                          "bg-orange-50 text-orange-600"
                        )}>
                          {count} Total
                        </span>
                        {stats.lector > 0 && <span className="text-[8px] bg-indigo-50 text-indigo-600 font-bold px-1.5 py-0.5 rounded-full">L:{stats.lector}</span>}
                        {stats.commentator > 0 && <span className="text-[8px] bg-pink-50 text-pink-600 font-bold px-1.5 py-0.5 rounded-full">C:{stats.commentator}</span>}
                        {stats.altar > 0 && <span className="text-[8px] bg-amber-50 text-amber-600 font-bold px-1.5 py-0.5 rounded-full">A:{stats.altar}</span>}
                        {stats.usher > 0 && <span className="text-[8px] bg-emerald-50 text-emerald-600 font-bold px-1.5 py-0.5 rounded-full">U:{stats.usher}</span>}
                        {stats.ppt > 0 && <span className="text-[8px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded-full">P:{stats.ppt}</span>}
                      </div>

                      {/* Click-triggered Popup for Roles */}
                      {shownUserInfo === user.id && (
                        <div 
                          ref={userInfoRef}
                          className="absolute left-full top-0 ml-4 z-[100] bg-white border border-gray-200 shadow-2xl rounded-2xl p-4 min-w-[240px] animate-in fade-in slide-in-from-left-2 duration-200"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-50">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Active Liturgical Roles</p>
                            <button 
                              onClick={() => setShownUserInfo(null)}
                              className="text-gray-300 hover:text-gray-600 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          <div className="space-y-3">
                            {userProfile?.ministries?.filter(m => !['kitchen', 'cleaning'].includes(m)).map(m => (
                              <div key={m} className="flex flex-col gap-1">
                                <span className={cn(
                                  "text-[10px] font-bold px-2.5 py-1 rounded-lg w-fit uppercase tracking-tighter border",
                                  m === 'lector_commentator' ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
                                  m === 'altar_server' ? "bg-amber-50 text-amber-600 border-amber-100" :
                                  m === 'usher' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                  "bg-gray-50 text-gray-600 border-gray-100"
                                )}>
                                  {m.replace('_', ' ')}
                                </span>
                                {m === 'lector_commentator' && userProfile.lcRoles && userProfile.lcRoles.length > 0 && (
                                  <div className="flex flex-wrap gap-1 ml-2">
                                    {userProfile.lcRoles.map(r => (
                                      <span key={r} className="text-[9px] text-gray-500 px-2 py-0.5 bg-gray-50 rounded border border-gray-100 italic">
                                        {r}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                            {(!userProfile?.ministries || userProfile.ministries.filter(m => !['kitchen', 'cleaning'].includes(m)).length === 0) && (
                              <p className="text-xs text-gray-400 italic py-2">No active liturgical roles identified.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  {(poll.massDates || []).map(option => {
                  const hasSelected = pollResponses.some(r => r.userId === user.id && r.selectedOptions?.includes(option.date));
                  const currentAssignment = effectiveAssignments[option.date]?.[user.id];
                  const isAssigningThisCell = assigningCell?.userId === user.id && assigningCell?.date === option.date;
                  const isStaged = stagedAssignments[option.date]?.[user.id] !== undefined;

                  return (
                    <td key={option.date} className="p-3 border-r border-gray-100 text-center min-w-[160px] align-middle">
                      <div className="flex items-center justify-center gap-2 relative">
                        {hasSelected ? (
                          <CheckSquare className="text-gray-500 w-4 h-4 shrink-0" />
                        ) : (
                          <Square className="text-gray-200 w-4 h-4 shrink-0" />
                        )}

                        <div className="flex-1 text-left">
                          {!hasSelected ? (
                            <div className="h-6 bg-gray-100 rounded-full w-full opacity-50" />
                          ) : (
                            <>
                              {isAssigningThisCell ? (
                                <div 
                                  ref={menuRef}
                                  className="absolute top-1/2 left-6 -translate-y-1/2 z-20 bg-white rounded-lg shadow-xl border border-gray-200 p-1 min-w-[150px]"
                                >
                                  <div className="max-h-48 overflow-y-auto flex flex-col gap-1 pr-1">
                                    <button
                                      onClick={() => handleAssignRole(option.date, user.id, '')}
                                      className="text-left px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded"
                                    >
                                      None / Clear
                                    </button>
                                    {getAvailableRolesForUser(option.date, user.id, currentPhase).map(role => (
                                      <button
                                        key={role}
                                        onClick={() => handleAssignRole(option.date, user.id, role)}
                                        className={cn(
                                          "text-left px-3 py-1.5 text-xs font-bold rounded",
                                          ROLE_COLORS[role]
                                        )}
                                      >
                                        {role}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div 
                                  onClick={() => {
                                    if (canEditCurrentPhase) {
                                      setAssigningCell({ userId: user.id, date: option.date });
                                    }
                                  }}
                                  className={cn(
                                    "px-3 py-1 rounded-full text-[10px] font-bold w-full text-center cursor-pointer transition-all border",
                                    currentAssignment ? ROLE_COLORS[currentAssignment] + " border-transparent" : "bg-gray-50 text-gray-400 border-gray-200 hover:border-blue-300 hover:bg-blue-50",
                                    (!canEditCurrentPhase) && !currentAssignment && "cursor-default border-none hover:bg-gray-50",
                                    isStaged && "ring-2 ring-orange-400 ring-offset-1"
                                  )}
                                >
                                  {currentAssignment || (canEditCurrentPhase ? 'Assign +' : '')}
                                  {isStaged && <span className="absolute -top-1 -right-1 w-2 h-2 bg-orange-400 rounded-full ring-1 ring-white" />}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
            {responders.length === 0 && (
              <tr>
                <td colSpan={(poll.massDates?.length || 0) + 1} className="py-8 text-center text-gray-500 italic text-sm">
                  No responses yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
