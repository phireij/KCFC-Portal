import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../App';
import { collection, query, where, getDocs, getDoc, addDoc, updateDoc, doc, serverTimestamp, orderBy, deleteDoc, writeBatch, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Poll, PollResponse, PollStatus, UserProfile } from '../types';
import { cn } from '../lib/utils';
import { CommitteeAssignments } from '../components/CommitteeAssignments';
import { motion } from 'motion/react';
import { CheckCircle2, XCircle, HelpCircle, Calendar, Plus, Trash2, ChevronDown, Play, Pause, Settings, Check, Mail, Loader2, Copy, User, BookOpen, Users, Lock, Share2 } from 'lucide-react';
import { format } from 'date-fns';
import { sendGmail } from '../lib/gmail';

export default function Polls() {
  const { profile, user } = useAuth();
  const [searchParams] = useSearchParams();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userResponses, setUserResponses] = useState<Record<string, PollResponse>>({});
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({});
  const [notifying, setNotifying] = useState<string | null>(null);
  const [showingCreate, setShowingCreate] = useState(false);
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null);
  const [pollResponses, setPollResponses] = useState<Record<string, PollResponse[]>>({});
  const [filter, setFilter] = useState<'latest' | 'all' | 'core' | 'committee'>('latest');
  const [expandedPolls, setExpandedPolls] = useState<Record<string, boolean>>({});
  const [copiedPollId, setCopiedPollId] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const handleSharePoll = (pollId: string, pollTitle: string) => {
    const shareUrl = `${window.location.origin}/?pollId=${pollId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedPollId(pollId);
      setTimeout(() => setCopiedPollId(null), 2000);
    }).catch(err => {
      console.error("[ERROR] Failed to copy deep-link:", err);
      alert(`Could not write to clipboard automatically. Here is the link to copy:\n${shareUrl}`);
    });
  };

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'core_member' as 'core_member' | 'committee',
    createdBy: '',
    massDate: '',
    massDates: [] as { date: string, description?: string }[],
    startDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    endDate: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm"),
  });

  const canManage = (profile?.roles || []).some(r => ['admin', 'president', 'vice_president', 'secretary', 'auditor'].includes(r));
  const canDelete = (profile?.roles || []).some(r => ['admin', 'president'].includes(r));

  useEffect(() => {
    // 1. Listen to users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const fetchedUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
      setUsers(fetchedUsers.filter(u => u.email !== 'kcfc.jp@gmail.com'));
    }, (err) => {
      console.error("Error listening to users in Polls page:", err);
    });

    // 2. Listen to polls
    const q = query(collection(db, 'polls'), orderBy('createdAt', 'desc'));
    const unsubPolls = onSnapshot(q, async (snap) => {
      const fetchedPolls = snap.docs.map(d => ({ id: d.id, ...d.data() } as Poll));
      setPolls(fetchedPolls);

      if (user) {
        // Fetch responses (still one-shot but triggered on poll changes)
        const responses: Record<string, PollResponse> = {};
        const allResponses: Record<string, PollResponse[]> = {};

        for (const poll of fetchedPolls) {
          const respQ = query(collection(db, `polls/${poll.id}/responses`));
          const respSnap = await getDocs(respQ);
          const rawResps = respSnap.docs.map(d => ({ id: d.id, ...d.data() } as PollResponse));
          
          const uniqueRespsMap = new Map<string, PollResponse>();
          for (const r of rawResps) {
            const existing = uniqueRespsMap.get(r.userId);
            if (!existing || new Date(r.submittedAt).getTime() > new Date(existing.submittedAt).getTime()) {
              uniqueRespsMap.set(r.userId, r);
            }
          }
          const resps = Array.from(uniqueRespsMap.values());
          
          allResponses[poll.id] = resps;
          
          const myResp = resps.find(r => r.userId === user.uid);
          if (myResp) {
            responses[poll.id] = myResp;
          }
        }
        setUserResponses(responses);
        setPollResponses(allResponses);
      }
      setLoading(false);

      // Scroll to poll if id is in URL
      const pollId = searchParams.get('id');
      if (pollId) {
        setExpandedPolls(prev => ({ ...prev, [pollId]: true }));
        setTimeout(() => {
          const el = document.getElementById(`poll-${pollId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-2', 'ring-[#5A5A40]', 'ring-offset-4');
            setTimeout(() => el.classList.remove('ring-2', 'ring-[#5A5A40]', 'ring-offset-4'), 3000);
          }
        }, 500);
      }
    }, (err) => {
      console.error("Error listening to polls in Polls page:", err);
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubPolls();
    };
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || formSubmitting) return;

    if (formData.category === 'core_member') {
      const duplicate = polls.find(p => p.category === formData.category && p.massDate === formData.massDate && (!editingPoll || p.id !== editingPoll.id));
      if (duplicate) {
        alert(`A poll for the Mass date ${formData.massDate} already exists in this category.`);
        return;
      }
    }

    setFormSubmitting(true);

    try {
      const isDraft = (e.nativeEvent as any).submitter?.name === 'draft';
      const dataToSave = {
        ...formData,
        isMultiSelect: formData.category === 'committee',
        type: 'weekly',
        status: editingPoll ? editingPoll.status : (isDraft ? 'draft' : 'active'),
        createdBy: user?.uid,
        creatorName: profile?.displayName,
        updatedAt: serverTimestamp()
      };

      if (editingPoll) {
        const isStarted = editingPoll.status !== 'draft' && new Date() >= new Date(editingPoll.startDate);
        if (isStarted) {
          if (new Date(formData.endDate) < new Date()) {
            alert("End date cannot be set earlier than the current time for an active poll.");
            setFormSubmitting(false);
            return;
          }
        }

        await updateDoc(doc(db, 'polls', editingPoll.id), dataToSave);
        setPolls(prev => prev.map(p => p.id === editingPoll.id ? { ...p, ...dataToSave } as Poll : p));
      } else {
        const docRef = await addDoc(collection(db, 'polls'), {
          ...dataToSave,
          createdAt: serverTimestamp()
        });

        // Create notifications for all users (or targeted users) - ONLY if not draft
        if (!isDraft) {
          try {
            const usersSnap = await getDocs(collection(db, 'users'));
            const batch = writeBatch(db);
            usersSnap.docs.forEach(userDoc => {
              const userData = userDoc.data();
              if (userData.isDisabled) return;
              if (!userData.isVerified) return;

              // Target logic
              let shouldNotify = false;
              if (formData.category === 'core_member') {
                shouldNotify = !!userData.isCoreMember;
              } else if (formData.category === 'committee') {
                const committeeRoles = ['lector_commentator_leader', 'usher_leader', 'altar_server_leader'];
                const committeeMinistries = ['lector_commentator', 'usher', 'altar_server'];
                const userRoles = userData.roles || [];
                const userMinistries = userData.ministries || [];
                shouldNotify = userRoles.some((r: string) => committeeRoles.includes(r)) || userMinistries.some((m: string) => committeeMinistries.includes(m));
              }

              if (shouldNotify) {
                const notificationRef = doc(collection(db, 'notifications'));
                batch.set(notificationRef, {
                  userId: userDoc.id,
                  title: `New ${formData.category === 'core_member' ? 'Core Group' : formData.category === 'committee' ? 'Committee' : 'Community'} Poll`,
                  message: `New poll published: ${formData.title}`,
                  type: 'system',
                  status: 'unread',
                  link: '/polls',
                  createdAt: serverTimestamp()
                });
              }
            });
            await batch.commit();
          } catch (err) {
            console.error("Failed to create notifications", err);
          }
        }

        const newPollRecord: Poll = {
          id: docRef.id,
          ...dataToSave,
          createdAt: new Date().toISOString()
        } as unknown as Poll;
        setPolls(prev => [newPollRecord, ...prev]);
      }
      setShowingCreate(false);
      setEditingPoll(null);
      setFormData({ 
        title: '', 
        description: '', 
        category: 'core_member' as 'core_member' | 'committee', 
        createdBy: '',
        massDate: '', 
        massDates: [] as { date: string, description?: string }[], 
        startDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"), 
        endDate: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm") 
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'polls');
    } finally {
      setFormSubmitting(false);
    }
  };

  const checkAndNotifyCoreCompletion = async (pollId: string) => {
    try {
      const pollRef = doc(db, 'polls', pollId);
      const pollSnap = await getDoc(pollRef);
      if (!pollSnap.exists()) return;
      const pollData = pollSnap.data() as Poll;

      // Get all active, verified, enabled users excluding kcfc.jp@gmail.com
      const usersSnap = await getDocs(collection(db, 'users'));
      const activeUsers = usersSnap.docs
        .map(d => ({ uid: d.id, ...d.data() } as UserProfile))
        .filter(u => !u.isDisabled && u.isVerified && u.email !== 'kcfc.jp@gmail.com');

      let eligibleUids: string[] = [];
      if (pollData.category === 'core_member') {
        eligibleUids = activeUsers.filter(u => u.isCoreMember).map(u => u.uid);
      } else if (pollData.category === 'committee') {
        eligibleUids = activeUsers
          .filter(u => u.ministries?.some(m => ['lector_commentator', 'usher', 'altar_server', 'ppt'].includes(m)))
          .map(u => u.uid);
      } else {
        eligibleUids = activeUsers.map(u => u.uid);
      }

      if (eligibleUids.length === 0) return;

      // Get all responses
      const respQ = collection(db, `polls/${pollId}/responses`);
      const respSnap = await getDocs(respQ);
      const respondedUids = new Set(
        respSnap.docs
          .map(d => d.data() as PollResponse)
          .filter(r => r.attendance !== null && r.attendance !== undefined)
          .map(r => r.userId)
      );

      // Check if all eligible members have responded
      const allDone = eligibleUids.every(uid => respondedUids.has(uid));

      if (allDone) {
        // Find admins & presidents to notify
        const adminsSnap = await getDocs(collection(db, 'users'));
        const adminUsers = adminsSnap.docs.filter(d => {
          const roles = d.data().roles || [];
          return roles.includes('admin') || roles.includes('president');
        });

        const notifyUids = new Set<string>();
        if (pollData.createdBy) notifyUids.add(pollData.createdBy);
        adminUsers.forEach(d => notifyUids.add(d.id));

        const batch = writeBatch(db);
        notifyUids.forEach(uid => {
          const notificationRef = doc(collection(db, 'notifications'));
          batch.set(notificationRef, {
            userId: uid,
            title: `Poll Response Completed`,
            message: `All eligible members have responded to: "${pollData.title}". You can now close the poll and review results.`,
            type: 'system',
            status: 'unread',
            link: pollData.category === 'core_member' ? '/duties?tab=core' : '/duties?tab=liturgical',
            createdAt: serverTimestamp()
          });
        });
        await batch.commit();
      }
    } catch (err) {
      console.error("Error in checkAndNotifyCoreCompletion", err);
    }
  };

  const handleResponse = async (pollId: string, attendance?: 'yes' | 'no' | 'maybe', selectedOption?: string, toiletOk?: boolean) => {
    if (!user || !profile || isSubmitting[pollId]) return;
    if (user.email?.toLowerCase() === 'kcfc.jp@gmail.com' || profile.email?.toLowerCase() === 'kcfc.jp@gmail.com') {
      alert("As the primary administrator, you are excluded from public poll participation.");
      return;
    }
    
    setIsSubmitting(prev => ({ ...prev, [pollId]: true }));
    
    try {
      const poll = polls.find(p => p.id === pollId);
      if (!poll || poll.status !== 'active') {
        setIsSubmitting(prev => ({ ...prev, [pollId]: false }));
        return;
      }

      const now = new Date();
      // Allow a 5-minute grace period for "not started" to account for clock skew
      const pollStart = new Date(poll.startDate);
      if (now < new Date(pollStart.getTime() - 5 * 60000)) {
        alert("This poll has not started yet.");
        setIsSubmitting(prev => ({ ...prev, [pollId]: false }));
        return;
      }
      if (now > new Date(poll.endDate)) {
        alert("This poll has ended.");
        setIsSubmitting(prev => ({ ...prev, [pollId]: false }));
        return;
      }

      const existingResp = userResponses[pollId];
      let newSelectedOptions = existingResp?.selectedOptions || [];
      let newAttendance = attendance || existingResp?.attendance || null;
      let newToiletOk = toiletOk !== undefined ? toiletOk : (existingResp?.toiletOk || false);

      // Deselect and Change confirmations logic
      const isDeselect = existingResp && existingResp.attendance && existingResp.attendance === attendance;
      const isChange = existingResp && existingResp.attendance && existingResp.attendance !== attendance;

      if (isDeselect) {
        const confirmed = window.confirm("Are you sure you want to deselect your response and remove your RSVP?");
        if (!confirmed) {
          setIsSubmitting(prev => ({ ...prev, [pollId]: false }));
          return;
        }
        newAttendance = null;
      } else if (isChange) {
        const confirmed = window.confirm(`Are you sure you want to change your response from "${existingResp.attendance.toUpperCase()}" to "${attendance?.toUpperCase()}"?`);
        if (!confirmed) {
          setIsSubmitting(prev => ({ ...prev, [pollId]: false }));
          return;
        }
        newAttendance = attendance || null;
      } else {
        newAttendance = attendance || null;
      }

      if (poll.isMultiSelect && selectedOption) {
        if (newSelectedOptions.includes(selectedOption)) {
          newSelectedOptions = newSelectedOptions.filter(o => o !== selectedOption);
        } else {
          newSelectedOptions = [...newSelectedOptions, selectedOption];
        }
      }

      const responseData: PollResponse = {
        pollId,
        userId: user.uid,
        userDisplayName: profile.displayName,
        attendance: newAttendance as any,
        selectedOptions: newSelectedOptions,
        toiletOk: newToiletOk,
        submittedAt: new Date().toISOString()
      };

      if (existingResp?.id) {
        await updateDoc(doc(db, `polls/${pollId}/responses`, existingResp.id), {
          attendance: newAttendance,
          selectedOptions: newSelectedOptions,
          toiletOk: newToiletOk,
          submittedAt: serverTimestamp()
        });
      } else {
        const newDoc = await addDoc(collection(db, `polls/${pollId}/responses`), {
          ...responseData,
          attendance: newAttendance,
          toiletOk: newToiletOk,
          submittedAt: serverTimestamp()
        });
        responseData.id = newDoc.id;
      }

      setUserResponses(prev => ({
        ...prev,
        [pollId]: { ...responseData, id: existingResp?.id || responseData.id } as PollResponse
      }));

      setPollResponses(prev => {
        const current = prev[pollId] || [];
        const filtered = current.filter(r => r.userId !== user.uid);
        return {
          ...prev,
          [pollId]: [...filtered, { ...responseData, id: existingResp?.id || responseData.id }]
        };
      });

      // Call completion notifier after writing response
      await checkAndNotifyCoreCompletion(pollId);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `polls/${pollId}/responses`);
    } finally {
      setIsSubmitting(prev => ({ ...prev, [pollId]: false }));
    }
  };

  const togglePollStatus = async (pollId: string, currentStatus: PollStatus) => {
    let nextStatus: PollStatus;
    if (currentStatus === 'draft') {
      nextStatus = 'active';
    } else {
      nextStatus = currentStatus === 'active' ? 'closed' : 'active';
    }

    try {
      await updateDoc(doc(db, 'polls', pollId), { status: nextStatus, updatedAt: serverTimestamp() });
      
      const updatedPoll = polls.find(p => p.id === pollId);
      if (updatedPoll) {
        setPolls(prev => prev.map(p => p.id === pollId ? { ...p, status: nextStatus } : p));

        // If poll is closed and it is a core_member poll, notify creator & admin/president
        if (nextStatus === 'closed' && updatedPoll.category === 'core_member') {
          try {
            const usersQ = query(collection(db, 'users'));
            const usersSnap = await getDocs(usersQ);
            const adminOrPres = usersSnap.docs.filter(d => {
              const roles = d.data().roles || [];
              return roles.includes('admin') || roles.includes('president');
            });
            const notifyUids = new Set<string>();
            if (updatedPoll.createdBy) notifyUids.add(updatedPoll.createdBy);
            adminOrPres.forEach(d => notifyUids.add(d.id));

            const batch = writeBatch(db);
            notifyUids.forEach(uid => {
              const notificationRef = doc(collection(db, 'notifications'));
              batch.set(notificationRef, {
                userId: uid,
                title: 'Chore Poll Closed',
                message: `Chore committee poll "${updatedPoll.title}" has been successfully closed. You can proceed with duty assignments.`,
                type: 'system',
                status: 'unread',
                link: '/duties',
                createdAt: serverTimestamp()
              });
            });
            await batch.commit();
          } catch (err) {
            console.error("Failed to notify on chore poll close", err);
          }
        }

        // If move from draft to active, send notifications
        if (currentStatus === 'draft' && nextStatus === 'active') {
          try {
            const usersSnap = await getDocs(collection(db, 'users'));
            const batch = writeBatch(db);
            usersSnap.docs.forEach(userDoc => {
              const userData = userDoc.data();
              if (userData.isDisabled || !userData.isVerified) return;

              let shouldNotify = false;
              if (updatedPoll.category === 'core_member') {
                shouldNotify = !!userData.isCoreMember;
              } else if (updatedPoll.category === 'committee') {
                const committeeRoles = ['lector_commentator_leader', 'usher_leader', 'altar_server_leader'];
                const committeeMinistries = ['lector_commentator', 'usher', 'altar_server'];
                const userRoles = userData.roles || [];
                const userMinistries = userData.ministries || [];
                shouldNotify = userRoles.some((r: string) => committeeRoles.includes(r)) || userMinistries.some((m: string) => committeeMinistries.includes(m));
              }

              if (shouldNotify) {
                const notificationRef = doc(collection(db, 'notifications'));
                batch.set(notificationRef, {
                  userId: userDoc.id,
                  title: `New ${updatedPoll.category === 'core_member' ? 'Core Group' : updatedPoll.category === 'committee' ? 'Committee' : 'Community'} Poll`,
                  message: `New poll published: ${updatedPoll.title}`,
                  type: 'system',
                  status: 'unread',
                  link: '/polls',
                  createdAt: serverTimestamp()
                });
              }
            });
            await batch.commit();
          } catch (err) {
            console.error("Failed to create notifications on publish", err);
          }
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'polls');
    }
  };

  const deletePoll = async (pollId: string) => {
    if (!canDelete) return;
    const poll = polls.find(p => p.id === pollId);
    if (!poll) return;
    
    // Check for assignments in the poll object
    const hasAssignments = poll.assignments && Object.keys(poll.assignments).length > 0;
    
    // Check for duties linked to this poll
    let hasDuties = false;
    let dutiesSnap: any = null;
    try {
      const dutiesQ = query(collection(db, 'duties'), where('pollId', '==', poll.id));
      dutiesSnap = await getDocs(dutiesQ);
      hasDuties = !dutiesSnap.empty;
    } catch (e) {
      console.error("Checking duties failed", e);
    }

    let confirmMessage = "Are you sure you want to delete this poll? All responses will be permanently removed.";
    if (hasAssignments || hasDuties) {
      confirmMessage = "WARNING: This poll has active liturgical or chore assignments linked to it. If you proceed, all linked assignments and duties will be permanently deleted as well. Are you sure you want to proceed and delete this poll?";
    }
    
    if (!confirm(confirmMessage)) return;
    
    try {
      if (hasDuties && dutiesSnap && !dutiesSnap.empty) {
        const batch = writeBatch(db);
        dutiesSnap.docs.forEach((docSnap: any) => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
      }
      
      await deleteDoc(doc(db, 'polls', pollId));
      setPolls(prev => prev.filter(p => p.id !== pollId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'polls');
    }
  };

  const startEditing = (poll: Poll) => {
    const isCreator = poll.createdBy === user?.uid;
    if (poll.status !== 'draft' && new Date() >= new Date(poll.startDate) && !isCreator) {
      alert("This poll has already started and cannot be edited.");
      return;
    }
    setEditingPoll(poll);
    setFormData({
      title: poll.title,
      description: poll.description,
      category: (poll.category as any) || 'core_member',
      createdBy: poll.createdBy || '',
      massDate: poll.massDate || '',
      massDates: poll.massDates || [],
      startDate: (poll.startDate || '').substring(0, 16),
      endDate: (poll.endDate || '').substring(0, 16),
    });
    setShowingCreate(true);
  };

  const handleDuplicatePoll = (poll: Poll) => {
    setEditingPoll(null); // It's a new poll
    setFormData({
      title: `${poll.title} (Copy)`,
      description: poll.description,
      category: (poll.category as any) || 'core_member',
      createdBy: user?.uid || '',
      massDate: poll.massDate || '',
      massDates: poll.massDates || [],
      startDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      endDate: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm"),
    });
    setShowingCreate(true);
  };

  const safeFormat = (dateStr: string | undefined, formatStr: string) => {
    if (!dateStr) return 'TBA';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Invalid Date';
      return format(d, formatStr);
    } catch {
      return 'Invalid Date';
    }
  };

  const handleNotifyMembers = async (poll: Poll) => {
    if (!canManage) return;
    if (notifying) return;
    
    const clientId = (import.meta as any).env.VITE_CLIENT_ID;
    if (!clientId) {
      alert("Gmail integration is not configured. Please add VITE_CLIENT_ID to your environment variables (Secrets) to enable notifications.");
      return;
    }

    if (!confirm(`This will send an email notification to all verified community members about the poll: "${poll.title}". Continue?`)) return;

    setNotifying(poll.id);
    try {
      // 1. Fetch all verified members
      const q = query(collection(db, 'users'), where('isVerified', '==', true));
      const snap = await getDocs(q);
      const members = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)).filter(m => !!m.email);

      if (members.length === 0) {
        alert("No verified members with email addresses found.");
        return;
      }

      // 2. Prepare email content
      const massDateFormatted = safeFormat(poll.massDate, 'EEEE, MMM dd');
      const subject = `[KCFC] Pre-attendance Poll: ${poll.title}`;
      const baseUrl = window.location.origin;
      
      const body = `
        <div style="font-family: serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 20px; overflow: hidden;">
          <div style="background-color: #5A5A40; color: white; padding: 40px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px; font-weight: normal;">KCFC Attendance Poll</h1>
            <p style="margin-top: 10px; font-style: italic; opacity: 0.9;">Holy Mass: ${massDateFormatted}</p>
          </div>
          <div style="padding: 40px; line-height: 1.6;">
            <p>Dear Community Member,</p>
            <p>A new attendance poll has been published for the upcoming Mass.</p>
            <div style="background-color: #f9f9f9; padding: 20px; border-radius: 10px; margin: 20px 0;">
              <h2 style="margin: 0 0 10px 0; color: #5A5A40;">${poll.title}</h2>
              <p style="margin: 0; color: #666; font-style: italic;">${poll.description || 'Please record your attendance to help us with planning.'}</p>
            </div>
            <p style="text-align: center; margin: 40px 0;">
              <a href="${baseUrl}/polls" style="background-color: #5A5A40; color: white; padding: 15px 30px; text-decoration: none; border-radius: 10px; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">
                Respond to Poll
              </a>
            </p>
            <p style="font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 20px; margin-top: 40px;">
              This is an automated notification from the KCFC Portal.
            </p>
          </div>
        </div>
      `;

      // 3. Send emails
      let successCount = 0;
      let failErrors: string[] = [];

      for (const member of members) {
        try {
          await sendGmail(member.email!, subject, body);
          successCount++;
        } catch (err: any) {
          console.error(`Failed to send email to ${member.email}`, err);
          failErrors.push(`${member.email}: ${err.message || 'Unknown error'}`);
        }
      }

      if (failErrors.length > 0) {
        alert(`Notifications results:\n\nSuccessful: ${successCount}\nFailed: ${failErrors.length}\n\nErrors:\n${failErrors.slice(0, 3).join('\n')}${failErrors.length > 3 ? '\n...' : ''}`);
      } else {
        alert(`Notifications sent successfully to ${successCount} members!`);
      }
    } catch (err: any) {
      console.error("Notification process failed", err);
      alert("Failed to complete notification process. Please check your console for details.");
    } finally {
      setNotifying(null);
    }
  };

  const filteredPolls = polls
    .filter(poll => {
      // Priority filters
      if (filter === 'core') return poll.category === 'core_member';
      if (filter === 'committee') return poll.category === 'committee';
      
      const isManager = (profile?.roles || []).some(r => ['admin', 'president', 'vice_president', 'secretary', 'auditor'].includes(r));
      if (poll.status === 'draft') return isManager;
      
      // Standard visibility
      if (isManager) return true;
      if (poll.category === 'core_member') return profile?.isCoreMember;
      
      const committeeMinistries = ['lector_commentator', 'usher', 'altar_server', 'ppt'];
      const isCommitteeMember = profile?.ministries?.some(m => committeeMinistries.includes(m));
      return poll.category === 'committee' ? isCommitteeMember : true;
    })
    .slice(0, filter === 'latest' ? 2 : undefined);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-gray-900 dark:text-white">Attendance Polls</h1>
          <p className="text-gray-500 dark:text-gray-400 font-serif italic text-sm">Respond to attendance requests for the Holy Mass.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-white dark:bg-[#1e1e1a] p-1 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm flex items-center">
            {[
              { id: 'latest', label: 'Latest' },
              { id: 'all', label: 'All' },
              { id: 'core', label: 'Chores' },
              { id: 'committee', label: 'Liturgical' }
            ].map((f) => (
              <button
                 key={f.id}
                 onClick={() => {
                   setFilter(f.id as any);
                   setExpandedPolls({});
                 }}
                 className={cn(
                   "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                   filter === f.id 
                     ? "bg-[#5A5A40] dark:bg-[#8a8a65] text-white dark:text-[#11110f] shadow-md" 
                     : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#252520]"
                 )}
              >
                {f.label}
              </button>
            ))}
          </div>
          {canManage && (
            <button 
              onClick={() => {
                setEditingPoll(null);
                setFormData({ 
                  title: '', 
                  description: '', 
                  category: 'core_member' as 'core_member' | 'committee', 
                  createdBy: '',
                  massDate: '', 
                  massDates: [] as { date: string, description?: string }[], 
                  startDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"), 
                  endDate: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm") 
                });
                setShowingCreate(true);
              }}
              className="flex items-center gap-2 px-6 py-3 bg-[#5A5A40] dark:bg-[#8a8a65] text-white dark:text-[#11110f] rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-[#4a4a35] dark:hover:bg-[#9a9a70] transition-all shadow-lg cursor-pointer"
            >
              <Plus size={18} />
              Create
            </button>
          )}
        </div>
      </div>

      {showingCreate && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-[#1e1e1a] p-8 rounded-[40px] shadow-xl border border-gray-100 dark:border-white/5"
        >
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-serif text-gray-900 dark:text-white">{editingPoll ? 'Edit Poll' : 'Create Pre-attendance Poll'}</h2>
            <button onClick={() => setShowingCreate(false)} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-400">
              <ChevronDown size={24} className="rotate-90" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-4">Poll Category</label>
                <select
                  required
                  disabled={!!editingPoll && editingPoll.status !== 'draft' && new Date() >= new Date(editingPoll.startDate)}
                  className="w-full px-6 py-4 bg-gray-50 dark:bg-[#252520] text-gray-900 dark:text-white border-none rounded-2xl focus:ring-2 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] transition-all disabled:opacity-50"
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value as any })}
                >
                  <option value="core_member">Chore Committee (Single Mass)</option>
                  <option value="committee">Liturgical Committee (Multi-Mass)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-4">
                  Poll Title
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-6 py-4 bg-gray-50 dark:bg-[#252520] text-gray-900 dark:text-white border-none rounded-2xl focus:ring-2 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] outline-none transition-all"
                  placeholder={formData.category === 'committee' ? "e.g. Lector & Altar Server Schedule" : "e.g. Sunday Mass Community Attendance"}
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-4">Description</label>
              <textarea
                className="w-full px-6 py-4 bg-gray-50 dark:bg-[#252520] text-gray-900 dark:text-white border-none rounded-2xl focus:ring-2 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] outline-none transition-all min-h-[100px]"
                placeholder="Optional description or instructions..."
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {formData.category === 'committee' ? (
              <div className="space-y-4">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-4">Mass Dates & Descriptions (Multiple)</label>
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="date"
                      id="new-mass-date"
                      className="w-full sm:w-1/3 px-6 py-4 bg-gray-50 dark:bg-[#252520] text-gray-900 dark:text-white border-none rounded-2xl focus:ring-2 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] outline-none transition-all"
                    />
                    <input
                      type="text"
                      id="new-mass-desc"
                      placeholder="Optional description (e.g. 7:00 AM Mass)"
                      className="flex-1 px-6 py-4 bg-gray-50 dark:bg-[#252520] text-gray-900 dark:text-white border-none rounded-2xl focus:ring-2 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const dateInput = document.getElementById('new-mass-date') as HTMLInputElement;
                        const descInput = document.getElementById('new-mass-desc') as HTMLInputElement;
                        if (dateInput.value && !formData.massDates.find(d => d.date === dateInput.value)) {
                          setFormData({ 
                            ...formData, 
                            massDates: [...formData.massDates, { date: dateInput.value, description: descInput.value }].sort((a, b) => a.date.localeCompare(b.date)) 
                          });
                          dateInput.value = '';
                          descInput.value = '';
                        }
                      }}
                      className="px-6 py-4 bg-[#5A5A40] dark:bg-[#8a8a65] text-white dark:text-[#11110f] rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-[#4a4a35] dark:hover:bg-[#9a9a70] transition-colors cursor-pointer"
                    >
                      Add Date
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 px-2">
                  {formData.massDates.map((item, idx) => (
                    <div key={idx} className="p-3 bg-[#5A5A40]/10 dark:bg-[#8a8a65]/10 text-[#5A5A40] dark:text-[#8a8a65] rounded-2xl flex flex-col sm:flex-row items-center gap-3">
                      <input 
                        type="date"
                        value={item.date}
                        className="w-full sm:w-1/3 px-4 py-2 bg-white/50 dark:bg-[#1e1e1a]/50 text-gray-900 dark:text-white border-none rounded-xl focus:ring-2 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] outline-none text-sm transition-all"
                        onChange={(e) => {
                          const newDates = [...formData.massDates];
                          newDates[idx].date = e.target.value;
                          setFormData({ ...formData, massDates: newDates });
                        }}
                      />
                      <input 
                        type="text"
                        value={item.description || ''}
                        placeholder="Description..."
                        className="flex-1 w-full px-4 py-2 bg-white/50 dark:bg-[#1e1e1a]/50 text-gray-900 dark:text-white border-none rounded-xl focus:ring-2 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] outline-none text-sm transition-all"
                        onChange={(e) => {
                          const newDates = [...formData.massDates];
                          newDates[idx].description = e.target.value;
                          setFormData({ ...formData, massDates: newDates });
                        }}
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        <button 
                          type="button"
                          onClick={() => setFormData({ ...formData, massDates: [...formData.massDates, { ...item }] })}
                          className="hover:text-[#5A5A40] dark:hover:text-[#8a8a65] text-gray-400 p-2 shrink-0 transition-all cursor-pointer"
                          title="Duplicate"
                        >
                          <Copy size={16} />
                        </button>
                        <button 
                          type="button"
                          onClick={() => setFormData({ ...formData, massDates: formData.massDates.filter((_, i) => i !== idx) })}
                          className="hover:text-red-500 p-2 shrink-0 transition-all cursor-pointer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {formData.massDates.length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic">No mass dates added yet.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-4">Date of the Mass</label>
                  <input
                    type="date"
                    required
                    className="w-full px-6 py-4 bg-gray-50 dark:bg-[#252520] text-gray-900 dark:text-white border-none rounded-2xl focus:ring-2 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] outline-none transition-all"
                    value={formData.massDate}
                    onChange={e => setFormData({ ...formData, massDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-4">Poll Options</label>
                  <div className="px-6 py-4 bg-gray-100 dark:bg-[#252520] text-gray-400 dark:text-gray-500 text-sm rounded-2xl font-italic">
                    Default: Yes / No / Maybe
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-4">Start of Poll</label>
                <input
                  type="datetime-local"
                  required
                  disabled={!!editingPoll && editingPoll.status !== 'draft' && new Date() >= new Date(editingPoll.startDate)}
                  className="w-full px-6 py-4 bg-gray-50 dark:bg-[#252520] text-gray-900 dark:text-white border-none rounded-2xl focus:ring-2 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] outline-none transition-all disabled:opacity-50"
                  value={formData.startDate}
                  onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-4">End of Poll</label>
                <input
                  type="datetime-local"
                  required
                  className="w-full px-6 py-4 bg-gray-50 dark:bg-[#252520] text-gray-900 dark:text-white border-none rounded-2xl focus:ring-2 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] outline-none transition-all"
                  value={formData.endDate}
                  onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-4">
              {!editingPoll || editingPoll.status === 'draft' ? (
                <>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="flex-1 py-4 bg-[#5A5A40] dark:bg-[#8a8a65] text-white dark:text-[#11110f] rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg hover:bg-[#4a4a35] dark:hover:bg-[#9a9a70] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {formSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Publishing...
                      </>
                    ) : (
                      'Publish Poll'
                    )}
                  </button>
                  <button
                    type="submit"
                    name="draft"
                    value="draft"
                    disabled={formSubmitting}
                    className="flex-1 py-4 bg-white dark:bg-[#1e1e1a] text-[#5A5A40] dark:text-[#8a8a65] border-2 border-[#5A5A40] dark:border-[#8a8a65]/50 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-[#5A5A40]/5 dark:hover:bg-[#8a8a65]/5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {formSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save as Draft'
                    )}
                  </button>
                </>
              ) : (
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex-1 py-4 bg-[#5A5A40] dark:bg-[#8a8a65] text-white dark:text-[#11110f] rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg hover:bg-[#4a4a35] dark:hover:bg-[#9a9a70] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {formSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Poll'
                  )}
                </button>
              )}
              <button
                type="button"
                disabled={formSubmitting}
                onClick={() => setShowingCreate(false)}
                className="px-8 py-4 bg-gray-100 dark:bg-[#252520] text-gray-400 dark:text-gray-500 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-gray-200 dark:hover:bg-gray-700 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {loading ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-500 font-serif italic">Loading community polls...</div>
      ) : filteredPolls.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-[#1e1e1a] rounded-[40px] border border-dashed border-gray-200 dark:border-white/10">
          <Calendar className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-4" />
          <p className="text-gray-400 dark:text-gray-500 font-serif italic">No poll found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8">
          {filteredPolls.map(poll => {
            const hasVoted = !!userResponses[poll.id] && (
              poll.category === 'committee'
                ? (Array.isArray(userResponses[poll.id].selectedOptions) && userResponses[poll.id].selectedOptions.length > 0)
                : (userResponses[poll.id].attendance !== null && userResponses[poll.id].attendance !== undefined)
            );
            const now = new Date();
            const start = new Date(poll.startDate);
            const end = new Date(poll.endDate);
            const mass = new Date(poll.massDate);
            
            const isFinished = now > end;
            const notStarted = now < new Date(start.getTime() - 5 * 60000);
            const isActive = poll.status === 'active' && !isFinished && !notStarted;
            const isDraft = poll.status === 'draft';

            // Calculate non-responded (pending) users
            const respondedUserIds = new Set(
              (pollResponses[poll.id] || [])
                .filter(r => 
                  poll.category === 'committee'
                    ? (Array.isArray(r.selectedOptions) && r.selectedOptions.length > 0)
                    : (r.attendance !== null && r.attendance !== undefined)
                )
                .map(r => r.userId)
            );
            const eligibleUsers = (poll.category === 'core_member'
              ? users.filter(u => u.isCoreMember && !u.isDisabled && u.isVerified)
              : poll.category === 'committee'
                ? users.filter(u => u.ministries?.some(m => ['lector_commentator', 'usher', 'altar_server', 'ppt'].includes(m)) && !u.isDisabled && u.isVerified)
                : users.filter(u => !u.isDisabled && u.isVerified)
            ).filter(u => u.email !== 'kcfc.jp@gmail.com');
            const pendingUsers = eligibleUsers.filter(u => !respondedUserIds.has(u.uid));
            const isAdminOrPresident = (profile?.roles || []).some(r => ['admin', 'president'].includes(r)) || profile?.email === 'kcfc.jp@gmail.com';
            const isPollCreator = poll.createdBy === user?.uid;
            const showPendingList = isAdminOrPresident || isPollCreator;

            return (
              <motion.div
                key={poll.id}
                id={`poll-${poll.id}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                   "bg-white dark:bg-[#1e1e1a] rounded-[40px] shadow-sm border border-gray-100 dark:border-white/5 transition-all overflow-hidden",
                   (!isActive && !isDraft) && "opacity-80",
                   isDraft && "border-dashed border-[#5A5A40]/30 dark:border-[#8a8a65]/40"
                )}
              >
                <button 
                  onClick={() => setExpandedPolls(prev => ({ ...prev, [poll.id]: !prev[poll.id] }))}
                  className="w-full p-8 md:p-10 flex flex-col md:flex-row md:items-start justify-between gap-6 hover:bg-gray-50/50 dark:hover:bg-[#252520]/20 transition-all text-left pointer"
                >
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest",
                        poll.category === 'core_member' ? "bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400" :
                        poll.category === 'committee' ? "bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400" :
                        "bg-[#5A5A40]/10 dark:bg-[#8a8a65]/10 text-[#5A5A40] dark:text-[#8a8a65]"
                      )}>
                        {poll.category === 'core_member' ? 'Chore Committee' : 
                         poll.category === 'committee' ? 'Liturgical Committee' : 'Community'}
                      </span>
                      {poll.category === 'committee' && (
                        <a
                          href={`/duties?tab=liturgical&pollId=${poll.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-md flex items-center gap-1.5 active:scale-95 duration-150 whitespace-nowrap"
                        >
                          <BookOpen size={11} />
                          View Matrix In Duties
                        </a>
                      )}
                      {poll.category === 'core_member' && (
                        <a
                          href={`/duties?tab=core&pollId=${poll.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest bg-orange-600 text-white hover:bg-orange-700 transition-all shadow-md flex items-center gap-1.5 active:scale-95 duration-150 whitespace-nowrap"
                        >
                          <Users size={11} />
                          View Matrix In Duties
                        </a>
                      )}
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest",
                        isDraft ? "bg-gray-100 dark:bg-gray-800 text-gray-400" :
                        notStarted ? "bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400" :
                        isActive ? "bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400" :
                        "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400"
                      )}>
                        {isDraft ? 'Draft' :
                         notStarted ? `Starts ${safeFormat(poll.startDate, 'MMM dd HH:mm')}` :
                         isActive ? 'Active' :
                         isFinished ? 'Finished' : 'Paused'}
                      </span>
                      {isActive && pendingUsers.length === 0 && showPendingList && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (window.confirm(`All expected members have responded! Would you like to close the poll "${poll.title}" now?`)) {
                              await togglePollStatus(poll.id, 'active');
                            }
                          }}
                          className="px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-widest bg-amber-500 hover:bg-amber-600 text-white transition-all shadow-md flex items-center gap-1 active:scale-95 duration-150 whitespace-nowrap animate-pulse cursor-pointer"
                          title="Click to Close Poll"
                        >
                          <Lock size={10} />
                          Close Poll Now
                        </button>
                      )}
                      {poll.category !== 'committee' && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                          <Calendar size={12} />
                          Mass: <strong className="text-gray-900 dark:text-[#f5f5f0]">{safeFormat(poll.massDate, 'EEEE, MMM dd, yyyy')}</strong>
                        </span>
                      )}
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold flex items-center gap-1">
                         {expandedPolls[poll.id] ? <ChevronDown size={14} /> : <ChevronDown size={14} className="-rotate-90" />}
                         {expandedPolls[poll.id] ? 'Hide Details' : 'View Details'}
                      </span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{poll.title}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic font-serif leading-relaxed line-clamp-1">{poll.description || `Pre-attendance for Mass on ${safeFormat(poll.massDate, 'MMM dd')}`}</p>
                  </div>
                  
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    {/* Share Poll Deep Link Button */}
                    <button
                      onClick={() => handleSharePoll(poll.id, poll.title)}
                      className={cn(
                        "p-3 rounded-2xl transition-all active:scale-95 flex items-center justify-center cursor-pointer",
                        copiedPollId === poll.id
                          ? "text-green-600 dark:text-green-400 bg-green-500/10"
                          : "text-gray-400 dark:text-gray-500 hover:text-[#5A5A40] dark:hover:text-[#8a8a65] hover:bg-gray-100 dark:hover:bg-[#252520]"
                      )}
                      title="Copy Share Link"
                    >
                      {copiedPollId === poll.id ? (
                        <Check size={20} />
                      ) : (
                        <Share2 size={20} />
                      )}
                    </button>

                    {canManage && (
                      <>
                       <button
                        onClick={() => handleNotifyMembers(poll)}
                        disabled={!!notifying}
                        className={cn(
                          "p-3 rounded-2xl transition-all relative overflow-hidden",
                          notifying === poll.id 
                            ? "text-[#5A5A40] dark:text-[#8a8a65] bg-[#5A5A40]/10" 
                            : "text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-[#252520] active:scale-95"
                        )}
                        title="Notify Members via Email"
                      >
                        {notifying === poll.id ? (
                          <Loader2 size={20} className="animate-spin" />
                        ) : (
                          <Mail size={20} className="transition-transform group-hover:-rotate-12" />
                        )}
                      </button>
                      {isDraft ? (
                        <button
                          onClick={() => {
                            if (confirm("Publish this poll now? This will notify community members.")) {
                              togglePollStatus(poll.id, 'draft' as PollStatus); 
                            }
                          }}
                          className={cn(
                            "p-3 rounded-2xl transition-all",
                            isFinished ? "text-gray-200 cursor-not-allowed" : "text-[#5A5A40] bg-[#5A5A40]/10 hover:bg-[#5A5A40]/20"
                          )}
                          title="Publish Now"
                          disabled={isFinished}
                        >
                          <Play size={20} />
                        </button>
                      ) : (
                        <button
                          onClick={() => togglePollStatus(poll.id, poll.status)}
                          className={cn(
                            "p-3 rounded-2xl transition-all",
                            isFinished ? "text-gray-200 cursor-not-allowed" : "text-gray-400 hover:text-[#5A5A40] hover:bg-[#5A5A40]/5"
                          )}
                          title={poll.status === 'active' ? "Pause Poll" : "Resume Poll"}
                          disabled={isFinished}
                        >
                          {poll.status === 'active' ? <Pause size={20} /> : <Play size={20} />}
                        </button>
                      )}
                      <button
                        onClick={() => handleDuplicatePoll(poll)}
                        className="p-3 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-2xl transition-all"
                        title="Duplicate Poll"
                      >
                        <Copy size={20} />
                      </button>
                      <button
                        onClick={() => startEditing(poll)}
                        className={cn(
                          "p-3 rounded-2xl transition-all",
                          (!isFinished && (isDraft || notStarted || poll.createdBy === user?.uid)) ? "text-gray-400 hover:text-[#5A5A40] hover:bg-[#5A5A40]/5" : "text-gray-200 cursor-not-allowed"
                        )}
                        title="Edit Poll"
                        disabled={isFinished || (!isDraft && !notStarted && poll.createdBy !== user?.uid)}
                      >
                        <Settings size={20} />
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => deletePoll(poll.id)}
                          className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                          title="Delete Poll"
                        >
                          <Trash2 size={20} />
                        </button>
                      )}
                    </>)}
                  </div>
                </button>

                {expandedPolls[poll.id] && (
                  <div className="px-8 pb-10 space-y-8 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex flex-wrap gap-6 text-xs text-gray-400 dark:text-gray-500 pb-4 border-b border-gray-50 dark:border-white/5">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={14} />
                        Poll Period: <strong className="text-gray-900 dark:text-[#f5f5f0]">{safeFormat(poll.startDate, 'MMM dd, HH:mm')} - {safeFormat(poll.endDate, 'MMM dd, HH:mm')}</strong>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <User size={14} />
                        Creator: <strong className="text-gray-900 dark:text-[#f5f5f0]">{poll.creatorName || 'System'}</strong>
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed max-w-2xl">{poll.description}</p>

                    {(user?.email?.toLowerCase() === 'kcfc.jp@gmail.com' || profile?.email?.toLowerCase() === 'kcfc.jp@gmail.com') && (
                      <div className="p-5 bg-gray-50 dark:bg-[#1e1e1a]/40 border border-gray-200 dark:border-white/10 rounded-[2rem] text-xs text-gray-500 dark:text-gray-400 font-medium flex items-center gap-2">
                        <span>🛡️ As the primary Administrator (kcfc.jp@gmail.com), you are excluded from public poll participation and cannot answer. Other administrators and presidents are still permitted to participate.</span>
                      </div>
                    )}

                    {isActive && pendingUsers.length === 0 && showPendingList && (
                      <div className="p-5 bg-amber-50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/30 rounded-[2rem] flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-amber-500 text-white rounded-full">
                            <CheckCircle2 size={18} />
                          </div>
                          <div>
                            <p className="text-xs font-extrabold text-amber-900 dark:text-amber-400">100% Core Member Responses Received!</p>
                            <p className="text-[10px] text-amber-700 dark:text-amber-500">All eligible community members have successfully responded to this poll.</p>
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            if (window.confirm("Are you sure you want to close this poll? This will lock further submissions and enable duty generators.")) {
                              await togglePollStatus(poll.id, 'active');
                            }
                          }}
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-95 whitespace-nowrap cursor-pointer"
                        >
                          <Lock size={12} />
                          Close Poll Now
                        </button>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-4">
                      {poll.category === 'committee' ? (
                        <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                          {(poll.massDates || []).map((option) => {
                            const isSelected = userResponses[poll.id]?.selectedOptions?.includes(option.date);
                            const count = (pollResponses[poll.id] || []).filter(r => r.selectedOptions?.includes(option.date)).length;
                            const isPrimaryAdminUser = user?.email?.toLowerCase() === 'kcfc.jp@gmail.com' || profile?.email?.toLowerCase() === 'kcfc.jp@gmail.com';
                            return (
                              <button
                                key={option.date}
                                disabled={!isActive || isSubmitting[poll.id] || isPrimaryAdminUser}
                                onClick={() => handleResponse(poll.id, undefined, option.date)}
                                className={cn(
                                  "flex flex-col items-center gap-2 p-6 rounded-[28px] border-2 transition-all group relative cursor-pointer",
                                  isSelected
                                    ? "bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-current"
                                    : isActive && !isPrimaryAdminUser
                                      ? "bg-white dark:bg-[#1e1e1a] text-gray-400 dark:text-gray-500 border-gray-100 dark:border-white/10 hover:text-blue-600 dark:hover:text-blue-400 hover:border-current"
                                      : "bg-gray-50 dark:bg-gray-900/40 text-gray-300 dark:text-gray-600 border-transparent grayscale"
                                )}
                              >
                                <Calendar size={28} className={cn("transition-transform", isActive && !isPrimaryAdminUser && "group-hover:scale-110")} />
                                <div className="flex flex-col items-center">
                                  <span className="text-[10px] font-bold uppercase tracking-widest">{format(new Date(option.date), 'EEEE')}</span>
                                  <span className="text-xs font-serif font-bold">{format(new Date(option.date), 'MMM dd, yyyy')}</span>
                                  {option.description && (
                                    <span className="text-[9px] mt-1 opacity-70 italic line-clamp-1">{option.description}</span>
                                  )}
                                </div>
                                <span className="text-xl font-bold font-serif">{count}</span>
                                {isSelected && (
                                  <div className="absolute top-3 right-3 bg-white dark:bg-[#11110f] rounded-full p-0.5 shadow-sm">
                                    <Check size={12} className="text-blue-600 dark:text-blue-400" />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        (poll.category === 'core_member' ? [
                          { value: 'yes', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', hover: 'hover:bg-green-100', label: 'Yes' },
                          { value: 'no', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', hover: 'hover:bg-red-100', label: 'No' },
                        ] : [
                          { value: 'yes', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/20', hover: 'hover:bg-green-100 dark:hover:bg-green-900/10', label: 'Yes' },
                          { value: 'no', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/20', hover: 'hover:bg-red-100 dark:hover:bg-red-900/10', label: 'No' },
                          { value: 'maybe', icon: HelpCircle, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-950/20', hover: 'hover:bg-yellow-100 dark:hover:bg-yellow-900/10', label: 'Maybe' },
                        ]).map((opt) => {
                          const isPrimaryAdminUser = user?.email?.toLowerCase() === 'kcfc.jp@gmail.com' || profile?.email?.toLowerCase() === 'kcfc.jp@gmail.com';
                          return (
                            <button
                              key={opt.value}
                              disabled={!isActive || isSubmitting[poll.id] || isPrimaryAdminUser}
                              onClick={() => handleResponse(poll.id, opt.value as any)}
                              className={cn(
                                "flex-1 flex flex-col items-center gap-3 p-6 rounded-[28px] border-2 transition-all group cursor-pointer",
                                userResponses[poll.id]?.attendance === opt.value
                                  ? `${opt.bg} ${opt.color} border-current`
                                  : isActive && !isPrimaryAdminUser
                                    ? `bg-white dark:bg-[#1e1e1a] text-gray-400 dark:text-gray-500 border-gray-100 dark:border-white/10 ${opt.hover} hover:text-current hover:border-current`
                                    : "bg-gray-50 dark:bg-gray-900/40 text-gray-300 dark:text-gray-600 border-transparent dark:border-white/5 grayscale"
                              )}
                            >
                              <div className="relative">
                                <opt.icon size={28} className={cn("transition-transform", isActive && !isPrimaryAdminUser && "group-hover:scale-110")} />
                                {userResponses[poll.id]?.attendance === opt.value && (
                                  <div className="absolute -top-1 -right-1 bg-white dark:bg-[#11110f] rounded-full p-0.5 shadow-sm">
                                    <Check size={10} className={opt.color} />
                                  </div>
                                )}
                              </div>
                              <span className="text-[10px] font-bold uppercase tracking-widest">{opt.label}</span>
                              <span className="text-xl font-bold font-serif">
                                {(pollResponses[poll.id] || []).filter(r => r.attendance === opt.value).length}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>

                    {/* Responders List or Assignments */}
                    <div className="space-y-6 pt-4">
                      {poll.category === 'committee' ? (
                        <div className="p-8 bg-blue-50/50 dark:bg-blue-950/10 rounded-[32px] border border-blue-100/50 dark:border-blue-950/30 text-center space-y-4">
                          <BookOpen className="w-10 h-10 text-blue-400 mx-auto" />
                          <div>
                            <h4 className="text-sm font-bold text-blue-900 dark:text-blue-450">Assignments & Schedule</h4>
                            <p className="text-[10px] text-blue-600/70 dark:text-blue-400/80 italic mt-1 uppercase tracking-widest">LITURGICAL MINISTRY ASSIGNMENT & SCHEDULING</p>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
                            Detailed poll results and committee assignments are managed in the Duties section.
                          </p>
                          <a 
                            href={`/duties?tab=liturgical&pollId=${poll.id}`}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md mt-2"
                          >
                            View Matrix in Duties
                            <ChevronDown size={14} className="-rotate-90" />
                          </a>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                          {(poll.category === 'core_member' ? ['yes', 'no'] : ['yes', 'no', 'maybe']).map(type => {
                            const attendees = (pollResponses[poll.id] || []).filter(r => r.attendance === type);
                            if (attendees.length === 0) return null;

                            const isAdminOrPresident = (profile?.roles || []).some(r => ['admin', 'president'].includes(r));
                            const isPollCreator = poll.createdBy === user?.uid;
                            const showResponders = !isActive || isAdminOrPresident || isPollCreator;

                            return (
                              <div key={type} className="space-y-4">
                                <h4 className={cn(
                                  "text-[10px] font-black uppercase tracking-widest flex items-center gap-2 px-1",
                                  type === 'yes' ? "text-green-600" : type === 'no' ? "text-red-600" : "text-yellow-600"
                                )}>
                                  {type === 'yes' ? 'Attending' : type === 'no' ? 'Not Attending' : 'Tentative'}
                                  <span className="bg-white dark:bg-[#1e1e1a] px-2 py-0.5 rounded-full border border-current opacity-70">{attendees.length}</span>
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {showResponders ? (
                                    attendees.map(a => (
                                      <div 
                                        key={a.userId} 
                                        className={cn(
                                          "text-[10px] py-1.5 px-4 rounded-xl border flex items-center gap-2 shadow-sm",
                                          a.userId === user?.uid ? "border-gray-900 dark:border-white bg-white dark:bg-gray-800 font-bold" : "border-gray-100 dark:border-white/5 bg-white dark:bg-[#252520] text-gray-650 dark:text-gray-300"
                                        )}
                                      >
                                        <div className="w-4 h-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-[7px] uppercase font-black text-gray-500 dark:text-gray-400">
                                          {a.userDisplayName?.substring(0, 2)}
                                        </div>
                                        {a.userDisplayName}
                                      </div>
                                    ))
                                  ) : (
                                    <p className="text-[10px] text-gray-400 dark:text-gray-500 italic px-1">Names hidden while poll is ongoing.</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Show list of users who did not take the poll yet (for admin/president/poll creator) */}
                      {showPendingList && pendingUsers.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-gray-100 dark:border-white/5">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-[#5A5A40] dark:text-[#8a8a65] flex items-center gap-2 mb-3 px-1">
                            Pending Response / Did Not Vote
                            <span className="bg-white dark:bg-[#1e1e1a] text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-white/10 px-2 py-0.5 rounded-full font-mono font-bold opacity-80">{pendingUsers.length}</span>
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {pendingUsers.map(u => (
                              <div 
                                key={u.uid} 
                                className="text-[10px] py-1.5 px-4 rounded-xl border border-dashed border-gray-200 dark:border-white/10 bg-gray-50/30 dark:bg-[#252520]/20 text-gray-400 dark:text-gray-500 flex items-center gap-2 shadow-xs"
                              >
                                <div className="w-4 h-4 bg-gray-200/50 dark:bg-gray-800 rounded-full flex items-center justify-center text-[7px] uppercase font-black text-gray-500 dark:text-gray-400">
                                  {u.displayName?.substring(0, 2)}
                                </div>
                                {u.displayName}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {hasVoted && (
                      <div className="flex items-center justify-center gap-2 text-xs font-serif italic text-gray-400 pt-6">
                        <Check size={14} className="text-green-500" />
                        You recorded your response on {safeFormat(userResponses[poll.id].submittedAt, 'MMM dd, HH:mm')}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
