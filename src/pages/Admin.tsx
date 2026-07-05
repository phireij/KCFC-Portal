import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { collection, onSnapshot, updateDoc, doc, serverTimestamp, deleteDoc, query, where, getDocs, writeBatch, setDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, UserRole, MinistryType, ContactMessage } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, ShieldAlert, UserCheck, UserPlus, Search, Ban, UserX, Trash2, X, ChevronDown, ChevronRight, Megaphone, FileText, RefreshCw, Mail, Inbox, Archive, Check, AlertCircle, Eye, EyeOff, Reply, Send, Loader2 } from 'lucide-react';
import BroadcastTool from '../components/admin/BroadcastTool';
import { sendGmail } from '../lib/gmail';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';

export default function Admin() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetUid = searchParams.get('uid');
  
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [disablingUser, setDisablingUser] = useState<UserProfile | null>(null);
  const [purgeEmail, setPurgeEmail] = useState('');
  const [purging, setPurging] = useState(false);
  const [serverLogs, setServerLogs] = useState<string>('');
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Messages State & Listeners for President and Portal Admin
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [messageFilter, setMessageFilter] = useState<'unread' | 'all' | 'archived'>('unread');
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);

  // Inline Gmail Reply States
  const [isReplying, setIsReplying] = useState(false);
  const [replySubject, setReplySubject] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState(false);

  const isMessageManager = (profile?.roles || []).some(r => ['admin', 'president'].includes(r));

  // Reset/Pre-fill Gmail reply states when selectedMessage changes
  useEffect(() => {
    if (selectedMessage) {
      setReplySubject(`Re: ${selectedMessage.subject || 'KCFC Portal Inquiry'}`);
      setReplyBody(`Dear ${selectedMessage.name},\n\nThank you for reaching out to KCFC.\n\n\n\nSincerely,\nKCFC Administration`);
      setIsReplying(false);
      setSendingEmail(false);
      setEmailError(null);
      setEmailSuccess(false);
    }
  }, [selectedMessage]);
  
  // Executive Submenu Navigation Active Tab
  const [activeTab, setActiveTab] = useState<'pending' | 'members' | 'messages' | 'broadcast' | 'purge'>('pending');

  const [showAddPendingModal, setShowAddPendingModal] = useState(false);
  const [newPendingEmail, setNewPendingEmail] = useState('');
  const [newPendingName, setNewPendingName] = useState('');
  const [isAddingPending, setIsAddingPending] = useState(false);

  const quickAddPendingUser = async (email: string, displayName: string) => {
    try {
      const emailLower = email.trim().toLowerCase();
      const generatedUid = `pending_${emailLower.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_')}`;
      
      const newProfile: any = {
        uid: generatedUid,
        email: emailLower,
        displayName: displayName,
        photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=5A5A40&color=fff`,
        roles: ["member"],
        ministries: [],
        isEmailVerified: true,
        isVerified: false,
        isDisabled: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', generatedUid), {
        ...newProfile,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      alert(`Successfully added ${displayName} (${emailLower}) to Firestore as Membership Pending!`);
    } catch (err: any) {
      console.error("Failed to add pending user client-side:", err);
      alert(`Failed to add user: ${err.message}`);
    }
  };

  useEffect(() => {
    if (!isMessageManager) {
      setMessagesLoading(false);
      return;
    }

    const q = query(collection(db, 'messages'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          status: data.status || 'unread'
        } as ContactMessage;
      });

      msgs.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      setMessages(msgs);
      setMessagesLoading(false);
    }, (err) => {
      console.error("Error subscribing to messages:", err);
      setMessagesLoading(false);
    });

    return () => unsubscribe();
  }, [isMessageManager]);

  const toggleReadStatus = async (msg: ContactMessage, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const nextStatus = msg.status === 'read' ? 'unread' : 'read';
      await updateDoc(doc(db, 'messages', msg.id), {
        status: nextStatus
      });
      if (selectedMessage?.id === msg.id) {
        setSelectedMessage(prev => prev ? { ...prev, status: nextStatus } : null);
      }
    } catch (err: any) {
      console.error("Error updating message status:", err);
      alert(`Failed to update message status: ${err.message}`);
    }
  };

  const toggleArchiveStatus = async (msg: ContactMessage, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const nextStatus = msg.status === 'archived' ? 'unread' : 'archived';
      await updateDoc(doc(db, 'messages', msg.id), {
        status: nextStatus
      });
      if (selectedMessage?.id === msg.id) {
        setSelectedMessage(prev => prev ? { ...prev, status: nextStatus } : null);
      }
    } catch (err: any) {
      console.error("Error archiving message:", err);
      alert(`Failed to archive message: ${err.message}`);
    }
  };

  const deleteMessage = async (msgId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm("Are you sure you want to permanently delete this message? This action is irreversible.")) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'messages', msgId));
      if (selectedMessage?.id === msgId) {
        setSelectedMessage(null);
      }
    } catch (err: any) {
      console.error("Error deleting message:", err);
      alert(`Failed to delete message: ${err.message}`);
    }
  };

  const handleSendReply = async () => {
    if (!selectedMessage) return;
    if (!replyBody.trim()) {
      setEmailError('Please write a response message body.');
      return;
    }

    setSendingEmail(true);
    setEmailError(null);
    setEmailSuccess(false);

    try {
      // Send response email using backend / client-side OAuth via Gmail API
      await sendGmail(
        selectedMessage.email,
        replySubject,
        replyBody.replace(/\n/g, '<br />')
      );

      setEmailSuccess(true);
      setIsReplying(false);

      // Automatically mark original query as read upon successful reply
      if (selectedMessage.status === 'unread') {
        await updateDoc(doc(db, 'messages', selectedMessage.id), {
          status: 'read'
        });
        setSelectedMessage(prev => prev ? { ...prev, status: 'read' } : null);
      }
    } catch (err: any) {
      console.error("Error sending response via Gmail:", err);
      setEmailError(err.message || 'Could not send email. Please ensure you have granted Gmail send permissions.');
    } finally {
      setSendingEmail(false);
    }
  };

  useEffect(() => {
    if (targetUid && users.length > 0) {
      setExpandedRows(prev => {
        const next = new Set(prev);
        next.add(targetUid);
        return next;
      });
      setTimeout(() => {
        const element = document.getElementById(`member-row-${targetUid}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('bg-[#5A5A40]/15', 'dark:bg-[#8a8a65]/15');
          setTimeout(() => {
            element.classList.remove('bg-[#5A5A40]/15', 'dark:bg-[#8a8a65]/15');
          }, 2500);
        }
      }, 400);
    }
  }, [targetUid, users]);

  // Smooth scroll handler for deep-linked hash anchors (e.g. #messages-inbox-section)
  useEffect(() => {
    const handleHashScroll = () => {
      if (window.location.hash === '#messages-inbox-section') {
        if (isMessageManager) {
          setActiveTab('messages');
        }
        setTimeout(() => {
          const element = document.getElementById('messages-inbox-section');
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            element.classList.add('ring-2', 'ring-amber-500/20', 'dark:ring-amber-500/30');
            setTimeout(() => {
              element.classList.remove('ring-2', 'ring-amber-500/20', 'dark:ring-amber-500/30');
            }, 3000);
          }
        }, 600);
      }
    };

    handleHashScroll();
    window.addEventListener('hashchange', handleHashScroll);
    return () => window.removeEventListener('hashchange', handleHashScroll);
  }, [isMessageManager]);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Could not acquire administrative credentials for validation.");
      const response = await fetch('/api/admin/read-delete-logs', {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setServerLogs(data.logs);
      } else {
        const errData = await response.json().catch(() => ({}));
        setServerLogs(`Failed to fetch logs: ${errData.error || response.statusText}`);
      }
    } catch (err: any) {
      setServerLogs(`Error: ${err.message}`);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if ((profile?.roles || []).some(r => ['admin', 'president'].includes(r))) {
      fetchLogs();
    }
  }, [profile]);

  const toggleRow = (userId: string) => {
    const next = new Set(expandedRows);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    setExpandedRows(next);
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const ROLE_CONFIG: Record<UserRole, { label: string; limit: number; icon: any; category: 'executive' | 'leadership' | 'other' }> = {
    spiritual_director: { label: 'Spiritual Director', limit: 1, icon: Shield, category: 'executive' },
    admin: { label: 'Admin', limit: 1, icon: ShieldAlert, category: 'executive' },
    president: { label: 'President', limit: 1, icon: ShieldAlert, category: 'executive' },
    vice_president: { label: 'V-President', limit: 2, icon: ShieldAlert, category: 'executive' },
    secretary: { label: 'Secretary', limit: 1, icon: Shield, category: 'executive' },
    treasurer: { label: 'Treasurer', limit: 1, icon: Shield, category: 'executive' },
    auditor: { label: 'Auditor', limit: 1, icon: Shield, category: 'executive' },
    pro: { label: 'P.R.O.', limit: 1, icon: Shield, category: 'executive' },
    choir_a_leader: { label: 'Choir A Leader', limit: 1, icon: Shield, category: 'leadership' },
    choir_b_leader: { label: 'Choir B Leader', limit: 1, icon: Shield, category: 'leadership' },
    lector_commentator_leader: { label: 'Lector/Commentator Leader', limit: 1, icon: Shield, category: 'leadership' },
    usher_leader: { label: 'Usher Leader', limit: 1, icon: Shield, category: 'leadership' },
    altar_server_leader: { label: 'Altar Server Leader', limit: 1, icon: Shield, category: 'leadership' },
    kitchen_leader: { label: 'Kitchen Leader', limit: 1, icon: Shield, category: 'leadership' },
    kitchen_sub_leader: { label: 'Kitchen Sub-Leader', limit: 1, icon: Shield, category: 'leadership' },
    cleaning_leader: { label: 'Cleaning Leader', limit: 1, icon: Shield, category: 'leadership' },
    cleaning_sub_leader: { label: 'Cleaning Sub-Leader', limit: 1, icon: Shield, category: 'leadership' },
    member: { label: 'Member', limit: 9999, icon: UserCheck, category: 'other' },
  };

  const [editingRoles, setEditingRoles] = useState<{ [userId: string]: UserRole[] | null }>({});
  const [editingMinistries, setEditingMinistries] = useState<{ [userId: string]: MinistryType[] | null }>({});
  const [editingLcRoles, setEditingLcRoles] = useState<{ [userId: string]: string[] | null }>({});
  const [editingProfiles, setEditingProfiles] = useState<{ [userId: string]: { displayName: string; nickname: string; phoneNumber: string } | null }>({});

  const MINISTRY_CONFIG: Record<MinistryType, { label: string; category: 'liturgical' | 'chore' }> = {
    choir_a: { label: 'Choir A', category: 'liturgical' },
    choir_b: { label: 'Choir B', category: 'liturgical' },
    lector_commentator: { label: 'Lector/Commentator', category: 'liturgical' },
    usher: { label: 'Usher', category: 'liturgical' },
    altar_server: { label: 'Altar Server', category: 'liturgical' },
    kitchen: { label: 'Kitchen', category: 'chore' },
    cleaning: { label: 'Cleaning', category: 'chore' },
    cleaning_toilet_ok: { label: 'Toilet OK', category: 'chore' },
    cleaning_toilet_ng: { label: 'Toilet NG', category: 'chore' },
  };

  const handleRoleChange = (userId: string, role: UserRole) => {
    const currentEditing = editingRoles[userId] || users.find(u => u.uid === userId)?.roles || [];
    let next: UserRole[];
    if (currentEditing.includes(role)) {
      next = currentEditing.filter(r => r !== role);
    } else {
      next = [...currentEditing, role];
    }
    
    // Ensure member is always there if nothing else
    if (next.length === 0) next = ['member'];
    
    setEditingRoles(prev => ({ ...prev, [userId]: next }));
  };

  const saveRoles = async (userId: string) => {
    if (!(profile?.roles || []).some(r => ['admin', 'president', 'secretary'].includes(r))) {
      alert("You do not have permission to edit member roles.");
      return;
    }
    const newRoles = editingRoles[userId];
    const newMinistries = editingMinistries[userId];
    const newLcRoles = editingLcRoles[userId];
    
    if (!newRoles && !newMinistries && !newLcRoles) return;

    const updates: any = { updatedAt: serverTimestamp() };
    
    if (newRoles) {
      // Ensure 'member' is always included
      const finalRoles = Array.from(new Set([...newRoles, 'member' as UserRole]));

      const user = users.find(u => u.uid === userId);
      const executiveRole = finalRoles.find(r => ROLE_CONFIG[r].category === 'executive' && r !== 'admin');
      const leadershipRole = finalRoles.find(r => ROLE_CONFIG[r].category === 'leadership');
      
      const isDualRoleCandidate = user?.isCoreMember && executiveRole && executiveRole !== 'president' && 
                                  leadershipRole && (leadershipRole.includes('kitchen') || leadershipRole.includes('cleaning'));

      // Special rule: President cannot have dual roles
      if (finalRoles.includes('president') && finalRoles.length > 2) {
        alert("The President cannot take any additional committee leadership roles.");
        return;
      }

      // Rule: Member role + max 1 additional role (unless dual role candidate)
      if (!isDualRoleCandidate && finalRoles.length > 2) {
        alert("Aside from the 'Member' role, a member can only take 1 additional role.");
        return;
      }
      if (isDualRoleCandidate && finalRoles.length > 3) {
        alert("A member can only take up to 2 additional roles (Executive + Specific Leadership).");
        return;
      }

      // Validate global limits per position
      for (const role of finalRoles) {
        const config = ROLE_CONFIG[role];
        if (config.limit === 9999) continue;

        const otherUsersWithRole = users.filter(u => u.uid !== userId && u.roles.includes(role));
        if (otherUsersWithRole.length >= config.limit) {
          alert(`The role "${config.label}" is limited to ${config.limit} member(s). Currently assigned to: ${otherUsersWithRole.map(u => u.displayName).join(', ')}`);
          return;
        }
      }
      updates.roles = finalRoles;
    }

    if (newMinistries) {
      updates.ministries = newMinistries;
    }

    if (newLcRoles) {
      updates.lcRoles = newLcRoles;
    }

    try {
      await updateDoc(doc(db, 'users', userId), updates);
      setUsers(prev => prev.map(u => u.uid === userId ? { ...u, ...updates } : u));
      setEditingRoles(prev => ({ ...prev, [userId]: null }));
      setEditingMinistries(prev => ({ ...prev, [userId]: null }));
      setEditingLcRoles(prev => ({ ...prev, [userId]: null }));
    } catch (err: any) {
      console.error(err);
      alert(`Failed to save changes: ${err.message}`);
    }
  };

  const cancelEditing = (userId: string) => {
    setEditingRoles(prev => ({ ...prev, [userId]: null }));
    setEditingMinistries(prev => ({ ...prev, [userId]: null }));
    setEditingLcRoles(prev => ({ ...prev, [userId]: null }));
  };

  const startProfileEditing = (user: UserProfile) => {
    setEditingProfiles(prev => ({
      ...prev,
      [user.uid]: {
        displayName: user.displayName || "",
        nickname: user.nickname || "",
        phoneNumber: user.phoneNumber || ""
      }
    }));
  };

  const cancelProfileEditing = (userId: string) => {
    setEditingProfiles(prev => ({ ...prev, [userId]: null }));
  };

  const saveMemberProfile = async (userId: string) => {
    if (!(profile?.roles || []).some(r => ['admin', 'president'].includes(r))) {
      alert("You do not have permission to edit member profiles.");
      return;
    }
    const editData = editingProfiles[userId];
    if (!editData) return;

    if (!editData.displayName.trim()) {
      alert("Display Name (Full name) is required.");
      return;
    }

    try {
      const dbUpdates = {
        displayName: editData.displayName.trim(),
        nickname: editData.nickname?.trim() || "",
        phoneNumber: editData.phoneNumber?.trim() || "",
        updatedAt: serverTimestamp()
      };

      const localUpdates = {
        displayName: editData.displayName.trim(),
        nickname: editData.nickname?.trim() || "",
        phoneNumber: editData.phoneNumber?.trim() || "",
        updatedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'users', userId), dbUpdates);
      setUsers(prev => prev.map(u => u.uid === userId ? { ...u, ...localUpdates } : u));
      setEditingProfiles(prev => ({ ...prev, [userId]: null }));
    } catch (err: any) {
      console.error(err);
      alert(`Failed to save profile: ${err.message}`);
    }
  };

  const toggleVerification = async (userId: string, currentStatus: boolean) => {
    if (!(profile?.roles || []).some(r => ['admin', 'president', 'secretary'].includes(r))) {
      alert("You do not have permission to verify members.");
      return;
    }
    try {
      const nextStatus = !currentStatus;
      await updateDoc(doc(db, 'users', userId), {
        isVerified: nextStatus,
        updatedAt: serverTimestamp()
      });
      setUsers(prev => prev.map(u => u.uid === userId ? { ...u, isVerified: nextStatus } : u));
      
      if (nextStatus) {
        // Expand the verified row by default
        setExpandedRows(prev => {
          const next = new Set(prev);
          next.add(userId);
          return next;
        });
        
        // Highlight & redirect: Set uid query parameter
        setSearchParams({ uid: userId });

        // Scroll to the newly registered row inside verified members table
        setTimeout(() => {
          const element = document.getElementById(`member-row-${userId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('bg-[#5A5A40]/15', 'dark:bg-[#8a8a65]/15');
            setTimeout(() => {
              element.classList.remove('bg-[#5A5A40]/15', 'dark:bg-[#8a8a65]/15');
            }, 2500);
          }
        }, 500);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleCoreMember = async (userId: string, currentStatus: boolean) => {
    if (!(profile?.roles || []).some(r => ['admin', 'president', 'secretary'].includes(r))) {
      alert("You do not have permission to manage core membership.");
      return;
    }
    
    const action = currentStatus ? "downgrade to Regular member" : "upgrade to Core member";
    const warning = currentStatus ? "\n\nWarning: This will delete the member's Executive Positions, Leadership Roles, and Chore Committee assignments as they are reserved for Core Members." : "";
    if (!confirm(`Are you sure you want to ${action} this member?${warning}`)) {
      return;
    }

    try {
      const updates: any = {
        isCoreMember: !currentStatus,
        updatedAt: serverTimestamp()
      };

      if (currentStatus) {
        // Downgrading: Cleanup roles and ministries
        const user = users.find(u => u.uid === userId);
        if (user) {
          // Keep only 'member' role (clear executive and leadership)
          updates.roles = ['member'];
          // Keep only liturgical ministries (clear chore)
          updates.ministries = (user.ministries || []).filter(m => MINISTRY_CONFIG[m]?.category === 'liturgical');
        }
      }

      await updateDoc(doc(db, 'users', userId), updates);
      setUsers(prev => prev.map(u => u.uid === userId ? { ...u, ...updates } : u));
    } catch (err) {
      console.error(err);
      alert("Failed to update membership status.");
    }
  };

  const toggleDisabled = async (userId: string, currentStatus: boolean) => {
    if (!(profile?.roles || []).some(r => ['admin', 'president'].includes(r))) {
      alert("Only the Admin or President can disable accounts.");
      return;
    }
    if (userId === profile?.uid) {
      alert("You cannot disable your own account.");
      return;
    }
    if (!currentStatus) {
      // Trigger confirmation popup
      const u = users.find(x => x.uid === userId);
      if (u) {
        setDisablingUser(u);
      }
    } else {
      // To enable: don't require modal
      try {
        await updateDoc(doc(db, 'users', userId), {
          isDisabled: false,
          updatedAt: serverTimestamp()
        });
        setUsers(prev => prev.map(u => u.uid === userId ? { ...u, isDisabled: false } : u));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const removeUser = async (userId: string) => {
    if (!(profile?.roles || []).some(r => ['admin', 'president'].includes(r))) {
      alert("Only the Admin or President can remove members.");
      return;
    }
    if (userId === profile?.uid) {
      alert("You cannot remove your own account.");
      return;
    }
    if (!confirm("Are you sure you want to permanently remove this member? This action is irreversible and will also strip them from all active assignments, duties, and responded polls.")) {
      return;
    }
    try {
      // Fetch admin ID token for caller verification
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error("Could not acquire administrative credentials for validation.");
      }

      let serverSuccess = true;
      let serverMsg = "";

      try {
        const response = await fetch('/api/admin/delete-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ targetUserId: userId })
        });

        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("text/html")) {
          throw new Error("The custom Express server is bypassed or not running (received HTML response).");
        }

        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(result.error || `Server responded with error status ${response.status}`);
        }
        serverMsg = result.message || "Member and all matching attributes, assignments, and records have been successfully cleaned up on the server.";
      } catch (serverErr: any) {
        console.warn("Server-side cascade cleanup failed or was bypassed:", serverErr.message);
        serverSuccess = false;
        serverMsg = `Note: Server-side authentication credentials cleanup was bypassed (${serverErr.message}).\n\nDirect client-side database document deletion is now proceeding!`;
      }

      // Direct client-side delete using authenticated administrator privileges to guarantee instant permanent deletion from the correct database
      try {
        await deleteDoc(doc(db, 'users', userId));
      } catch (clientFsError: any) {
        console.warn("Client-side direct users doc delete ignored: ", clientFsError);
      }

      // Also clean up any other orphaned user documents in Firestore that have this email (case-insensitive) to prevent database duplicates
      const targetUser = users.find(u => u.uid === userId);
      if (targetUser && targetUser.email) {
        const emailToPurge = targetUser.email.trim().toLowerCase();
        try {
          const usersRef = collection(db, 'users');
          const qExact = query(usersRef, where('email', '==', targetUser.email.trim()));
          const snapExact = await getDocs(qExact);
          for (const docSnap of snapExact.docs) {
            await deleteDoc(docSnap.ref);
            console.log("Client-side successfully cleaned up duplicate document with exact email:", docSnap.id);
          }

          if (emailToPurge !== targetUser.email.trim()) {
            const qLower = query(usersRef, where('email', '==', emailToPurge));
            const snapLower = await getDocs(qLower);
            for (const docSnap of snapLower.docs) {
              await deleteDoc(docSnap.ref);
              console.log("Client-side successfully cleaned up duplicate document with lowercase email:", docSnap.id);
            }
          }
        } catch (clientFsQueryError: any) {
          console.warn("Client-side query-based duplicate cleanup failed: ", clientFsQueryError);
        }
      }

      setUsers(prev => prev.filter(u => u.uid !== userId));
      alert(serverMsg);
    } catch (err: any) {
      console.error(err);
      alert(`Error cleaning up member records: ${err.message}`);
    }
  };

  const handlePurgeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(profile?.roles || []).some(r => ['admin', 'president'].includes(r))) {
      alert("Only the Admin or President can purge member credentials.");
      return;
    }

    const emailToPurge = purgeEmail.trim();
    if (!emailToPurge) {
      alert("Please enter a valid email address.");
      return;
    }

    if (emailToPurge.toLowerCase() === profile?.email?.toLowerCase()) {
      alert("You cannot delete your own account credentials.");
      return;
    }

    if (!confirm(`Are you absolutely sure you want to permanently delete the Firebase Authentication credentials and database documents for the user with email "${emailToPurge}"? This is an advanced action that bypasses the directory.`)) {
      return;
    }

    setPurging(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error("Could not acquire administrative credentials for validation.");
      }

      let serverSuccess = true;
      let serverMsg = "";
      let targetDeletedUid = null;

      try {
        const response = await fetch('/api/admin/delete-user-by-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ email: emailToPurge })
        });

        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("text/html")) {
          throw new Error("The custom Express server is bypassed or not running (received HTML response).");
        }

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || `Server responded with error status ${response.status}`);
        }
        serverMsg = data.message || `Account with email ${emailToPurge} successfully purged on the server.`;
        targetDeletedUid = data.details?.deletedUid;
      } catch (serverErr: any) {
        console.warn("Server-side email purge failed or was bypassed:", serverErr.message);
        serverSuccess = false;
        serverMsg = `Note: Server-side email purge was bypassed (${serverErr.message}).\n\nProceeding with direct database cleanup of matching accounts!`;
      }

      alert(serverMsg);

      // Direct client-side delete using authenticated administrator privileges to guarantee instant permanent deletion from the correct database
      if (targetDeletedUid) {
        try {
          await deleteDoc(doc(db, 'users', targetDeletedUid));
        } catch (clientFsError: any) {
          console.warn("Client-side direct users doc delete ignored: ", clientFsError);
        }
      }

      // Query and delete ALL documents in Firestore with this email address (case-insensitive) to fully sanitize the database
      try {
        const usersRef = collection(db, 'users');
        const emailLower = emailToPurge.toLowerCase();
        
        const qExact = query(usersRef, where('email', '==', emailToPurge));
        const snapExact = await getDocs(qExact);
        for (const docSnap of snapExact.docs) {
          await deleteDoc(docSnap.ref);
          console.log("Client-side purge deleted exact email match document:", docSnap.id);
        }

        if (emailLower !== emailToPurge) {
          const qLower = query(usersRef, where('email', '==', emailLower));
          const snapLower = await getDocs(qLower);
          for (const docSnap of snapLower.docs) {
            await deleteDoc(docSnap.ref);
            console.log("Client-side purge deleted lowercase email match document:", docSnap.id);
          }
        }
      } catch (clientFsQueryError: any) {
        console.warn("Client-side query-based purge failed: ", clientFsQueryError);
      }

      // Dynamically remove from local state list if found
      if (targetDeletedUid) {
        setUsers(prev => prev.filter(u => u.uid !== targetDeletedUid));
      } else {
        setUsers(prev => prev.filter(u => (u.email || '').toLowerCase() !== emailToPurge.toLowerCase()));
      }

      setPurgeEmail('');
      // Trigger dynamic refresh on log files
      fetchLogs();
    } catch (err: any) {
      console.error(err);
      alert(`Error purging credentials: ${err.message}`);
    } finally {
      setPurging(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const displayName = u.displayName || '';
    const email = u.email || '';
    const roles = u.roles || [];
    return (
      (displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
       email.toLowerCase().includes(searchTerm.toLowerCase())) &&
      !roles.includes('admin') &&
      email !== 'kcfc.jp@gmail.com'
    );
  });

  const pendingUsers = filteredUsers.filter(u => !u.isVerified);
  const acceptedUsers = filteredUsers.filter(u => u.isVerified);

  const hasKaizen = users.some(u => (u.email || '').trim().toLowerCase() === 'kaizen.webmktg@gmail.com');
  const hasPhil = users.some(u => (u.email || '').trim().toLowerCase() === 'philbalgotr@gmail.com');

  const canBroadcast = (profile?.roles || []).some(r => 
    ['admin', 'president', 'secretary', 'pro'].includes(r)
  );

  const renderTable = (usersSubset: UserProfile[]) => {
    if (usersSubset.length === 0) {
      return (
        <div className="py-12 bg-gray-50/50 dark:bg-[#11110f]/20 rounded-2xl border border-dashed border-gray-150 dark:border-white/5 text-center text-gray-400 dark:text-gray-500 font-serif italic text-xs">
          No members found in this category.
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left font-sans">
          <thead>
            <tr className="border-b border-gray-50 dark:border-white/5">
              <th className="px-4 py-3 text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-gray-500">Member</th>
              <th className="px-4 py-3 text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-gray-500">Status</th>
              <th className="px-4 py-3 text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-gray-500">Active Roles</th>
              <th className="px-4 py-3 text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-white/5">
            {usersSubset.map((user, index) => {
              const isExpanded = expandedRows.has(user.uid);
              return (
                <React.Fragment key={user.uid}>
                  <tr 
                    id={`member-row-${user.uid}`}
                    className={cn(
                      "hover:bg-[#5A5A40]/5 dark:hover:bg-[#8a8a65]/5 transition-colors cursor-pointer",
                      index % 2 === 0 ? "bg-white dark:bg-[#1e1e1a]" : "bg-gray-50/50 dark:bg-[#252520]/25",
                      isExpanded && "shadow-inner border-y border-[#5A5A40]/10 dark:border-white/5 font-medium"
                    )}
                    onClick={() => toggleRow(user.uid)}
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown size={14} className="text-gray-400 dark:text-gray-500" /> : <ChevronRight size={14} className="text-gray-400 dark:text-gray-500" />}
                        <img src={user.photoURL} className="w-10 h-10 rounded-full border border-gray-100 dark:border-white/5" alt="" referrerPolicy="no-referrer" />
                        <div>
                          <div className="text-sm font-bold text-gray-900 dark:text-[#f5f5f0]">{user.displayName}</div>
                          <div className="text-xs text-gray-400 dark:text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-2">
                        <div className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 w-fit",
                          user.isVerified ? "bg-green-50 text-green-600 dark:bg-green-950/20 dark:text-green-400" : "bg-yellow-50 text-yellow-600 dark:bg-[#5a5a40]/20 dark:text-[#8a8a65]"
                        )}>
                          <UserCheck size={12} />
                          {user.isVerified ? 'Verified' : 'Pending'}
                        </div>
                        {user.isVerified && (
                          <div className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 w-fit",
                            user.isCoreMember ? "bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400" : "bg-gray-150 text-gray-450 dark:bg-gray-800 dark:text-gray-400"
                          )}>
                            <Shield size={12} />
                            {user.isCoreMember ? 'Core Member' : 'Regular Member'}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1">
                        {user.isVerified && user.roles.map(role => {
                          const roleInfo = ROLE_CONFIG[role];
                          const label = (role === 'member' && user.isCoreMember) ? 'Core Member' : (roleInfo?.label || role);
                          return (
                            <span key={role} className="flex items-center gap-1 px-2 py-0.5 bg-[#5A5A40]/10 text-[#5A5A40] dark:bg-[#8a8a65]/15 dark:text-[#8a8a65] text-[9px] uppercase font-bold rounded">
                              {label}
                            </span>
                          );
                        })}
                        {!user.isVerified && <span className="text-[10px] text-gray-300 dark:text-gray-600 italic">None</span>}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button className="text-[10px] font-bold text-[#5A5A40] dark:text-[#8a8a65] uppercase tracking-widest hover:underline">
                        {isExpanded ? 'Collapse' : 'Manage'}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-gray-50/30 dark:bg-[#141411]/50 border-y border-gray-100/50 dark:border-white/5">
                      <td colSpan={4} className="px-8 py-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {/* Management Section */}
                          <div className="space-y-4">
                            <h4 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] border-b border-gray-100 dark:border-white/5 pb-2">Status & Membership</h4>
                            <div className="flex flex-wrap gap-2">
                              <button 
                                onClick={(e) => { e.stopPropagation(); toggleVerification(user.uid, user.isVerified); }}
                                className={cn(
                                  "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer",
                                  user.isVerified ? "bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400" : "bg-yellow-50 dark:bg-[#5a5a40]/20 text-yellow-600 dark:text-[#8a8a65]"
                                )}
                              >
                                <UserCheck size={14} />
                                {user.isVerified ? 'Verified Status' : 'Verify Member'}
                              </button>
                              {user.isVerified && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); toggleCoreMember(user.uid, user.isCoreMember || false); }}
                                  className={cn(
                                    "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer",
                                    user.isCoreMember ? "bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                                  )}
                                >
                                  <Shield size={14} />
                                  {user.isCoreMember ? 'Core Member Access' : 'Upgrade to Core'}
                                </button>
                              )}
                              <button 
                                onClick={(e) => { e.stopPropagation(); toggleDisabled(user.uid, user.isDisabled || false); }}
                                className={cn(
                                  "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer",
                                  user.isDisabled ? "bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                                )}
                              >
                                <Ban size={14} />
                                {user.isDisabled ? 'Account Disabled' : 'Disable Account'}
                              </button>
                            </div>

                            <div className="pt-4 space-y-4">
                              <h4 className="text-[10px] font-bold text-gray-400 dark:text-gray-550 uppercase tracking-[0.2em] border-b border-gray-100 dark:border-white/5 pb-2">Assigned Roles</h4>
                              <div className="flex flex-wrap gap-2">
                                {(editingRoles[user.uid] || user.roles).map(role => {
                                  const roleInfo = ROLE_CONFIG[role];
                                  const label = (role === 'member' && user.isCoreMember) ? 'Core Member' : (roleInfo?.label || role);
                                  return (
                                    <span key={role} className="flex items-center gap-1 px-3 py-1 bg-[#5A5A40] dark:bg-[#8a8a65] text-white dark:text-[#11110f] text-[9px] uppercase font-bold rounded-lg group/badge relative">
                                      {roleInfo?.icon && <roleInfo.icon size={10} />}
                                      {label}
                                    </span>
                                  );
                                })}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {(editingMinistries[user.uid] || user.ministries || []).map(m => {
                                  const mInfo = MINISTRY_CONFIG[m];
                                  return (
                                    <span key={m} className="px-3 py-1 bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 text-[9px] uppercase font-bold rounded-lg group/badge flex items-center gap-1">
                                      {mInfo?.label || m}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Member Profile Edit Section */}
                            <div className="pt-4 space-y-4 border-t border-gray-100 dark:border-white/5">
                              <h4 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-[0.2em] pb-1 flex items-center justify-between">
                                <span>Member Profile Details</span>
                                {(profile?.roles || []).some(r => ['admin', 'president'].includes(r)) && !editingProfiles[user.uid] && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); startProfileEditing(user); }}
                                    className="text-[9px] text-[#5A5A40] dark:text-[#8a8a65] hover:underline uppercase font-bold cursor-pointer"
                                  >
                                    Edit Details
                                  </button>
                                )}
                              </h4>

                              {editingProfiles[user.uid] ? (
                                <div className="space-y-3 bg-gray-50/50 dark:bg-[#11110f]/20 p-4 rounded-2xl border border-gray-150 dark:border-white/5" onClick={(e) => e.stopPropagation()}>
                                  <div className="space-y-1">
                                    <label className="text-[8px] font-bold text-gray-400 uppercase tracking-widest block font-medium">Full Name (Display Name) *</label>
                                    <input
                                      type="text"
                                      value={editingProfiles[user.uid]?.displayName || ""}
                                      onChange={(e) => setEditingProfiles(prev => ({
                                        ...prev,
                                        [user.uid]: { ...prev[user.uid]!, displayName: e.target.value }
                                      }))}
                                      className="w-full text-xs bg-white dark:bg-[#1e1e1a] text-gray-190 text-gray-900 dark:text-white border border-gray-150 dark:border-white/10 rounded-lg py-1.5 px-3 focus:ring-1 focus:ring-[#5A5A40] outline-none"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[8px] font-bold text-gray-400 uppercase tracking-widest block font-medium">Nickname</label>
                                    <input
                                      type="text"
                                      value={editingProfiles[user.uid]?.nickname || ""}
                                      onChange={(e) => setEditingProfiles(prev => ({
                                        ...prev,
                                        [user.uid]: { ...prev[user.uid]!, nickname: e.target.value }
                                      }))}
                                      className="w-full text-xs bg-white dark:bg-[#1e1e1a] text-gray-190 text-gray-900 dark:text-white border border-gray-150 dark:border-white/10 rounded-lg py-1.5 px-3 focus:ring-1 focus:ring-[#5A5A40] outline-none"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[8px] font-bold text-gray-400 uppercase tracking-widest block font-medium">Contact Number</label>
                                    <input
                                      type="text"
                                      value={editingProfiles[user.uid]?.phoneNumber || ""}
                                      onChange={(e) => setEditingProfiles(prev => ({
                                        ...prev,
                                        [user.uid]: { ...prev[user.uid]!, phoneNumber: e.target.value }
                                      }))}
                                      className="w-full text-xs bg-white dark:bg-[#1e1e1a] text-gray-190 text-gray-900 dark:text-white border border-gray-150 dark:border-white/10 rounded-lg py-1.5 px-3 focus:ring-1 focus:ring-[#5A5A40] outline-none"
                                    />
                                  </div>
                                  <div className="flex gap-2 pt-1">
                                    <button
                                      onClick={() => saveMemberProfile(user.uid)}
                                      className="px-3 py-1.5 bg-[#5A5A40] text-white text-[9px] font-bold uppercase tracking-widest rounded-lg hover:shadow-xs cursor-pointer"
                                    >
                                      Save Profile
                                    </button>
                                    <button
                                      onClick={() => cancelProfileEditing(user.uid)}
                                      className="px-3 py-1.5 bg-gray-100 dark:bg-[#252520] text-gray-500 dark:text-gray-400 text-[9px] font-bold uppercase tracking-widest rounded-lg cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs p-4 bg-gray-50/30 dark:bg-[#11110f]/10 rounded-2xl border border-gray-150/40 dark:border-white/5">
                                  <div>
                                    <span className="text-[9px] uppercase text-gray-400 block font-bold tracking-wider">Full Name</span>
                                    <span className="text-gray-800 dark:text-[#f5f5f0] font-medium">{user.displayName || <span className="italic text-red-400 text-[10px]">Not entered</span>}</span>
                                  </div>
                                  <div>
                                    <span className="text-[9px] uppercase text-gray-400 block font-bold tracking-wider">Nickname</span>
                                    <span className="text-gray-800 dark:text-[#f5f5f0] font-medium">{user.nickname || <span className="italic text-gray-400 text-[10px]">None</span>}</span>
                                  </div>
                                  <div className="sm:col-span-2">
                                    <span className="text-[9px] uppercase text-gray-400 block font-bold tracking-wider">Contact Number</span>
                                    <span className="text-gray-800 dark:text-[#f5f5f0] font-medium">{user.phoneNumber || <span className="italic text-gray-400 text-[10px]">None</span>}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Configuration Section */}
                          <div className="space-y-6">
                            {user.isVerified ? (
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <label className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Executive Position</label>
                                    <select
                                      value={(editingRoles[user.uid] || user.roles).find(r => ROLE_CONFIG[r].category === 'executive' && r !== 'admin') || ''}
                                      disabled={profile?.uid === user.uid && (editingRoles[user.uid] || user.roles).includes('president')}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) => { e.stopPropagation();
                                        const val = e.target.value as UserRole;
                                        const other = (editingRoles[user.uid] || user.roles).filter(r => ROLE_CONFIG[r].category !== 'executive' && r !== 'admin');
                                        const next = val ? [...other, val] : other;
                                        setEditingRoles(prev => ({ ...prev, [user.uid]: Array.from(new Set(next)) }));
                                      }}
                                      className="w-full text-[10px] bg-white dark:bg-[#1e1e1a] text-gray-900 dark:text-white border border-gray-100 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] py-2"
                                    >
                                      <option value="">None</option>
                                      {(Object.entries(ROLE_CONFIG) as [UserRole, any][])
                                        .filter(([role, config]) => config.category === 'executive' && role !== 'admin')
                                        .map(([role, config]) => (
                                        <option key={role} value={role} disabled={!user.isCoreMember}>
                                          {config.label} {!user.isCoreMember && "(Core only)"}
                                        </option>
                                      ))}
                                    </select>
                                    {profile?.uid === user.uid && (editingRoles[user.uid] || user.roles).includes('president') && (
                                      <p className="text-[7px] text-orange-500 italic mt-1 font-serif">Presidents cannot change their own executive role.</p>
                                    )}
                                  </div>

                                  <div className="space-y-1">
                                    <label className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Leadership Role</label>
                                    <select
                                      value={(editingRoles[user.uid] || user.roles).find(r => ROLE_CONFIG[r].category === 'leadership') || ''}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) => { e.stopPropagation();
                                        const val = e.target.value as UserRole;
                                        const other = (editingRoles[user.uid] || user.roles).filter(r => ROLE_CONFIG[r].category !== 'leadership');
                                        const next = val ? [...other, val] : other;
                                        setEditingRoles(prev => ({ ...prev, [user.uid]: Array.from(new Set(next)) }));
                                      }}
                                      className="w-full text-[10px] bg-white dark:bg-[#1e1e1a] text-gray-900 dark:text-white border border-gray-100 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] py-2"
                                    >
                                      <option value="">None</option>
                                      {(Object.entries(ROLE_CONFIG) as [UserRole, any][])
                                        .filter(([role, config]) => {
                                          if (config.category !== 'leadership') return false;
                                          if (!user.isCoreMember) return false;
                                          const currentUserRoles = editingRoles[user.uid] || user.roles;
                                          if (currentUserRoles.includes('president')) return false;
                                          const userMinistries = editingMinistries[user.uid] || user.ministries || [];
                                          if (role === 'choir_a_leader' && !userMinistries.includes('choir_a')) return false;
                                          if (role === 'choir_b_leader' && !userMinistries.includes('choir_b')) return false;
                                          if (role === 'lector_commentator_leader' && !userMinistries.includes('lector_commentator')) return false;
                                          if (role === 'usher_leader' && !userMinistries.includes('usher')) return false;
                                          if (role === 'altar_server_leader' && !userMinistries.includes('altar_server')) return false;
                                          if ((role === 'kitchen_leader' || role === 'kitchen_sub_leader') && !userMinistries.includes('kitchen')) return false;
                                          if ((role === 'cleaning_leader' || role === 'cleaning_sub_leader') && !userMinistries.includes('cleaning')) return false;
                                          return true;
                                        })
                                        .map(([role, config]) => (
                                        <option key={role} value={role}>
                                          {config.label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <label className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Liturgical</label>
                                    <div className="w-full bg-white dark:bg-[#1e1e1a] rounded-xl border border-gray-100 dark:border-white/10 overflow-hidden max-h-32 overflow-y-auto">
                                      {(Object.entries(MINISTRY_CONFIG) as [MinistryType, any][])
                                        .filter(([m, config]) => config.category === 'liturgical')
                                        .map(([m, config]) => {
                                          const current = editingMinistries[user.uid] || user.ministries || [];
                                          const isSelected = current.includes(m);
                                          const isChoir = m === 'choir_a' || m === 'choir_b';
                                          const hasChoir = current.includes('choir_a') || current.includes('choir_b');
                                          const hasNonChoir = current.some(x => MINISTRY_CONFIG[x].category === 'liturgical' && x !== 'choir_a' && x !== 'choir_b');
                                          const isDisabled = !isSelected && ((isChoir && hasNonChoir) || (!isChoir && hasChoir));
                                          return (
                                            <div key={m}>
                                              <button
                                                onClick={(e) => { e.stopPropagation();
                                                  if (isDisabled) return;
                                                  const otherMinistries = current.filter(x => MINISTRY_CONFIG[x].category !== 'liturgical');
                                                  let nextLiturgical: MinistryType[];
                                                  if (isSelected) {
                                                    nextLiturgical = current.filter(x => x !== m && MINISTRY_CONFIG[x].category === 'liturgical');
                                                    if (m === 'lector_commentator') {
                                                      setEditingLcRoles(prev => ({ ...prev, [user.uid]: [] }));
                                                    }
                                                  } else {
                                                    nextLiturgical = [...current.filter(x => MINISTRY_CONFIG[x].category === 'liturgical'), m];
                                                    if (m === 'lector_commentator') {
                                                      const currentLcRoles = editingLcRoles[user.uid] || user.lcRoles || [];
                                                      if (currentLcRoles.length === 0) {
                                                        setEditingLcRoles(prev => ({ ...prev, [user.uid]: ['Lector-Tag', 'Commentator-Tag'] }));
                                                      }
                                                    }
                                                  }
                                                  setEditingMinistries(prev => ({ ...prev, [user.uid]: [...nextLiturgical, ...otherMinistries] }));
                                                }}
                                                className={cn(
                                                  "w-full text-left px-3 py-2 text-[9px] transition-all border-b border-gray-50 dark:border-white/5 last:border-0 cursor-pointer",
                                                  isSelected ? "bg-[#5A5A40] dark:bg-[#8a8a65] text-white dark:text-[#11110f] font-bold" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#252520]",
                                                  isDisabled && "opacity-30 cursor-not-allowed"
                                                )}
                                              >
                                                {config.label}
                                              </button>
                                              {m === 'lector_commentator' && isSelected && (
                                                <div className="bg-gray-50/50 dark:bg-[#11110f]/40 px-4 py-2 flex flex-col gap-1 border-b border-gray-100 dark:border-white/5">
                                                  {['Lector-Tag', 'Lector-Eng', 'Commentator-Tag', 'Commentator-Eng'].map(lcRole => {
                                                    const activeLcRoles = editingLcRoles[user.uid] || user.lcRoles || [];
                                                    const isLcRoleSelected = activeLcRoles.includes(lcRole);
                                                    return (
                                                      <label key={lcRole} className="flex items-center gap-2 text-[9px] text-gray-750 dark:text-gray-400 cursor-pointer" onClick={e => e.stopPropagation()}>
                                                        <input 
                                                          type="checkbox"
                                                          checked={isLcRoleSelected}
                                                          onChange={(e) => {
                                                            const nextLcRoles = isLcRoleSelected 
                                                              ? activeLcRoles.filter(r => r !== lcRole)
                                                              : [...activeLcRoles, lcRole];
                                                            setEditingLcRoles(prev => ({ ...prev, [user.uid]: nextLcRoles }));
                                                          }}
                                                          className="text-[#5A5A40] focus:ring-[#5A5A40] rounded-sm"
                                                        />
                                                        {lcRole}
                                                      </label>
                                                    );
                                                  })}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                    </div>
                                  </div>

                                  <div className="space-y-1">
                                    <label className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Chore / Maintenance</label>
                                    <div className={cn(
                                      "w-full bg-white dark:bg-[#1e1e1a] rounded-xl border border-gray-100 dark:border-white/10 overflow-hidden max-h-32 overflow-y-auto",
                                      !user.isCoreMember && "opacity-50"
                                    )}>
                                      {(Object.entries(MINISTRY_CONFIG) as [MinistryType, any][])
                                        .filter(([m, config]) => config.category === 'chore')
                                        .map(([m, config]) => {
                                          if (!user.isCoreMember) return null;
                                          const current = editingMinistries[user.uid] || user.ministries || [];
                                          const isSelected = current.includes(m);
                                          if (m === 'cleaning_toilet_ok' || m === 'cleaning_toilet_ng') return null;
                                          return (
                                            <button
                                              key={m}
                                              disabled={!user.isCoreMember}
                                              onClick={(e) => { e.stopPropagation();
                                                const otherMinistries = current.filter(x => MINISTRY_CONFIG[x].category !== 'chore');
                                                let nextChore: MinistryType[];
                                                if (isSelected) {
                                                  nextChore = current.filter(x => x !== m && MINISTRY_CONFIG[x].category === 'chore');
                                                  if (m === 'cleaning') nextChore = nextChore.filter(x => x !== 'cleaning_toilet_ok' && x !== 'cleaning_toilet_ng');
                                                } else {
                                                  nextChore = [...current.filter(x => MINISTRY_CONFIG[x].category === 'chore'), m];
                                                  if (m === 'cleaning' && !nextChore.includes('cleaning_toilet_ok') && !nextChore.includes('cleaning_toilet_ng')) nextChore.push('cleaning_toilet_ng');
                                                }
                                                setEditingMinistries(prev => ({ ...prev, [user.uid]: [...nextChore, ...otherMinistries] }));
                                              }}
                                              className={cn(
                                                "w-full text-left px-3 py-2 text-[9px] transition-all border-b border-gray-50 dark:border-white/5 last:border-0 cursor-pointer",
                                                isSelected ? "bg-[#5A5A40] dark:bg-[#8a8a65] text-white dark:text-[#11110f] font-bold" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#252520]"
                                              )}
                                            >
                                              {config.label}
                                            </button>
                                          );
                                        })}
                                    </div>
                                    
                                    {user.isCoreMember && (editingMinistries[user.uid] || user.ministries || []).includes('cleaning') && (
                                      <div className="mt-2 p-3 bg-gray-50 dark:bg-[#252520]/40 rounded-xl border border-gray-100 dark:border-white/10 space-y-1">
                                        <label className="text-[8px] font-bold text-[#5A5A40] dark:text-[#8a8a65] uppercase tracking-widest block font-medium">Toilet Maintenance Status</label>
                                        <select
                                          value={(editingMinistries[user.uid] || user.ministries || []).find(m => m === 'cleaning_toilet_ok' || m === 'cleaning_toilet_ng') || 'cleaning_toilet_ng'}
                                          onClick={(e) => e.stopPropagation()}
                                          onChange={(e) => { e.stopPropagation();
                                            const val = e.target.value as MinistryType;
                                            const current = editingMinistries[user.uid] || user.ministries || [];
                                            const other = current.filter(x => x !== 'cleaning_toilet_ok' && x !== 'cleaning_toilet_ng');
                                            const next = val ? [...other, val] : other;
                                            setEditingMinistries(prev => ({ ...prev, [user.uid]: next }));
                                          }}
                                          className="w-full text-[10px] bg-white dark:bg-[#1e1e1a] text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 rounded-lg focus:ring-1 focus:ring-[#5A5A40] outline-none py-1.5 px-2"
                                        >
                                          <option value="cleaning_toilet_ok">Toilet OK</option>
                                          <option value="cleaning_toilet_ng">Toilet NG</option>
                                        </select>
                                      </div>
                                    )}
                                    {!user.isCoreMember && <div className="text-[7px] text-red-400 italic mt-1 font-serif">Note: Upgrade to Core Member to assign Chore roles</div>}
                                  </div>
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                  <div className="flex gap-2">
                                    {(editingRoles[user.uid] || editingMinistries[user.uid] || editingLcRoles[user.uid]) && (
                                      <>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); saveRoles(user.uid); }}
                                          className="px-6 py-2 bg-[#5A5A40] text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:shadow-lg transition-all cursor-pointer"
                                        >
                                          Apply Changes
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); cancelEditing(user.uid); }}
                                          className="px-6 py-2 bg-gray-100 dark:bg-[#252520] text-gray-500 dark:text-gray-400 text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-gray-200 dark:hover:bg-[#2e2e28] transition-all cursor-pointer"
                                        >
                                          Discard
                                        </button>
                                      </>
                                    )}
                                  </div>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); removeUser(user.uid); }}
                                    className="p-2 text-gray-300 hover:text-red-500 transition-all cursor-pointer"
                                    title="Remove Member"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-8 bg-white dark:bg-[#11110f]/45 rounded-2xl border border-gray-100 dark:border-white/5">
                                <p className="text-xs text-gray-400 dark:text-gray-500 font-serif italic">This member must be verified before role assignment.</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-32">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 border-b border-gray-100 dark:border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-serif text-gray-900 dark:text-white">Administrative Center</h1>
          <p className="text-gray-500 dark:text-gray-400 font-serif italic text-sm">Manage roles, permissions, and member verification.</p>
        </div>
      </div>

      {/* High-Fidelity Submenu Navigation */}
      <div className="bg-gray-50/50 dark:bg-[#11110f]/30 p-1.5 rounded-2xl border border-gray-100 dark:border-white/5 flex gap-1 overflow-x-auto scrollbar-none select-none">
        <button
          onClick={() => setActiveTab('pending')}
          className={cn(
            "flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 shrink-0 cursor-pointer",
            activeTab === 'pending'
              ? "bg-[#5A5A40] text-white shadow-xs dark:bg-[#8a8a65] dark:text-[#11110f]"
              : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100/50 dark:hover:bg-[#1e1e1a]"
          )}
        >
          <ShieldAlert size={15} />
          <span>Pending Requests</span>
          {pendingUsers.length > 0 && (
            <span className={cn(
              "ml-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold",
              activeTab === 'pending'
                ? "bg-white text-[#5A5A40] dark:bg-[#11110f] dark:text-[#8a8a65]"
                : "bg-yellow-500/10 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400"
            )}>
              {pendingUsers.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('members')}
          className={cn(
            "flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 shrink-0 cursor-pointer",
            activeTab === 'members'
              ? "bg-[#5A5A40] text-white shadow-xs dark:bg-[#8a8a65] dark:text-[#11110f]"
              : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100/50 dark:hover:bg-[#1e1e1a]"
          )}
        >
          <UserCheck size={15} />
          <span>Members Directory</span>
          {acceptedUsers.length > 0 && (
            <span className={cn(
              "ml-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold",
              activeTab === 'members'
                ? "bg-white text-[#5A5A40] dark:bg-[#11110f] dark:text-[#8a8a65]"
                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
            )}>
              {acceptedUsers.length}
            </span>
          )}
        </button>

        {isMessageManager && (
          <button
            onClick={() => setActiveTab('messages')}
            className={cn(
              "flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 shrink-0 cursor-pointer",
              activeTab === 'messages'
                ? "bg-[#5A5A40] text-white shadow-xs dark:bg-[#8a8a65] dark:text-[#11110f]"
                : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100/50 dark:hover:bg-[#1e1e1a]"
            )}
          >
            <Inbox size={15} />
            <span>Message Inbox</span>
            {messages.filter(m => m.status === 'unread').length > 0 && (
              <span className={cn(
                "ml-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold animate-pulse",
                activeTab === 'messages'
                  ? "bg-white text-[#5A5A40] dark:bg-[#11110f] dark:text-[#8a8a65]"
                  : "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400"
              )}>
                {messages.filter(m => m.status === 'unread').length}
              </span>
            )}
          </button>
        )}

        {canBroadcast && (
          <button
            onClick={() => setActiveTab('broadcast')}
            className={cn(
              "flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 shrink-0 cursor-pointer",
              activeTab === 'broadcast'
                ? "bg-[#5A5A40] text-white shadow-xs dark:bg-[#8a8a65] dark:text-[#11110f]"
                : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100/50 dark:hover:bg-[#1e1e1a]"
            )}
          >
            <Megaphone size={15} />
            <span>Broadcast Tool</span>
          </button>
        )}

        {isMessageManager && (
          <button
            onClick={() => setActiveTab('purge')}
            className={cn(
              "flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 shrink-0 cursor-pointer",
              activeTab === 'purge'
                ? "bg-[#5A5A40] text-white shadow-xs dark:bg-[#8a8a65] dark:text-[#11110f]"
                : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100/50 dark:hover:bg-[#1e1e1a]"
            )}
          >
            <UserX size={15} />
            <span>Security & Logs</span>
          </button>
        )}
      </div>

      {isMessageManager && messages.some(m => m.status === 'unread') && (
        <div className="bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 rounded-[24px] p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 rounded-xl">
              <Mail className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300">New Contact Messages</h4>
              <p className="text-xs text-amber-700/80 dark:text-amber-400/80 font-serif italic">
                You have {messages.filter(m => m.status === 'unread').length} unread message(s) waiting in your executive inbox.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setActiveTab('messages');
              setTimeout(() => {
                document.getElementById('messages-inbox-section')?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }}
            className="self-start sm:self-center px-4 py-2 bg-amber-600 hover:bg-amber-700 dark:bg-amber-500/25 dark:hover:bg-amber-500/45 text-white dark:text-amber-300 text-xs font-bold uppercase tracking-widest rounded-xl transition-all cursor-pointer"
          >
            Open Inbox &rarr;
          </button>
        </div>
      )}

      {activeTab === 'broadcast' && canBroadcast && (
        <section className="space-y-4">
          <BroadcastTool />
        </section>
      )}

      {activeTab === 'messages' && isMessageManager && (
        <section id="messages-inbox-section" className="bg-white dark:bg-[#1e1e1a] p-8 rounded-[32px] border border-gray-100 dark:border-white/5 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-serif text-gray-900 dark:text-white flex items-center gap-2">
                <Inbox className="text-[#5A5A40] dark:text-[#8a8a65]" size={22} />
                Executive Message Inbox
              </h2>
              <p className="text-xs text-gray-400 dark:text-gray-550 font-serif italic mt-0.5">
                Review and manage inquiries, suggestions, and feedback sent to KCFC.
              </p>
            </div>
            
            {/* Filter Tabs */}
            <div className="flex bg-gray-50 dark:bg-[#252520] p-1 rounded-xl w-fit border border-gray-100 dark:border-white/5">
              {(['unread', 'all', 'archived'] as const).map((tab) => {
                const count = tab === 'unread' 
                  ? messages.filter(m => m.status === 'unread').length 
                  : tab === 'archived'
                    ? messages.filter(m => m.status === 'archived').length
                    : messages.filter(m => m.status !== 'archived').length;

                return (
                  <button
                    key={tab}
                    onClick={() => {
                      setMessageFilter(tab);
                      setSelectedMessage(null);
                    }}
                    className={cn(
                      "px-3.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5",
                      messageFilter === tab
                        ? "bg-white dark:bg-[#11110f] text-[#5A5A40] dark:text-[#8a8a65] shadow-xs"
                        : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    )}
                  >
                    {tab}
                    {count > 0 && (
                      <span className={cn(
                        "px-1.5 py-0.5 rounded-full text-[8px] font-bold",
                        tab === 'unread'
                          ? "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                          : "bg-gray-100 text-gray-650 dark:bg-gray-800 dark:text-gray-400"
                      )}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {messagesLoading ? (
            <div className="py-12 text-center text-gray-400 dark:text-gray-550 italic font-serif text-sm">
              Syncing executive messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="py-12 bg-gray-50/50 dark:bg-[#11110f]/20 rounded-2xl border border-dashed border-gray-150 dark:border-white/5 text-center text-gray-400 dark:text-gray-500 font-serif italic text-xs">
              No messages have been received yet.
            </div>
          ) : (messages.filter(m => {
            if (messageFilter === 'unread') return m.status === 'unread';
            if (messageFilter === 'archived') return m.status === 'archived';
            return m.status !== 'archived';
          })).length === 0 ? (
            <div className="py-12 bg-gray-50/50 dark:bg-[#11110f]/20 rounded-2xl border border-dashed border-gray-150 dark:border-white/5 text-center text-gray-400 dark:text-gray-500 font-serif italic text-xs">
              No messages in "{messageFilter}" category.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[400px]">
              {/* Message List Sidebar */}
              <div className={cn(
                "lg:col-span-5 space-y-2 max-h-[500px] overflow-y-auto pr-2",
                selectedMessage && "hidden lg:block"
              )}>
                {messages
                  .filter(m => {
                    if (messageFilter === 'unread') return m.status === 'unread';
                    if (messageFilter === 'archived') return m.status === 'archived';
                    return m.status !== 'archived';
                  })
                  .map((msg) => {
                    const msgDate = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt || 0);
                    const formattedDate = format(msgDate, 'MMM d, yyyy h:mm a');
                    
                    return (
                      <div
                        key={msg.id}
                        onClick={() => setSelectedMessage(msg)}
                        className={cn(
                          "p-4 rounded-2xl border transition-all cursor-pointer text-left relative",
                          msg.status === 'unread'
                            ? "bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10 dark:bg-amber-500/[0.02]"
                            : "bg-gray-50/50 dark:bg-[#252520]/25 border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-[#252520]/40",
                          selectedMessage?.id === msg.id && "ring-2 ring-[#5A5A40] dark:ring-[#8a8a65] bg-white dark:bg-[#11110f]"
                        )}
                      >
                        {msg.status === 'unread' && (
                          <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        )}
                        
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white",
                            msg.status === 'unread' ? "bg-amber-600 dark:bg-amber-500/40" : "bg-gray-400 dark:bg-gray-650"
                          )}>
                            {msg.name ? msg.name.charAt(0).toUpperCase() : '?' }
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className={cn(
                              "text-xs truncate text-gray-900 dark:text-white",
                              msg.status === 'unread' ? "font-bold" : "font-medium"
                            )}>
                              {msg.name}
                            </h4>
                            <p className="text-[9px] text-gray-450 truncate">{msg.email}</p>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <h5 className={cn(
                            "text-xs truncate text-gray-800 dark:text-gray-300",
                            msg.status === 'unread' && "font-bold"
                          )}>
                            {msg.subject || "(No Subject)"}
                          </h5>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed font-serif italic">
                            {msg.message}
                          </p>
                          <div className="text-[8px] text-gray-400 text-right mt-1.5 font-sans">
                            {formattedDate}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Message Details Pane */}
              <div className={cn(
                "lg:col-span-7 bg-gray-50/50 dark:bg-[#252520]/25 rounded-[24px] border border-gray-100 dark:border-white/5 p-6 flex flex-col justify-between min-h-[350px]",
                !selectedMessage && "hidden lg:flex items-center justify-center text-center py-24"
              )}>
                {selectedMessage ? (
                  <div className="space-y-6 flex flex-col h-full justify-between">
                    <div className="space-y-6 text-left">
                      {/* Details Header */}
                      <div className="flex items-start justify-between border-b border-gray-100 dark:border-white/5 pb-4">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setSelectedMessage(null)}
                            className="lg:hidden px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-[10px] font-bold text-gray-650 dark:text-gray-400"
                          >
                            &larr; Back
                          </button>
                          <div className="w-10 h-10 rounded-full bg-[#5A5A40] text-white flex items-center justify-center font-bold text-sm">
                            {selectedMessage.name ? selectedMessage.name.charAt(0).toUpperCase() : '?' }
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">{selectedMessage.name}</h3>
                            <a
                              href={`mailto:${selectedMessage.email}`}
                              className="text-xs text-[#5A5A40] dark:text-[#8a8a65] hover:underline break-all"
                            >
                              {selectedMessage.email}
                            </a>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-[9px] text-gray-400 font-sans">
                            {selectedMessage.createdAt?.toDate 
                              ? format(selectedMessage.createdAt.toDate(), 'PPP p')
                              : (selectedMessage.createdAt ? format(new Date(selectedMessage.createdAt), 'PPP p') : 'Just now')}
                          </div>
                          <span className={cn(
                            "inline-block mt-1 px-2.5 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider",
                            selectedMessage.status === 'unread'
                              ? "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
                              : selectedMessage.status === 'archived'
                                ? "bg-purple-100 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400"
                                : "bg-green-100 text-green-600 dark:bg-green-950/40 dark:text-green-400"
                          )}>
                            {selectedMessage.status}
                          </span>
                        </div>
                      </div>

                      {/* Details Content */}
                      <div className="space-y-2">
                        <div className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">Subject</div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white font-serif">
                          {selectedMessage.subject || "(No Subject)"}
                        </h4>
                        
                        <div className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider pt-4">Message</div>
                        <div className="bg-white dark:bg-[#11110f]/45 p-5 rounded-2xl border border-gray-100 dark:border-white/5 text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap select-text font-serif">
                          {selectedMessage.message}
                        </div>
                      </div>

                      {/* Inline Gmail Reply Form */}
                      {isReplying ? (
                        <div className="mt-6 bg-white dark:bg-[#11110f]/60 p-5 rounded-2xl border border-amber-500/10 dark:border-amber-500/25 shadow-inner space-y-4">
                          <div className="flex items-center justify-between border-b border-gray-150 dark:border-white/5 pb-2.5">
                            <h5 className="text-[10px] font-extrabold uppercase tracking-widest text-[#5A5A40] dark:text-[#8a8a65] flex items-center gap-1.5">
                              <Mail size={12} />
                              Compose Gmail Response (Inline)
                            </h5>
                            <span className="text-[9px] text-gray-450 dark:text-gray-400 font-medium">To: {selectedMessage.email}</span>
                          </div>
                          
                          <div className="space-y-3">
                            <div>
                              <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Subject</label>
                              <input 
                                type="text" 
                                value={replySubject} 
                                onChange={(e) => setReplySubject(e.target.value)}
                                className="w-full text-xs bg-gray-50 dark:bg-white/5 border border-gray-150 dark:border-white/5 rounded-lg px-3 py-2 text-gray-900 dark:text-white focus:ring-1 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] outline-none transition-all font-medium"
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Message Body</label>
                              <textarea 
                                rows={6}
                                value={replyBody} 
                                onChange={(e) => setReplyBody(e.target.value)}
                                placeholder="Compose reply..."
                                className="w-full text-xs bg-gray-50 dark:bg-white/5 border border-gray-150 dark:border-white/5 rounded-lg p-3 text-gray-900 dark:text-white focus:ring-1 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] outline-none transition-all font-serif leading-relaxed"
                              />
                            </div>
                          </div>

                          {emailError && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-[11px] text-red-600 dark:text-red-400 flex items-center gap-2 font-medium">
                              <AlertCircle size={14} className="shrink-0" />
                              <span>{emailError}</span>
                            </div>
                          )}

                          <div className="flex justify-end gap-2.5 pt-2">
                            <button 
                              onClick={() => setIsReplying(false)}
                              className="px-3.5 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                              disabled={sendingEmail}
                            >
                              Cancel
                            </button>
                            <button 
                              onClick={handleSendReply}
                              disabled={sendingEmail}
                              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                            >
                              {sendingEmail ? (
                                <>
                                  <Loader2 size={12} className="animate-spin" />
                                  Sending...
                                </>
                              ) : (
                                <>
                                  <Send size={12} />
                                  Send Response
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ) : emailSuccess ? (
                        <div className="mt-6 bg-green-500/10 border border-green-500/20 p-4 rounded-2xl text-xs text-green-700 dark:text-green-400 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 font-medium">
                          <div className="flex items-center gap-2">
                            <Check size={16} className="text-green-600 dark:text-green-400 shrink-0" />
                            <span>Reply successfully sent to <strong>{selectedMessage.email}</strong> via Gmail!</span>
                          </div>
                          <button 
                            onClick={() => setEmailSuccess(false)}
                            className="text-[9px] uppercase tracking-widest font-extrabold text-green-600 dark:text-green-400 hover:underline"
                          >
                            Dismiss
                          </button>
                        </div>
                      ) : null}
                    </div>

                    {/* Details Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-6 border-t border-gray-100 dark:border-white/5 mt-auto">
                      <div className="flex flex-wrap gap-2">
                        {/* Toggle Read */}
                        <button
                          onClick={(e) => toggleReadStatus(selectedMessage, e)}
                          className={cn(
                            "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer",
                            selectedMessage.status === 'read'
                              ? "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200"
                              : "bg-amber-100 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 hover:bg-amber-200"
                          )}
                        >
                          {selectedMessage.status === 'read' ? <EyeOff size={12} /> : <Eye size={12} />}
                          {selectedMessage.status === 'read' ? 'Mark Unread' : 'Mark Read'}
                        </button>

                        {/* Toggle Archive */}
                        <button
                          onClick={(e) => toggleArchiveStatus(selectedMessage, e)}
                          className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          <Archive size={12} />
                          {selectedMessage.status === 'archived' ? 'Move to Inbox' : 'Archive'}
                        </button>

                        {/* Inline Gmail Reply Toggle */}
                        {!isReplying && (
                          <button
                            onClick={() => setIsReplying(true)}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                          >
                            <Reply size={12} />
                            Reply with Gmail
                          </button>
                        )}

                        {/* Mail Client Reply (Fallback) */}
                        <a
                          href={`mailto:${selectedMessage.email}?subject=Re: ${encodeURIComponent(selectedMessage.subject || 'KCFC Portal Inquiry')}`}
                          className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all"
                        >
                          <Mail size={12} />
                          Mail Client
                        </a>
                      </div>

                      {/* Delete */}
                      <button
                        onClick={(e) => deleteMessage(selectedMessage.id, e)}
                        className="p-2.5 text-gray-300 hover:text-red-500 transition-all cursor-pointer"
                        title="Delete Message"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-full bg-[#5A5A40]/10 flex items-center justify-center mx-auto">
                      <Mail className="w-6 h-6 text-[#5A5A40] dark:text-[#8a8a65]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">No Message Selected</h4>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500 font-serif italic mt-1 max-w-xs mx-auto">
                        Choose a message from the list to view its contents and initiate management actions.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Global search controller */}
      {(activeTab === 'pending' || activeTab === 'members') && (
        <div className="bg-white dark:bg-[#1e1e1a] p-6 rounded-[24px] border border-gray-100 dark:border-white/5 shadow-xs">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-550" size={18} />
            <input
              type="text"
              placeholder="Search all members by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-gray-50 dark:bg-[#252520] text-gray-900 dark:text-white rounded-xl border-none focus:ring-2 focus:ring-[#5A5A40] dark:focus:ring-[#8a8a65] outline-none transition-all"
            />
          </div>
        </div>
      )}

      {/* Section 1: Pending Membership Requests */}
      {activeTab === 'pending' && (
        <div className="bg-white dark:bg-[#1e1e1a] p-8 rounded-[32px] border border-yellow-250/20 dark:border-yellow-500/10 shadow-xs space-y-6">
          <div>
            <h2 className="text-lg font-serif font-bold text-gray-900 dark:text-[#f5f5f0] flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse" />
              Pending Membership Requests ({pendingUsers.length})
            </h2>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 font-serif italic mt-0.5">
              New registration requests requiring validation before access is enabled.
            </p>
          </div>

          {/* Quick-setup and custom manual addition area */}
          <div className="bg-[#5A5A40]/5 dark:bg-[#252520] p-6 rounded-2xl border border-[#5A5A40]/15 dark:border-white/5 space-y-4">
            <h3 className="text-xs font-semibold text-[#5A5A40] dark:text-[#8a8a65] flex items-center gap-2">
              <UserPlus size={16} />
              Manual Member Registration Helper (Client-Side)
            </h3>
            <p className="text-[11px] text-gray-650 dark:text-gray-400 leading-relaxed">
              In sandbox environments, the server-side backend service account is restricted from updating Firestore directly (throwing <code>7 PERMISSION_DENIED</code>). However, because you are authenticated as <strong>kcfc.jp@gmail.com</strong>, your browser session bypasses rules and holds full write authorization! You can easily register pending accounts below:
            </p>

            {/* Quick Actions for Kaizen and Phil */}
            {(!hasKaizen || !hasPhil) && (
              <div className="flex flex-col gap-2 pt-2">
                <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Quick-add requested pending accounts:</span>
                <div className="flex flex-wrap gap-2">
                  {!hasKaizen && (
                    <button
                      onClick={() => quickAddPendingUser('kaizen.webmktg@gmail.com', 'Kaizen WebMktg')}
                      className="px-3 py-1.5 bg-[#5A5A40] hover:bg-[#484833] text-white text-xs font-medium rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <UserPlus size={13} />
                      Add kaizen.webmktg@gmail.com (Pending)
                    </button>
                  )}
                  {!hasPhil && (
                    <button
                      onClick={() => quickAddPendingUser('philbalgotr@gmail.com', 'Phil Balgotr')}
                      className="px-3 py-1.5 bg-[#5A5A40] hover:bg-[#484833] text-white text-xs font-medium rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <UserPlus size={13} />
                      Add philbalgotr@gmail.com (Pending)
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Standard Custom Member Addition Form */}
            <div className="pt-2 border-t border-gray-150 dark:border-white/5 space-y-2">
              <span className="text-[10px] font-medium text-gray-550 dark:text-gray-400 uppercase tracking-wider block">Or register any other new pending member:</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Full Name (e.g., John Doe)"
                  value={newPendingName}
                  onChange={(e) => setNewPendingName(e.target.value)}
                  className="px-3 py-2 text-xs bg-white dark:bg-[#1e1e1a] text-gray-900 dark:text-white rounded-lg border border-gray-200 dark:border-white/10 outline-none focus:ring-1 focus:ring-[#5A5A40]"
                />
                <input
                  type="email"
                  placeholder="Email (e.g., john@example.com)"
                  value={newPendingEmail}
                  onChange={(e) => setNewPendingEmail(e.target.value)}
                  className="px-3 py-2 text-xs bg-white dark:bg-[#1e1e1a] text-gray-900 dark:text-white rounded-lg border border-gray-200 dark:border-white/10 outline-none focus:ring-1 focus:ring-[#5A5A40]"
                />
                <button
                  onClick={async () => {
                    if (!newPendingName.trim() || !newPendingEmail.trim()) {
                      alert("Please enter both a name and a valid email.");
                      return;
                    }
                    setIsAddingPending(true);
                    await quickAddPendingUser(newPendingEmail, newPendingName);
                    setNewPendingName('');
                    setNewPendingEmail('');
                    setIsAddingPending(false);
                  }}
                  disabled={isAddingPending}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 text-white text-xs font-semibold rounded-lg shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isAddingPending ? (
                    <RefreshCw className="animate-spin" size={13} />
                  ) : (
                    <UserPlus size={13} />
                  )}
                  Register Member (Pending)
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-gray-400 dark:text-gray-500 italic font-serif text-sm">Syncing requests...</div>
          ) : renderTable(pendingUsers)}
        </div>
      )}

      {/* Section 2: Accepted Community Directory */}
      {activeTab === 'members' && (
        <div className="bg-white dark:bg-[#1e1e1a] p-8 rounded-[32px] border border-gray-100 dark:border-white/5 shadow-xs space-y-6">
          <div>
            <h2 className="text-lg font-serif font-bold text-gray-900 dark:text-[#f5f5f0] flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              Registered Members Directory ({acceptedUsers.length})
            </h2>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 font-serif italic mt-0.5">
              Active verified congregation list with configured permissions, choreography, and leadership profiles.
            </p>
          </div>
          {loading ? (
            <div className="py-12 text-center text-gray-400 dark:text-gray-550 italic font-serif text-sm">Syncing member directory...</div>
          ) : renderTable(acceptedUsers)}
        </div>
      )}

      {activeTab === 'purge' && (profile?.roles || []).some(r => ['admin', 'president'].includes(r)) && (
        <div className="bg-white dark:bg-[#1e1e1a] p-8 rounded-[32px] border border-gray-100 dark:border-white/5 shadow-sm space-y-6">
          <div>
            <h2 className="text-xl font-serif text-gray-900 dark:text-white flex items-center gap-2">
              <UserX className="text-red-500" size={20} />
              Advanced Authentication Purge
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-serif italic mt-1">
              Directly delete a Firebase Authentication account and corresponding datastores by email. This is useful if a member profile document was deleted manually but their login credentials remain active in Auth.
            </p>
          </div>

          <form onSubmit={handlePurgeEmail} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-4">
                User Email Address to Purge
              </label>
              <input
                type="email"
                required
                disabled={purging}
                placeholder="e.g. rbombeo72@gmail.co"
                value={purgeEmail}
                onChange={e => setPurgeEmail(e.target.value)}
                className="w-full px-6 py-4 bg-gray-50 dark:bg-[#252520] text-gray-900 dark:text-white border-none rounded-2xl focus:ring-2 focus:ring-red-500 dark:focus:ring-red-600 outline-none transition-all disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={purging}
              className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold uppercase tracking-widest text-[10px] shadow-lg hover:bg-red-700 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer h-14"
            >
              {purging ? "Purging..." : "Purge Auth Credentials"}
            </button>
          </form>

          {/* Real-time Server Administration Logs */}
          <div className="pt-6 border-t border-gray-100 dark:border-white/5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-550 uppercase tracking-widest flex items-center gap-2">
                  <FileText size={14} className="text-[#5A5A40] dark:text-[#8a8a65]" />
                  Direct Service Connection Logs
                </h3>
                <p className="text-[9px] text-gray-400 dark:text-gray-550 font-serif italic mt-0.5">
                  Real-time back-end operation stream and authorization status indicators.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchLogs}
                disabled={loadingLogs}
                className="self-start sm:self-center px-4 py-2.5 bg-gray-100 dark:bg-[#252520] hover:bg-gray-200 dark:hover:bg-[#2e2e28] text-gray-600 dark:text-gray-400 text-[9px] font-bold uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw size={10} className={cn(loadingLogs && "animate-spin")} />
                {loadingLogs ? "Fetching..." : "Refresh Logs"}
              </button>
            </div>
            <div className="bg-gray-50 dark:bg-[#11110f]/60 p-4 rounded-2xl border border-gray-100 dark:border-white/5 font-mono text-[9px] leading-relaxed text-gray-600 dark:text-gray-400 overflow-y-auto max-h-56 block whitespace-pre select-text">
              {serverLogs || "No logs available. Perform a purge action or hit 'Refresh Logs'."}
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {disablingUser && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#1e1e1a] rounded-[32px] p-8 max-w-sm w-full shadow-2xl border border-gray-100 dark:border-white/5 text-center space-y-5"
            >
              <div className="w-16 h-16 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto">
                <Ban size={28} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Disable Member Account?</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                  Are you sure you want to block <strong className="text-gray-800 dark:text-[#f5f5f0]">{disablingUser.displayName}</strong>? They will be immediately signed out and restricted from logging in to the portal.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setDisablingUser(null)}
                  className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-750 text-gray-600 dark:text-gray-400 rounded-2xl text-[11px] font-bold uppercase tracking-widest transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const u = disablingUser;
                    setDisablingUser(null);
                    try {
                      await updateDoc(doc(db, 'users', u.uid), {
                        isDisabled: true,
                        updatedAt: serverTimestamp()
                      });
                      setUsers(prev => prev.map(item => item.uid === u.uid ? { ...item, isDisabled: true } : item));
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-[11px] font-bold uppercase tracking-widest transition-all cursor-pointer shadow-sm"
                >
                  Yes, Disable
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
