import React, { useState, useEffect, useRef } from 'react';
import { Poll, PollResponse, COMMITTEE_ROLES, ROLE_COLORS, UserProfile } from '../types';
import { doc, updateDoc, collection, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { format } from 'date-fns';
import { Check, ChevronDown, CheckSquare, Square, Loader2, X, Sliders, ChevronLeft, ChevronRight, Grid, Layers, AlertCircle, Share2, Mail } from 'lucide-react';
import { cn } from '../lib/utils';
import { sendGmail } from '../lib/gmail';

const getGoogleCalendarUrl = (
  dateStr: string,
  role: string,
  pollTitle: string,
  massDescription?: string,
  baseUrl?: string,
  pollId?: string
) => {
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return '';
    const year = parts[0];
    const month = parts[1];
    const day = parts[2];
    
    const startDateStr = `${year}${month}${day}`;
    
    // Calculate endDate (next day)
    const dt = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    dt.setDate(dt.getDate() + 1);
    
    const nextYear = dt.getFullYear();
    const nextMonth = String(dt.getMonth() + 1).padStart(2, '0');
    const nextDay = String(dt.getDate()).padStart(2, '0');
    const endDateStr = `${nextYear}${nextMonth}${nextDay}`;
    
    const eventTitle = encodeURIComponent(`KCFC Duty: ${role}`);
    
    let detailsStr = `You are scheduled as ${role} for the KCFC Liturgical Ministry under "${pollTitle}".`;
    if (massDescription) {
      detailsStr += `\n\nMass Details: ${massDescription}`;
    }
    if (baseUrl) {
      const pollSuffix = pollId ? `&pollId=${pollId}` : '';
      detailsStr += `\n\nPlease check the complete assignments matrix here: ${baseUrl}/duties?tab=liturgical${pollSuffix}`;
    }
    const details = encodeURIComponent(detailsStr);
    const location = encodeURIComponent('KCFC (Kobe Catholic Foreigners Community)');
    
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventTitle}&dates=${startDateStr}/${endDateStr}&details=${details}&location=${location}`;
  } catch (err) {
    console.error('Error generating google calendar link', err);
    return '';
  }
};

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
  
  // Custom states for adjustable columns, easy horizontal scroll, and mobile view
  const [columnWidth, setColumnWidth] = useState<number>(185);
  const [nameColumnWidth, setNameColumnWidth] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 90; // default for mobile (smaller/2/3 of normal)
    }
    return 160; // default for desktop
  });
  const [viewMode, setViewMode] = useState<'grid' | 'cards'>('grid');
  const [selectedMobileDate, setSelectedMobileDate] = useState<string>('');
  const [assigningMobileCell, setAssigningMobileCell] = useState<{ date: string, role: string } | null>(null);
  const [isMobileStatsExpanded, setIsMobileStatsExpanded] = useState<boolean>(false);

  // Broadcast modal states
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'selected' | 'committee'>('all');
  const [selectedUserIdsForBroadcast, setSelectedUserIdsForBroadcast] = useState<string[]>([]);
  const [selectedCommitteesForBroadcast, setSelectedCommitteesForBroadcast] = useState<string[]>(['lector', 'altar_server', 'usher', 'ppt']);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [customSubject, setCustomSubject] = useState(`[KCFC] Liturgical Assignments Update: ${poll.title}`);
  const [customMessage, setCustomMessage] = useState(`The liturgical assignments for "${poll.title}" have been finalized by all leaders.`);

  const menuRef = useRef<HTMLDivElement>(null);
  const userInfoRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  
  // Drag to scroll refs for grid view
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  // Default view is grid view on all screen sizes as requested

  useEffect(() => {
    if (poll.massDates && poll.massDates.length > 0) {
      setSelectedMobileDate(prev => {
        if (prev && poll.massDates?.some(d => d.date === prev)) {
          return prev;
        }
        return poll.massDates[0].date;
      });
    }
  }, [poll.massDates]);

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

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setAssigningCell(null);
        setAssigningMobileCell(null);
        setShownUserInfo(null);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const completed = poll.completedAssignments || [];
  
  let currentPhase: 'lector' | 'altar_server' | 'usher' | 'ppt' | 'completed' = 'completed';
  if (!completed.includes('lector')) currentPhase = 'lector';
  else if (!completed.includes('altar_server')) currentPhase = 'altar_server';
  else if (!completed.includes('usher')) currentPhase = 'usher';
  else if (!completed.includes('ppt')) currentPhase = 'ppt';

  const userRoles = profile?.roles || [];
  const isAdminOrPresident = userRoles.includes('admin') || userRoles.includes('president');
  const isExecutive = isAdminOrPresident || userRoles.includes('vice_president') || userRoles.includes('secretary') || userRoles.includes('treasurer') || userRoles.includes('auditor') || userRoles.includes('pro');
  
  const now = new Date();
  const isPollActive = poll.status === 'active' && now <= new Date(poll.endDate);

  const canAssignLector = isAdminOrPresident || userRoles.includes('lector_commentator_leader');
  const canAssignAltar = isAdminOrPresident || userRoles.includes('altar_server_leader');
  const canAssignUsher = isAdminOrPresident || userRoles.includes('usher_leader');
  const canAssignPPT = isExecutive;

  const canEditCurrentPhase = 
    !isPollActive && (
      (currentPhase === 'lector' && canAssignLector) ||
      (currentPhase === 'altar_server' && canAssignAltar) ||
      (currentPhase === 'usher' && canAssignUsher) ||
      (currentPhase === 'ppt' && canAssignPPT) ||
      (currentPhase === 'completed' && isAdminOrPresident) ||
      (currentPhase === 'completed' && (
        (canAssignLector) || 
        (canAssignAltar) || 
        (canAssignUsher)
      ))
    );

  const getRolesForCurrentPhase = (phase: typeof currentPhase) => {
    if (phase === 'lector') {
      return ['Commentator', 'Lector 1', 'Lector 2'];
    } else if (phase === 'altar_server') {
      return ['Altar Server 1', 'Altar Server 2', 'Altar Server 3', 'Altar Server 4'];
    } else if (phase === 'usher') {
      return ['Usher 1', 'Usher 2', 'Usher 3', 'Usher 4'];
    } else if (phase === 'ppt') {
      return ['PPT Operator'];
    } else {
      return [
        'Commentator', 'Lector 1', 'Lector 2',
        'Altar Server 1', 'Altar Server 2', 'Altar Server 3', 'Altar Server 4',
        'Usher 1', 'Usher 2', 'Usher 3', 'Usher 4',
        'PPT Operator'
      ];
    }
  };

  const scrollTable = (direction: 'left' | 'right') => {
    if (tableContainerRef.current) {
      const scrollAmount = direction === 'left' ? -280 : 280;
      tableContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Drag-to-scroll event handlers for the Grid view container
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only drag with left click
    const target = e.target as HTMLElement;
    if (
      target.closest('button') || 
      target.closest('select') || 
      target.closest('input') || 
      target.closest('label') ||
      target.closest('a')
    ) {
      return;
    }
    if (tableContainerRef.current) {
      isDraggingRef.current = true;
      tableContainerRef.current.style.cursor = 'grabbing';
      tableContainerRef.current.style.userSelect = 'none';
      startXRef.current = e.pageX - tableContainerRef.current.offsetLeft;
      scrollLeftRef.current = tableContainerRef.current.scrollLeft;
    }
  };

  const handleMouseLeave = () => {
    if (isDraggingRef.current && tableContainerRef.current) {
      isDraggingRef.current = false;
      tableContainerRef.current.style.cursor = 'grab';
      tableContainerRef.current.style.removeProperty('user-select');
    }
  };

  const handleMouseUp = () => {
    if (isDraggingRef.current && tableContainerRef.current) {
      isDraggingRef.current = false;
      tableContainerRef.current.style.cursor = 'grab';
      tableContainerRef.current.style.removeProperty('user-select');
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !tableContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - tableContainerRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5; // Multiply by speed multiplier
    tableContainerRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

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
        // Ask the admin/president first before sending the notifications
        const shouldSend = confirm("All liturgical assignments have been completed! Would you like to send email notifications to all assigned members now?");
        if (shouldSend) {
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
                message: `You have new assignments for the upcoming masses. Please check the assignments matrix.`,
                type: 'system',
                status: 'unread',
                link: `/duties?tab=liturgical&pollId=${poll.id}`,
                createdAt: serverTimestamp()
              });
            }
          });
          await batch.commit();

          const clientId = (import.meta as any).env.VITE_CLIENT_ID;
          if (clientId && usersToEmail.length > 0) {
            const subject = `[KCFC] New Assignments: ${poll.title}`;
            const baseUrl = window.location.origin;

            const formatDateSafe = (dateStr: string) => {
              try {
                return format(new Date(dateStr), 'EEEE, MMM d, yyyy');
              } catch (e) {
                return dateStr;
              }
            };

            let successCount = 0;
            for (const member of usersToEmail) {
              if (member.email) {
                try {
                  // Construct personalized assignments list for this specific member
                  const memberAssignments: { date: string, role: string }[] = [];
                  Object.entries(assignments).forEach(([dateStr, dateAssigns]: [string, any]) => {
                    const role = dateAssigns[member.uid];
                    if (role) {
                      memberAssignments.push({ date: dateStr, role });
                    }
                  });
                  memberAssignments.sort((a, b) => a.date.localeCompare(b.date));

                  let assignmentsHtml = '';
                  if (memberAssignments.length > 0) {
                    assignmentsHtml = `
                      <div style="background-color: #f0fdfe; border: 1px solid #cffafe; border-radius: 12px; padding: 20px; margin: 25px 0; font-family: sans-serif;">
                        <h3 style="margin-top: 0; margin-bottom: 8px; color: #008b99; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Your Scheduled Duties:</h3>
                        <p style="margin-top: 0; margin-bottom: 15px; font-size: 12px; color: #475569; line-height: 1.4;">
                          You can click the <strong>📅 Add</strong> button next to any scheduled duty to add it directly to your personal Google Calendar!
                        </p>
                        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                          <thead>
                            <tr style="border-bottom: 2px solid #e2e8f0; text-align: left; color: #475569;">
                              <th style="padding: 8px 0; font-weight: 700;">Date</th>
                              <th style="padding: 8px 0; font-weight: 700;">Role</th>
                              <th style="padding: 8px 0; font-weight: 700; text-align: right;">Calendar</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${memberAssignments.map(asg => {
                              const massOpt = poll.massDates?.find(d => d.date === asg.date);
                              const massDesc = massOpt?.description || '';
                              const gcalLink = getGoogleCalendarUrl(asg.date, asg.role, poll.title, massDesc, baseUrl, poll.id);
                              return `
                                <tr>
                                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-weight: 500;">${formatDateSafe(asg.date)}</td>
                                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #008b99; font-weight: 700;">${asg.role}</td>
                                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; text-align: right;">
                                    ${gcalLink ? `
                                      <a href="${gcalLink}" target="_blank" style="background-color: #008b99; color: white; padding: 4px 10px; text-decoration: none; border-radius: 6px; font-size: 11px; font-weight: bold; display: inline-block;">
                                        📅 Add
                                      </a>
                                    ` : '-'}
                                  </td>
                                </tr>
                              `;
                            }).join('')}
                          </tbody>
                        </table>
                      </div>
                    `;
                  } else {
                    assignmentsHtml = `
                      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 25px 0; font-family: sans-serif; font-size: 13px; color: #475569;">
                        <p style="margin: 0;">We do not have any specific liturgical assignments assigned to you in this rotation. However, we encourage you to attend the masses and support your fellow committee members!</p>
                      </div>
                    `;
                  }

                   const body = `
                    <div style="font-family: serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                      <div style="background-color: #00e5ff; color: #004d55; padding: 40px; text-align: center;">
                        <h1 style="margin: 0; font-size: 26px; font-weight: bold; font-family: sans-serif; letter-spacing: -0.5px;">Liturgical Assignments Published</h1>
                      </div>
                      <div style="padding: 40px; line-height: 1.6; font-size: 15px;">
                        <p style="font-size: 16px; font-weight: bold;">Dear ${member.displayName || 'Committee Member'},</p>
                        <p>The liturgical assignments for <strong>"${poll.title}"</strong> have been finalized by all leaders.</p>
                        
                        ${assignmentsHtml}
                        
                        <p style="font-size: 13px; color: #64748b; margin-top: 30px;">
                          Please review the full interactive matrix to see the complete scheduling layout and confirm your availability.
                        </p>

                        <p style="text-align: center; margin: 40px 0;">
                          <a href="${baseUrl}/duties?tab=liturgical&pollId=${poll.id}" style="background-color: #008b99; color: white; padding: 15px 30px; text-decoration: none; border-radius: 12px; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 1px; display: inline-block; box-shadow: 0 2px 5px rgba(0,0,0,0.1); font-family: sans-serif;">
                            View Full Matrix
                          </a>
                        </p>

                        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 30px 0;" />
                        <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0; font-family: sans-serif;">
                          You are receiving this because you are an active member of KCFC Liturgical Ministries.<br/>
                          This is an important system update.
                        </p>
                      </div>
                    </div>
                  `;

                  const formattedTo = member.displayName ? `"${member.displayName}" <${member.email}>` : member.email;
                  await sendGmail(formattedTo, subject, body);
                  successCount++;
                } catch (err) {
                  console.error(`Failed to send email to ${member.email}`, err);
                }
              }
            }
            alert(`Assignments completed! Sent email to ${successCount} members.`);
          }
        } else {
          alert("Assignments marked completed! No notifications were sent. You can broadcast notifications at any time using the 'Broadcast Email' button at the top of the matrix.");
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

  const handleBroadcastEmails = async () => {
    // 1. Determine recipients
    let recipientUsers: UserProfile[] = [];
    
    // Get full profiles for our responders
    const responderProfiles = users.filter(u => responders.some(r => r.id === u.uid));

    if (broadcastTarget === 'all') {
      recipientUsers = responderProfiles;
    } else if (broadcastTarget === 'selected') {
      recipientUsers = responderProfiles.filter(u => selectedUserIdsForBroadcast.includes(u.uid));
    } else if (broadcastTarget === 'committee') {
      recipientUsers = responderProfiles.filter(u => {
        const uRoles = u.roles || [];
        const ministries = u.ministries || [];
        const matchesLector = selectedCommitteesForBroadcast.includes('lector') && 
          (ministries.includes('lector_commentator') || uRoles.includes('lector_commentator_leader'));
        const matchesAltar = selectedCommitteesForBroadcast.includes('altar_server') && 
          (ministries.includes('altar_server') || uRoles.includes('altar_server_leader'));
        const matchesUsher = selectedCommitteesForBroadcast.includes('usher') && 
          (ministries.includes('usher') || uRoles.includes('usher_leader'));
        const matchesPPT = selectedCommitteesForBroadcast.includes('ppt') && 
          Object.values(assignments).some(dateAssignments => {
            return dateAssignments[u.uid] === 'PPT';
          });
        return matchesLector || matchesAltar || matchesUsher || matchesPPT;
      });
    }

    if (recipientUsers.length === 0) {
      alert("No recipients selected or matching the criteria.");
      return;
    }

    if (!confirm(`Are you sure you want to send email notifications to ${recipientUsers.length} selected member(s)?`)) {
      return;
    }

    setIsBroadcasting(true);
    let successCount = 0;
    try {
      const baseUrl = window.location.origin;

      // We should also write system notifications in Firestore
      const batch = writeBatch(db);
      recipientUsers.forEach(u => {
        const notificationRef = doc(collection(db, 'notifications'));
        batch.set(notificationRef, {
          userId: u.uid,
          title: customSubject,
          message: customMessage,
          type: 'broadcast',
          status: 'unread',
          link: `/duties?tab=liturgical&pollId=${poll.id}`,
          createdAt: serverTimestamp()
        });
      });
      await batch.commit();

      const clientId = (import.meta as any).env.VITE_CLIENT_ID;
      if (clientId) {
        const formatDateSafe = (dateStr: string) => {
          try {
            return format(new Date(dateStr), 'EEEE, MMM d, yyyy');
          } catch (e) {
            return dateStr;
          }
        };

        for (const member of recipientUsers) {
          if (member.email) {
            try {
              // Construct personalized assignments list for this specific member
              const memberAssignments: { date: string, role: string }[] = [];
              Object.entries(assignments).forEach(([dateStr, dateAssigns]: [string, any]) => {
                const role = dateAssigns[member.uid];
                if (role) {
                  memberAssignments.push({ date: dateStr, role });
                }
              });
              memberAssignments.sort((a, b) => a.date.localeCompare(b.date));

              let assignmentsHtml = '';
              if (memberAssignments.length > 0) {
                assignmentsHtml = `
                  <div style="background-color: #f0fdfe; border: 1px solid #cffafe; border-radius: 12px; padding: 20px; margin: 25px 0; font-family: sans-serif;">
                    <h3 style="margin-top: 0; margin-bottom: 8px; color: #008b99; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Your Scheduled Duties:</h3>
                    <p style="margin-top: 0; margin-bottom: 15px; font-size: 12px; color: #475569; line-height: 1.4;">
                      You can click the <strong>📅 Add</strong> button next to any scheduled duty to add it directly to your personal Google Calendar!
                    </p>
                    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                      <thead>
                        <tr style="border-bottom: 2px solid #e2e8f0; text-align: left; color: #475569;">
                          <th style="padding: 8px 0; font-weight: 700;">Date</th>
                          <th style="padding: 8px 0; font-weight: 700;">Role</th>
                          <th style="padding: 8px 0; font-weight: 700; text-align: right;">Calendar</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${memberAssignments.map(asg => {
                          const massOpt = poll.massDates?.find(d => d.date === asg.date);
                          const massDesc = massOpt?.description || '';
                          const gcalLink = getGoogleCalendarUrl(asg.date, asg.role, poll.title, massDesc, baseUrl, poll.id);
                          return `
                            <tr>
                              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-weight: 500;">${formatDateSafe(asg.date)}</td>
                              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #008b99; font-weight: 700;">${asg.role}</td>
                              <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; text-align: right;">
                                ${gcalLink ? `
                                  <a href="${gcalLink}" target="_blank" style="background-color: #008b99; color: white; padding: 4px 10px; text-decoration: none; border-radius: 6px; font-size: 11px; font-weight: bold; display: inline-block;">
                                    📅 Add
                                  </a>
                                ` : '-'}
                              </td>
                            </tr>
                          `;
                        }).join('')}
                      </tbody>
                    </table>
                  </div>
                `;
              } else {
                assignmentsHtml = `
                  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 25px 0; font-family: sans-serif; font-size: 13px; color: #475569;">
                    <p style="margin: 0;">We do not have any specific liturgical assignments assigned to you in this rotation. However, we encourage you to attend the masses and support your fellow committee members!</p>
                  </div>
                `;
              }

              const body = `
                <div style="font-family: serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                  <div style="background-color: #00e5ff; color: #004d55; padding: 40px; text-align: center;">
                    <h1 style="margin: 0; font-size: 26px; font-weight: bold; font-family: sans-serif; letter-spacing: -0.5px;">Liturgical Assignments Published</h1>
                  </div>
                  <div style="padding: 40px; line-height: 1.6; font-size: 15px;">
                    <p style="font-size: 16px; font-weight: bold;">Dear ${member.displayName || 'Committee Member'},</p>
                    <p>${customMessage.replace(/\n/g, '<br/>')}</p>
                    
                    ${assignmentsHtml}

                    <p style="font-size: 13px; color: #64748b; margin-top: 30px;">
                      Please review the full interactive matrix to see the complete scheduling layout and confirm your availability.
                    </p>

                    <p style="text-align: center; margin: 40px 0;">
                      <a href="${baseUrl}/duties?tab=liturgical&pollId=${poll.id}" style="background-color: #008b99; color: white; padding: 15px 30px; text-decoration: none; border-radius: 12px; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 1px; display: inline-block; box-shadow: 0 2px 5px rgba(0,0,0,0.1); font-family: sans-serif;">
                        View Full Matrix
                      </a>
                    </p>

                    <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 30px 0;" />
                    <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0; font-family: sans-serif;">
                      You are receiving this because you are an active member of KCFC Liturgical Ministries.<br/>
                      This is an important system update.
                    </p>
                  </div>
                </div>
              `;

              const formattedTo = member.displayName ? `"${member.displayName}" <${member.email}>` : member.email;
              await sendGmail(formattedTo, customSubject, body);
              successCount++;
            } catch (err) {
              console.error(`Failed to send email to ${member.email}`, err);
            }
          }
        }
        alert(`Broadcast successful! Sent email to ${successCount} member(s).`);
      } else {
        alert(`System warning: VITE_CLIENT_ID is not configured, but notifications have been posted in the app. Sent to ${recipientUsers.length} member(s).`);
      }
      setIsBroadcastModalOpen(false);
    } catch (err) {
      alert(`Error broadcasting emails: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const getAvailableRolesForUser = (date: string, userId: string, requestedPhase: typeof currentPhase) => {
    // If the logged-in user is an admin or president, they can see/assign roles across all committees/phases.
    // So we treat requestedPhase as if it's 'completed' (which allows roles from all committees/phases).
    const phaseToQuery = isAdminOrPresident ? 'completed' : requestedPhase;

    if (phaseToQuery === 'completed' && !canEditCurrentPhase) return [];
    
    // Check user's committee boundaries
    const userProfile = users.find(u => u.uid === userId);
    const ministries = userProfile?.ministries || [];
    const lcRoles = userProfile?.lcRoles || [];
    
    // Does the user have the required ministry?
    const hasLector = ministries.includes('lector_commentator');
    const hasAltar = ministries.includes('altar_server');
    const hasUsher = ministries.includes('usher');
    
    let allowedRolesForUser: string[] = [];

    if ((phaseToQuery === 'lector' || phaseToQuery === 'completed') && (hasLector || isAdminOrPresident)) {
      if (lcRoles.some(r => r.includes('Commentator'))) allowedRolesForUser.push('Commentator');
      if (lcRoles.some(r => r.includes('Lector'))) allowedRolesForUser.push('Lector 1', 'Lector 2');
    }
    
    if ((phaseToQuery === 'altar_server' || phaseToQuery === 'completed') && (hasAltar || isAdminOrPresident)) {
      allowedRolesForUser.push(...COMMITTEE_ROLES['altar_server']);
    }

    if ((phaseToQuery === 'usher' || phaseToQuery === 'completed') && (hasUsher || isAdminOrPresident)) {
      allowedRolesForUser.push(...COMMITTEE_ROLES['usher']);
    }

    if (phaseToQuery === 'ppt' || phaseToQuery === 'completed') {
      allowedRolesForUser.push(...COMMITTEE_ROLES['ppt']);
    }

    const dateAssignments = effectiveAssignments[date] || {};
    const assignedRoles = Object.values(dateAssignments);
    
    // If the user is already assigned to a role on this date in a different phase/committee,
    // they should not be available for any role in the current requested phase.
    const assignedRoleForThisUser = dateAssignments[userId];
    if (assignedRoleForThisUser) {
      let currentRolePhase: typeof currentPhase | null = null;
      if (COMMITTEE_ROLES.lector.includes(assignedRoleForThisUser)) {
        currentRolePhase = 'lector';
      } else if (COMMITTEE_ROLES.altar_server.includes(assignedRoleForThisUser)) {
        currentRolePhase = 'altar_server';
      } else if (COMMITTEE_ROLES.usher.includes(assignedRoleForThisUser)) {
        currentRolePhase = 'usher';
      } else if (COMMITTEE_ROLES.ppt.includes(assignedRoleForThisUser)) {
        currentRolePhase = 'ppt';
      }

      if (currentRolePhase && currentRolePhase !== requestedPhase) {
        if (!isAdminOrPresident) {
          return [];
        }
      }
    }
    
    return allowedRolesForUser.filter(r => !assignedRoles.includes(r) || dateAssignments[userId] === r);
  };

  const isCellEditable = (userId: string, date: string) => {
    if (!canEditCurrentPhase) return false;
    
    const currentAssignment = effectiveAssignments[date]?.[userId];
    
    // 1. If there's an assignment, check who can edit/clear it
    if (currentAssignment) {
      if (isAdminOrPresident) return true;
      
      // Non-admins can only edit/clear assignments belonging to their active phase
      let rolePhase: typeof currentPhase | null = null;
      if (COMMITTEE_ROLES.lector.includes(currentAssignment)) {
        rolePhase = 'lector';
      } else if (COMMITTEE_ROLES.altar_server.includes(currentAssignment)) {
        rolePhase = 'altar_server';
      } else if (COMMITTEE_ROLES.usher.includes(currentAssignment)) {
        rolePhase = 'usher';
      } else if (COMMITTEE_ROLES.ppt.includes(currentAssignment)) {
        rolePhase = 'ppt';
      }
      
      return rolePhase === currentPhase;
    }
    
    // 2. If there's no assignment (empty cell), can we assign?
    // Only if there's at least one available role for this user on this date.
    const available = getAvailableRolesForUser(date, userId, currentPhase);
    return available.length > 0;
  };

  const getAvailableMembersForRole = (date: string, roleName: string) => {
    return responders.filter(member => {
      // 1. Must be available on this date (has selected this option)
      const isAvailable = pollResponses.some(r => r.userId === member.id && r.selectedOptions?.includes(date));
      if (!isAvailable) return false;

      // 2. Check if they are eligible for this specific role in the current phase or if already assigned
      const availableRoles = getAvailableRolesForUser(date, member.id, currentPhase);
      const isCurrentlyAssigned = effectiveAssignments[date]?.[member.id] === roleName;
      
      return availableRoles.includes(roleName) || isCurrentlyAssigned;
    });
  };

  const handleMobileAssign = async (date: string, userId: string, role: string) => {
    if (!userId) {
      // Clear whoever is currently assigned to this role
      const dateAssigns = effectiveAssignments[date] || {};
      const prevUserId = Object.keys(dateAssigns).find(uid => dateAssigns[uid] === role);
      if (prevUserId) {
        await handleAssignRole(date, prevUserId, '');
      }
      return;
    }

    // Check if another user is already assigned to this role
    const dateAssigns = effectiveAssignments[date] || {};
    const alreadyAssigned = Object.entries(dateAssigns).find(([uid, r]) => r === role && uid !== userId);
    
    if (alreadyAssigned) {
      const assignedUserName = responders.find(r => r.id === alreadyAssigned[0])?.name || 'Someone else';
      if (confirm(`${role} is already assigned to ${assignedUserName}. Reassign to this member instead?`)) {
        // Clear previous assignee
        await handleAssignRole(date, alreadyAssigned[0], '');
        // Assign new member
        await handleAssignRole(date, userId, role);
      }
      return;
    }

    // Assign directly
    await handleAssignRole(date, userId, role);
  };

  return (
    <div className="bg-white dark:bg-[#1e1e1a] rounded-xl md:rounded-3xl overflow-hidden shadow-xs md:shadow-sm border border-gray-100 dark:border-white/5 mt-4 md:mt-8">
      <div className="p-4 md:p-6 bg-[#00e5ff]/20 border-b border-[#00e5ff]/30 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="hidden sm:block w-10"></div> {/* Spacer for perfect alignment of center title */}
        <h3 className="uppercase tracking-widest font-black text-[#008b99] text-sm text-center">Liturgical Ministry Assignment & Scheduling</h3>
        <div className="flex flex-wrap items-center justify-center gap-2 self-stretch sm:self-auto">
          {isAdminOrPresident && (
            <button
              onClick={() => {
                // Initialize default individual selection with all responders
                setSelectedUserIdsForBroadcast(responders.map(r => r.id));
                setIsBroadcastModalOpen(true);
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-[#008b99] hover:bg-[#007a87] text-white border border-transparent rounded-xl text-xs font-bold shadow-xs cursor-pointer transition-all justify-center"
              title="Broadcast Assignments via Email"
            >
              <Mail size={14} />
              <span>Broadcast Email</span>
            </button>
          )}
          <button
            onClick={() => {
              const shareUrl = `${window.location.origin}/duties?tab=liturgical&pollId=${poll.id}`;
              navigator.clipboard.writeText(shareUrl).then(() => {
                alert(`Matrix share link copied to clipboard:\n${shareUrl}\n\n💡 Tip for Mobile Apps (Viber/Messenger):\nTo open this in your default phone browser for the best experience, click the three-dot (...) menu in the top right corner and select 'Open in System Browser' or 'Open in Chrome/Safari'.`);
              }).catch(() => {
                alert(`Could not write to clipboard automatically. Here is the link to copy:\n${shareUrl}\n\n💡 Tip: Paste and open this in Chrome or Safari for the best experience!`);
              });
            }}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-white hover:bg-gray-50 text-[#008b99] border border-gray-200 rounded-xl text-xs font-bold shadow-xs cursor-pointer hover:border-gray-300 transition-all justify-center"
            title="Copy Matrix Share Link"
          >
            <Share2 size={14} className="text-[#008b99]" />
            <span>Share Matrix</span>
          </button>
        </div>
      </div>
      
      {/* Workflow Tracker - Hidden once completed/assignment is done */}
      {currentPhase !== 'completed' && (
        <div className="px-4 md:px-6 py-3 md:py-4 flex flex-wrap gap-4 items-center justify-between bg-gray-50 border-b border-gray-100">
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

          {canEditCurrentPhase && (
            <button
              onClick={handleCompletePhase}
              disabled={isCompleting}
              className="flex items-center gap-2 px-4 py-2 bg-[#5A5A40] text-white rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-[#4a4a35] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCompleting ? <Loader2 size={14} className="animate-spin" /> : null}
              Mark {currentPhase === 'lector' ? 'Lector/Commentator' : currentPhase === 'altar_server' ? 'Altar Server' : currentPhase === 'usher' ? 'Usher' : 'PPT'} Done
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
      )}

      {isPollActive && (
        <div className="mx-6 mt-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-400 rounded-2xl flex items-center gap-2.5 text-xs font-semibold">
          <AlertCircle size={16} className="text-amber-600 dark:text-amber-500 animate-pulse shrink-0" />
          <span>This Poll is currently Active and voting is still open. Assigning roles is locked until voting is completed/closed.</span>
        </div>
      )}

      {/* Controls & Mode Selector Utility Bar */}
      <div className="px-4 md:px-6 py-2.5 md:py-3.5 bg-gray-50/50 dark:bg-white/5 border-b border-gray-100 dark:border-white/5 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-1.5 bg-gray-100/85 dark:bg-white/5 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              viewMode === 'grid' 
                ? "bg-white dark:bg-[#1e1e1a] text-gray-800 dark:text-[#f5f5f0] shadow-sm" 
                : "text-gray-500 hover:text-gray-800 dark:hover:text-white"
            )}
          >
            <Grid size={13} />
            Grid View
          </button>
          <button
            onClick={() => setViewMode('cards')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
              viewMode === 'cards' 
                ? "bg-white dark:bg-[#1e1e1a] text-gray-800 dark:text-[#f5f5f0] shadow-sm" 
                : "text-gray-500 hover:text-gray-800 dark:hover:text-white"
            )}
          >
            <Layers size={13} />
            Mobile Cards View
          </button>
        </div>

        {viewMode === 'grid' && (
          <div className="flex items-center gap-4 flex-wrap">
            {/* Column Width Adjuster Slider */}
            <div className="flex items-center gap-2 bg-white dark:bg-[#1e1e1a] border border-gray-100 dark:border-white/5 rounded-xl px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 shadow-sm">
              <Sliders size={12} className="text-gray-400 dark:text-gray-500" />
              <span>Mass Column:</span>
              <input
                type="range"
                min="130"
                max="280"
                value={columnWidth}
                onChange={(e) => setColumnWidth(Number(e.target.value))}
                className="w-20 accent-[#008b99] cursor-pointer"
              />
              <span className="font-mono text-[10px] bg-gray-50 dark:bg-white/5 border dark:border-white/5 px-1.5 py-0.5 rounded font-bold text-[#008b99]">{columnWidth}px</span>
            </div>

            {/* Name Column Width Adjuster Slider */}
            <div className="flex items-center gap-2 bg-white dark:bg-[#1e1e1a] border border-gray-100 dark:border-white/5 rounded-xl px-2.5 py-1.5 text-xs text-gray-500 dark:text-gray-400 shadow-sm">
              <Sliders size={12} className="text-gray-400 dark:text-gray-500" />
              <span>Name Column:</span>
              <input
                type="range"
                min="75"
                max="200"
                value={nameColumnWidth}
                onChange={(e) => setNameColumnWidth(Number(e.target.value))}
                className="w-20 accent-[#008b99] cursor-pointer"
              />
              <span className="font-mono text-[10px] bg-gray-50 dark:bg-white/5 border dark:border-white/5 px-1.5 py-0.5 rounded font-bold text-[#008b99]">{nameColumnWidth}px</span>
            </div>

            {/* Quick Horizontal Scroll Buttons */}
            <div className="flex items-center gap-1 bg-white dark:bg-[#1e1e1a] border border-gray-100 dark:border-white/5 rounded-xl p-1 shadow-sm">
              <button
                onClick={() => scrollTable('left')}
                title="Scroll Left"
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest px-1">Scroll</span>
              <button
                onClick={() => scrollTable('right')}
                title="Scroll Right"
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {viewMode === 'grid' ? (
        <div 
          ref={tableContainerRef} 
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          className="overflow-x-auto scrollbar-thin cursor-grab active:cursor-grabbing select-none"
        >
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr>
                <th 
                  className="p-2.5 md:p-4 border-b border-r border-[#00e5ff]/20 bg-[#e0fcff] dark:bg-[#1a383d] text-xs font-bold text-center sticky left-0 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.02)]"
                  style={{ minWidth: `${nameColumnWidth}px`, width: `${nameColumnWidth}px`, maxWidth: `${nameColumnWidth}px` }}
                >
                  <div style={{ maxWidth: `calc(${nameColumnWidth}px - 0.5rem)` }} className="truncate mx-auto">
                    NAME
                  </div>
                </th>
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
                    <th 
                      key={option.date} 
                      className="p-3 border-b border-r border-[#00e5ff]/20 bg-[#00e5ff]/10"
                      style={{ minWidth: `${columnWidth}px`, width: `${columnWidth}px` }}
                    >
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-xs font-bold text-[#008b99]">{format(new Date(option.date), 'MMM dd')} - {format(new Date(option.date), 'EEEE')}</span>
                        {option.description && (
                          <span className="text-[10px] text-[#008b99]/70 italic mt-0.5 text-center px-1 truncate max-w-[150px]">{option.description}</span>
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
                      className="p-2 md:p-3 border-r border-gray-100 dark:border-white/5 font-medium text-xs md:text-sm text-gray-700 dark:text-gray-200 whitespace-normal break-words bg-white dark:bg-[#1e1e1a] sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)] group cursor-help leading-snug"
                      style={{ minWidth: `${nameColumnWidth}px`, width: `${nameColumnWidth}px`, maxWidth: `${nameColumnWidth}px` }}
                      onClick={() => setShownUserInfo(user.id)}
                    >
                      <div className="flex flex-col relative" style={{ maxWidth: `calc(${nameColumnWidth}px - 1rem)` }}>
                        <span className="font-semibold block break-words" title={userProfile?.displayName || user.name}>
                          {idx + 1}. {userProfile?.nickname?.trim() || userProfile?.displayName || user.name}
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <span className={cn(
                            "text-[11px] font-extrabold px-2 py-0.5 rounded-md whitespace-nowrap",
                            count === 0 ? "bg-gray-100 text-gray-400" :
                            count === 1 ? "bg-blue-50 text-blue-600" :
                            "bg-orange-50 text-orange-600"
                          )}>
                            {count} Total
                          </span>
                          {stats.lector > 0 && <span className="text-[11px] bg-indigo-50 text-indigo-600 font-extrabold px-1.5 py-0.5 rounded-md">L:{stats.lector}</span>}
                          {stats.commentator > 0 && <span className="text-[11px] bg-pink-50 text-pink-600 font-extrabold px-1.5 py-0.5 rounded-md">C:{stats.commentator}</span>}
                          {stats.altar > 0 && <span className="text-[11px] bg-amber-50 text-amber-600 font-extrabold px-1.5 py-0.5 rounded-md">A:{stats.altar}</span>}
                          {stats.usher > 0 && <span className="text-[11px] bg-emerald-50 text-emerald-600 font-extrabold px-1.5 py-0.5 rounded-md">U:{stats.usher}</span>}
                          {stats.ppt > 0 && <span className="text-[11px] bg-slate-100 text-slate-600 font-extrabold px-1.5 py-0.5 rounded-md">P:{stats.ppt}</span>}
                        </div>

                        {/* Click-triggered Popup for Roles */}
                        {shownUserInfo === user.id && (
                          <div 
                            ref={userInfoRef}
                            className="absolute left-full top-0 ml-4 z-[100] bg-white border border-gray-200 shadow-2xl rounded-2xl p-4 min-w-[240px] animate-in fade-in slide-in-from-left-2 duration-200 text-left"
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
                              {userProfile?.ministries?.filter(m => !['kitchen', 'cleaning', 'cleaning_toilet_ok', 'cleaning_toilet_ng'].includes(m)).map(m => (
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
                              {(!userProfile?.ministries || userProfile.ministries.filter(m => !['kitchen', 'cleaning', 'cleaning_toilet_ok', 'cleaning_toilet_ng'].includes(m)).length === 0) && (
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
                      const editable = isCellEditable(user.id, option.date);

                      return (
                        <td 
                          key={option.date} 
                          className="p-1.5 md:p-3 border-r border-gray-100 text-center align-middle"
                          style={{ minWidth: `${columnWidth}px`, width: `${columnWidth}px` }}
                        >
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
                                        if (editable) {
                                          setAssigningCell({ userId: user.id, date: option.date });
                                        }
                                      }}
                                      className={cn(
                                        "px-3 py-1 rounded-full text-[10px] font-bold w-full text-center transition-all border",
                                        editable ? "cursor-pointer" : "cursor-default",
                                        currentAssignment 
                                          ? ROLE_COLORS[currentAssignment] + " border-transparent" 
                                          : (editable ? "bg-gray-50 text-gray-400 border-gray-200 hover:border-[#008b99] hover:bg-[#008b99]/5" : "bg-gray-50 text-gray-400 border-gray-200 opacity-60"),
                                        isStaged && "ring-2 ring-orange-400 ring-offset-1"
                                      )}
                                    >
                                      {currentAssignment || (editable ? 'Assign +' : '')}
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
      ) : (
        /* CARD-BASED MOBILE PORTRAIT VIEW */
        <div className="p-6 space-y-6">
          {/* Scrollable Horizontal dates bar */}
          <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none snap-x">
            {(poll.massDates || []).map((mOption) => {
              const isActive = selectedMobileDate === mOption.date;
              return (
                <button
                  key={mOption.date}
                  onClick={() => setSelectedMobileDate(mOption.date)}
                  className={cn(
                    "snap-center flex-shrink-0 px-4 py-3 rounded-2xl border text-left min-w-[140px] transition-all cursor-pointer",
                    isActive 
                      ? "bg-[#008b99] text-white border-transparent shadow-md"
                      : "bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700"
                  )}
                >
                  <p className="text-[10px] font-bold opacity-80 uppercase tracking-wider">
                    {format(new Date(mOption.date), 'EEEE')}
                  </p>
                  <p className="text-sm font-black mt-0.5">
                    {format(new Date(mOption.date), 'MMM dd')}
                  </p>
                  {mOption.description && (
                    <p className={cn("text-[9px] truncate max-w-[120px] mt-1 italic", isActive ? "text-white/85" : "text-gray-400")}>
                      {mOption.description}
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Details list for selected date */}
          {selectedMobileDate ? (
            <div className="bg-gray-50/70 rounded-2xl p-4 border border-gray-100 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <h4 className="text-xs font-black uppercase tracking-widest text-[#008b99]">
                  {format(new Date(selectedMobileDate), 'MMMM dd, yyyy')} Assignments
                </h4>
                {!isPollActive && currentPhase !== 'completed' && (
                  <span className="text-[9px] bg-blue-100 text-blue-700 font-extrabold px-2 py-0.5 rounded-full uppercase">
                    Phase: {currentPhase === 'lector' ? 'Lector/Commentator' : currentPhase.replace('_', ' ')}
                  </span>
                )}
              </div>

              {/* Grid of roles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {getRolesForCurrentPhase(currentPhase).map(role => {
                  const dateAssigns = effectiveAssignments[selectedMobileDate] || {};
                  const assignedUid = Object.keys(dateAssigns).find(uid => dateAssigns[uid] === role);
                  const assignedUser = assignedUid ? (responders.find(r => r.id === assignedUid) || users.find(u => u.uid === assignedUid)) : null;
                  const assignedName = assignedUser ? ('name' in assignedUser ? assignedUser.name : assignedUser.displayName) : '';

                  const isStaged = stagedAssignments[selectedMobileDate]?.[assignedUid || ''] === role;
                  const availableMembers = getAvailableMembersForRole(selectedMobileDate, role);

                  return (
                    <div 
                      key={role}
                      className={cn(
                        "p-3 rounded-xl border bg-white flex flex-col justify-between gap-3 shadow-xs transition-all",
                        assignedUser ? "border-gray-200" : "border-dashed border-gray-200 bg-gray-50/20"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className={cn(
                            "text-[9px] font-bold px-2 py-0.5 rounded-md uppercase border whitespace-nowrap",
                            ROLE_COLORS[role] || "bg-gray-100 text-gray-600 border-gray-200"
                          )}>
                            {role}
                          </span>
                          <p className="text-xs font-bold text-gray-800 mt-2">
                            {assignedUser ? assignedName : (
                              <span className="text-gray-400 italic">Unassigned</span>
                            )}
                          </p>
                        </div>
                        {isStaged && (
                          <span className="text-[8px] bg-orange-100 text-orange-700 font-bold px-1.5 py-0.5 rounded">
                            Staged
                          </span>
                        )}
                      </div>

                      {/* Select Assignee Input */}
                      {canEditCurrentPhase ? (
                        <div className="flex items-center gap-1.5 mt-1 pt-2 border-t border-gray-100">
                          <label className="text-[9px] text-gray-400 font-bold uppercase shrink-0">Assign:</label>
                          <select
                            value={assignedUid || ""}
                            onChange={(e) => handleMobileAssign(selectedMobileDate, e.target.value, role)}
                            className="flex-1 bg-gray-50 hover:bg-gray-100/70 border border-gray-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-gray-700 shadow-3xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#008b99]"
                          >
                            <option value="">-- Choose Member --</option>
                            {availableMembers.map(member => (
                              <option key={member.id} value={member.id}>
                                {member.name}
                              </option>
                            ))}
                            {assignedUser && (
                              <option value="" className="text-red-500 font-bold">❌ Clear Assignment</option>
                            )}
                          </select>
                        </div>
                      ) : (
                        assignedUser && (
                          <div className="text-[9px] text-gray-400 font-medium italic pt-1 border-t border-gray-50">
                            Assignment finalized or locked
                          </div>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-gray-400 italic text-xs">
              No Mass Dates scheduled for this poll.
            </div>
          )}
          
          {/* Spacer so that cards are scrollable above the fixed sticky bar */}
          <div className={cn("transition-all duration-300", isMobileStatsExpanded ? "h-[380px]" : "h-28")} />
          
          {/* Sticky Floating Bottom Panel for Mobile Assignment Counters - Offset to sit cleanly above the mobile bottom navigation bar */}
          <div className="fixed bottom-16 sm:bottom-20 xl:bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200/80 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-all duration-300">
            {/* Header */}
            <div 
              onClick={() => setIsMobileStatsExpanded(!isMobileStatsExpanded)}
              className="px-5 py-3.5 bg-gray-50 flex items-center justify-between cursor-pointer border-b border-gray-100 select-none animate-fade-in"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-[#008b99] tracking-wider uppercase">📊 Assignment Counters</span>
                <span className="bg-[#008b99]/10 text-[#008b99] text-[9px] font-black px-2 py-0.5 rounded-full">
                  {responders.length} Members
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 font-bold">
                  {isMobileStatsExpanded ? "Tap to collapse" : "Tap to expand"}
                </span>
                <ChevronDown 
                  size={16} 
                  className={cn(
                    "text-gray-500 transition-transform duration-300", 
                    isMobileStatsExpanded && "rotate-180"
                  )} 
                />
              </div>
            </div>

            {/* Content */}
            <div className="p-4 bg-white">
              {isMobileStatsExpanded ? (
                /* Expanded: scrollable list of all members and their individual counts */
                <div className="max-h-60 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin">
                  {responders.length === 0 ? (
                    <div className="text-center py-4 text-xs text-gray-400 italic">No responders yet.</div>
                  ) : (
                    responders.map((user) => {
                      const stats = userStats.get(user.id) || { total: 0, lector: 0, commentator: 0, altar: 0, usher: 0, ppt: 0 };
                      return (
                        <div key={user.id} className="flex items-center justify-between border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                          <span className="text-xs font-extrabold text-gray-700 truncate max-w-[150px]">{user.name}</span>
                          <div className="flex gap-1">
                            <span className={cn(
                              "text-[11px] font-black px-2 py-0.5 rounded-md uppercase border",
                              stats.total === 0 ? "bg-gray-50 text-gray-400 border-gray-100" :
                              stats.total === 1 ? "bg-blue-50 text-blue-600 border-blue-100" :
                              "bg-orange-50 text-orange-600 border-orange-100"
                            )}>
                              {stats.total} Total
                            </span>
                            {stats.lector > 0 && <span className="text-[11px] bg-indigo-50 text-indigo-600 font-bold px-1.5 py-0.5 rounded-md">L:{stats.lector}</span>}
                            {stats.commentator > 0 && <span className="text-[11px] bg-pink-50 text-[#008b99] font-bold px-1.5 py-0.5 rounded-md">C:{stats.commentator}</span>}
                            {stats.altar > 0 && <span className="text-[11px] bg-amber-50 text-amber-600 font-bold px-1.5 py-0.5 rounded-md">A:{stats.altar}</span>}
                            {stats.usher > 0 && <span className="text-[11px] bg-emerald-50 text-emerald-600 font-bold px-1.5 py-0.5 rounded-md">U:{stats.usher}</span>}
                            {stats.ppt > 0 && <span className="text-[11px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded-md">P:{stats.ppt}</span>}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                /* Collapsed: single line horizontal scroll row of total counts */
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x">
                  {responders.length === 0 ? (
                    <div className="text-center py-1 text-xs text-gray-400 italic">No responders yet.</div>
                  ) : (
                    responders.map((user) => {
                      const stats = userStats.get(user.id) || { total: 0, lector: 0, commentator: 0, altar: 0, usher: 0, ppt: 0 };
                      return (
                        <div 
                          key={user.id} 
                          className={cn(
                            "snap-center flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border whitespace-nowrap",
                            stats.total === 0 ? "bg-gray-50 text-gray-400 border-gray-100" :
                            stats.total === 1 ? "bg-blue-50/50 text-blue-700 border-blue-100" :
                            "bg-orange-50/50 text-orange-700 border-orange-100"
                          )}
                        >
                          <span className="font-extrabold">{user.name.split(' ')[0]}</span>
                          <span className={cn(
                            "px-2 py-0.5 rounded-md text-[11px] font-black",
                            stats.total === 0 ? "bg-gray-200 text-gray-500" :
                            stats.total === 1 ? "bg-blue-100 text-blue-700" :
                            "bg-orange-100 text-orange-700"
                          )}>
                            {stats.total}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isBroadcastModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]">
            <div className="p-6 bg-[#00e5ff]/10 border-b border-[#00e5ff]/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="text-[#008b99]" size={20} />
                <h4 className="font-black text-[#008b99] uppercase tracking-wider text-sm">Broadcast Assignments</h4>
              </div>
              <button 
                onClick={() => setIsBroadcastModalOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-full transition-all text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-sm text-gray-700">
              {/* Subject */}
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-wider text-gray-500">Email Subject</label>
                <input
                  type="text"
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#008b99] text-gray-800 font-medium"
                  placeholder="Subject line..."
                />
              </div>

              {/* Message */}
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-wider text-gray-500">Email Body Message</label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#008b99] text-gray-800 font-medium"
                  placeholder="Custom announcement details..."
                />
                <p className="text-[10px] text-gray-400">This text will be followed by a button linking directly to the assignments matrix.</p>
              </div>

              {/* Target Selector */}
              <div className="space-y-2 border-t border-gray-100 pt-4">
                <label className="text-xs font-black uppercase tracking-wider text-gray-500 block">Select Recipients</label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 font-bold cursor-pointer text-xs">
                    <input 
                      type="radio" 
                      name="broadcastTarget" 
                      checked={broadcastTarget === 'all'} 
                      onChange={() => setBroadcastTarget('all')}
                      className="text-[#008b99] focus:ring-[#008b99]"
                    />
                    <span>All Assigned</span>
                  </label>
                  <label className="flex items-center gap-2 font-bold cursor-pointer text-xs">
                    <input 
                      type="radio" 
                      name="broadcastTarget" 
                      checked={broadcastTarget === 'committee'} 
                      onChange={() => setBroadcastTarget('committee')}
                      className="text-[#008b99] focus:ring-[#008b99]"
                    />
                    <span>By Committee</span>
                  </label>
                  <label className="flex items-center gap-2 font-bold cursor-pointer text-xs">
                    <input 
                      type="radio" 
                      name="broadcastTarget" 
                      checked={broadcastTarget === 'selected'} 
                      onChange={() => setBroadcastTarget('selected')}
                      className="text-[#008b99] focus:ring-[#008b99]"
                    />
                    <span>Select Individually</span>
                  </label>
                </div>
              </div>

              {/* By Committee controls */}
              {broadcastTarget === 'committee' && (
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-2.5">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Committees</span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'lector', label: 'Lector/Commentator' },
                      { id: 'altar_server', label: 'Altar Server' },
                      { id: 'usher', label: 'Usher' },
                      { id: 'ppt', label: 'PPT' },
                    ].map(comm => (
                      <label key={comm.id} className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-700">
                        <input
                          type="checkbox"
                          checked={selectedCommitteesForBroadcast.includes(comm.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCommitteesForBroadcast(prev => [...prev, comm.id]);
                            } else {
                              setSelectedCommitteesForBroadcast(prev => prev.filter(x => x !== comm.id));
                            }
                          }}
                          className="rounded text-[#008b99] focus:ring-[#008b99]"
                        />
                        <span>{comm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Individual Members selection */}
              {broadcastTarget === 'selected' && (
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Select Members</span>
                    <div className="flex gap-2">
                      <button 
                        type="button" 
                        onClick={() => setSelectedUserIdsForBroadcast(responders.map(r => r.id))}
                        className="text-[10px] text-[#008b99] font-black hover:underline cursor-pointer"
                      >
                        All
                      </button>
                      <span className="text-gray-300">|</span>
                      <button 
                        type="button" 
                        onClick={() => setSelectedUserIdsForBroadcast([])}
                        className="text-[10px] text-gray-400 font-black hover:underline cursor-pointer"
                      >
                        None
                      </button>
                    </div>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                    {responders.map(member => (
                      <label key={member.id} className="flex items-center justify-between cursor-pointer py-1 border-b border-gray-100/50 last:border-0">
                        <span className="text-xs text-gray-700 font-bold">{member.name}</span>
                        <input
                          type="checkbox"
                          checked={selectedUserIdsForBroadcast.includes(member.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUserIdsForBroadcast(prev => [...prev, member.id]);
                            } else {
                              setSelectedUserIdsForBroadcast(prev => prev.filter(x => x !== member.id));
                            }
                          }}
                          className="rounded text-[#008b99] focus:ring-[#008b99]"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-6 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsBroadcastModalOpen(false)}
                className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-600 border border-gray-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBroadcasting}
                onClick={handleBroadcastEmails}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#008b99] hover:bg-[#007a87] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md disabled:opacity-50 cursor-pointer"
              >
                {isBroadcasting ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                <span>{isBroadcasting ? "Sending..." : "Send Broadcast"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
