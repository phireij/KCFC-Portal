import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../../lib/firebase';
import { collection, getDocs, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { sendGmail } from '../../lib/gmail';
import { 
  Megaphone, 
  Send, 
  Users, 
  Shield, 
  MessageSquare, 
  AlertTriangle, 
  CheckCircle2, 
  Bold, 
  Italic, 
  List, 
  Heading, 
  Smile, 
  Globe, 
  Mail,
  UserCheck,
  UserX,
  PhoneOff,
  Search,
  X
} from 'lucide-react';
import { UserProfile, MinistryType } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { buildLeadershipBroadcastCreatorPlan, shouldDispatchPwaForPlan } from '../../lib/broadcastCreatorPlan';
import { appendCommunicationNotificationsToBatch, persistCommunicationDeliveryOutcome } from '../../lib/communicationFirestore';

export default function BroadcastTool() {
  const [selectedTargets, setSelectedTargets] = useState<string[]>(['all']);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sendInPortal, setSendInPortal] = useState(true);
  const [sendByEmail, setSendByEmail] = useState(false);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successDetails, setSuccessDetails] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedIndividualIds, setSelectedIndividualIds] = useState<string[]>([]);
  const [individualSearch, setIndividualSearch] = useState('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
      } catch (err) {
        console.error("Error fetching users in BroadcastTool:", err);
      }
    };
    fetchUsers();
  }, []);

  const toggleTarget = (t: string) => {
    if (t === 'all') {
      setSelectedTargets(['all']);
      return;
    }
    
    let next = [...selectedTargets].filter(x => x !== 'all');
    if (next.includes(t)) {
      next = next.filter(x => x !== t);
    } else {
      next.push(t);
    }
    
    if (next.length === 0) {
      next = ['all'];
    }
    setSelectedTargets(next);
  };

  const getFilteredRecipientsForTarget = (t: string) => {
    if (t === 'all') {
      return users;
    } else if (t === 'individuals') {
      return users.filter(u => selectedIndividualIds.includes(u.uid));
    } else if (t === 'core_members') {
      return users.filter(u => u.isCoreMember === true);
    } else if (t === 'regular_members') {
      return users.filter(u => !u.isCoreMember);
    } else if (t === 'missing_fullname') {
      return users.filter(u => !u.displayName || u.displayName.trim() === '' || u.displayName.toLowerCase() === u.email?.toLowerCase());
    } else if (t === 'missing_nickname') {
      return users.filter(u => !u.nickname || u.nickname.trim() === '');
    } else if (t === 'missing_phone') {
      return users.filter(u => !u.phoneNumber || u.phoneNumber.trim() === '');
    } else if (t === 'lector_only') {
      return users.filter(u => u.ministries?.includes('lector_commentator') && u.lcRoles?.some(r => r.toLowerCase().includes('lector')));
    } else if (t === 'commentator_only') {
      return users.filter(u => u.ministries?.includes('lector_commentator') && u.lcRoles?.some(r => r.toLowerCase().includes('commentator')));
    } else {
      return users.filter(u => u.ministries?.includes(t as MinistryType));
    }
  };

  const getFilteredRecipients = () => {
    if (selectedTargets.length === 0) return [];
    const allMatched = new Map<string, UserProfile>();
    selectedTargets.forEach(t => {
      const matchedUsers = getFilteredRecipientsForTarget(t);
      matchedUsers.forEach(u => {
        allMatched.set(u.uid, u);
      });
    });
    return Array.from(allMatched.values()).filter(u => !u.isDisabled);
  };

  const filteredRecipients = getFilteredRecipients();

  const handleSend = async () => {
    if (!title || !message) return;
    if (!sendInPortal && !sendByEmail) {
      alert("Please select at least one delivery channel (Portal or Email).");
      return;
    }
    
    const getTargetLabel = () => {
      return selectedTargets.map(t => {
        if (t === 'all') return 'All Members';
        if (t === 'individuals') return 'Selected Individual(s)';
        if (t === 'core_members') return 'Core Group Members';
        if (t === 'regular_members') return 'Regular Members';
        if (t === 'missing_fullname') return 'Members missing Full Name';
        if (t === 'missing_nickname') return 'Members missing Nickname';
        if (t === 'missing_phone') return 'Members missing Contact Number';
        if (t === 'lector_only') return 'Lectors Only';
        if (t === 'commentator_only') return 'Commentators Only';
        return MINISTRY_LABELS[t] || t;
      }).join(', ');
    };

    const targetLabel = getTargetLabel();
    const channels = [];
    if (sendInPortal) channels.push("PWA/Portal alerts");
    if (sendByEmail) channels.push("Emails");

    if (!confirm(`Send this broadcast to ${filteredRecipients.length} members (${targetLabel}) via ${channels.join(" and ")}?`)) {
      return;
    }

    setSending(true);
    const broadcastId = `broadcast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const creatorPlan = buildLeadershipBroadcastCreatorPlan({
      recipients: filteredRecipients,
      broadcastId,
      title,
      message,
      allowPwa: sendInPortal,
      allowEmail: sendByEmail,
    });
    let notificationIdsByUser: Record<string, string[]> = {};
    try {
      // 1. Always create the durable KCFC Inbox record; secondary channels remain preference-aware.
      {
        const batch = writeBatch(db);
        const persistedPlan = appendCommunicationNotificationsToBatch(batch, db, creatorPlan);
        await batch.commit();
        notificationIdsByUser = persistedPlan.notificationIdsByUser;

        // Trigger native smartphone alert only when the leader selected Portal/PWA delivery.
        if (sendInPortal) {
          try {
          const currentUser = auth.currentUser;
          if (currentUser && shouldDispatchPwaForPlan(creatorPlan)) {
            const idToken = await currentUser.getIdToken();
            const fcmBody = message
              .replace(/\[name\]/gi, 'Member')
              .replace(/\{name\}/gi, 'Member')
              .replace(/\[nickname\]/gi, 'Member')
              .replace(/\{nickname\}/gi, 'Member');

            const pResponse = await fetch('/api/admin/broadcast-custom-push', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
              },
              body: JSON.stringify({
                userIds: creatorPlan.pushRecipientIds,
                recipientTokens: creatorPlan.pushTokens,
                notificationIdsByUser: persistedPlan.notificationIdsByUser,
                title: `Broadcast: ${title}`,
                body: fcmBody,
                clickAction: '/inbox'
              })
            });
            const pResult = await pResponse.json();
            console.info('FCM smartphone alerts dispatch completed:', pResult);
            if (typeof pResult.persistedDeliveryRecords === 'number') {
              console.info('KCFC Inbox PWA delivery evidence persisted for records:', pResult.persistedDeliveryRecords);
            }
          }
          } catch (pushErr) {
            console.error('FCM smartphone alerts dispatch failed:', pushErr);
          }
        }
      }

      // 2. Send via Email (Direct Gmail API integration)
      let emailStats = "";
      if (sendByEmail) {
        const emailRecipientIds = new Set(creatorPlan.emailRecipientIds);
        const recipientList = filteredRecipients
          .filter(u => emailRecipientIds.has(u.uid) && !!u.email && u.email.includes('@'));

        if (recipientList.length === 0) {
          throw new Error("No recipients with valid email addresses found for this target group.");
        }

        let successCount = 0;
        let failCount = 0;
        const failedRecipients: string[] = [];

        for (const u of recipientList) {
          try {
            const recipientEmail = u.email!;
            const recipientName = u.displayName || 'Member';
            const recipientNickname = u.nickname || recipientName;

            // Personalize body content
            const personalizedBody = message
              .replace(/\[name\]/gi, recipientName)
              .replace(/\{name\}/gi, recipientName)
              .replace(/\[nickname\]/gi, recipientNickname)
              .replace(/\{nickname\}/gi, recipientNickname);

            // Construct beautifully styled HTML email matching the Liturgical Scheduler aesthetic
            const personalizedHtml = `
              <div style="font-family: sans-serif; padding: 30px; max-width: 600px; margin: 0 auto; background-color: #F7F9FC; border: 1px solid #DDE5EE; border-radius: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                <div style="background-color: #123B66; color: white; padding: 25px; border-radius: 12px; text-align: center; margin-bottom: 25px;">
                  <h1 style="margin: 0; font-size: 20px; font-weight: normal; font-family: serif; letter-spacing: 0.5px;">KCFC Community Portal</h1>
                  <p style="margin: 5px 0 0 0; font-size: 11px; opacity: 0.85; text-transform: uppercase; letter-spacing: 1px;">Official Community Broadcast</p>
                </div>
                <h2 style="color: #172033; border-bottom: 2px solid #123B66; padding-bottom: 12px; margin-top: 0; font-family: serif; font-size: 18px; line-height: 1.4;">${title}</h2>
                <div style="font-size: 14px; line-height: 1.6; color: #172033; white-space: pre-wrap; margin-top: 20px; margin-bottom: 25px;">${personalizedBody}</div>
                <hr style="border: 0; border-top: 1px solid #DDE5EE; margin: 25px 0;" />
                <p style="font-size: 11px; color: #64748B; font-style: italic; margin-bottom: 0; line-height: 1.4; text-align: center;">
                  This broadcast email was dispatched to you on behalf of the KCFC community. If you do not want to receive these broadcasts, you can update your notification preferences in My Profile.
                </p>
              </div>
            `;

            await sendGmail(recipientEmail, title, personalizedHtml);
            const notificationIds = notificationIdsByUser[u.uid] || [];
            if (notificationIds.length > 0) {
              await persistCommunicationDeliveryOutcome({
                firestore: db,
                notificationIds,
                userId: u.uid,
                channel: 'email',
                status: 'sent',
                detail: 'Accepted by the authorized Gmail send path.',
              });
            }
            successCount++;
          } catch (mailErr: any) {
            console.error(`Failed to send email to ${u.email}:`, mailErr);
            const notificationIds = notificationIdsByUser[u.uid] || [];
            if (notificationIds.length > 0) {
              try {
                await persistCommunicationDeliveryOutcome({
                  firestore: db,
                  notificationIds,
                  userId: u.uid,
                  channel: 'email',
                  status: 'failed',
                  detail: mailErr?.message || 'Gmail send failed.',
                });
              } catch (evidenceErr) {
                console.error('Failed to persist Gmail delivery evidence:', evidenceErr);
              }
            }
            failCount++;
            failedRecipients.push(u.email || 'Unknown Email');
          }
        }

        if (failCount > 0) {
          emailStats = `Sent ${successCount} emails successfully via Gmail. Failed for ${failCount} recipients: ${failedRecipients.join(', ')}.`;
        } else {
          emailStats = `Successfully sent ${successCount} emails directly via your authorized Gmail account!`;
        }
      }

      setSuccessDetails(`Broadcast successfully completed! ${sendInPortal ? "Portal notices updated." : ""} ${sendByEmail ? emailStats : ""}`);
      setSuccess(true);
      setTitle('');
      setMessage('');
      setTimeout(() => {
        setSuccess(false);
        setSuccessDetails('');
      }, 5000);
    } catch (err: any) {
      console.error(err);
      alert(`Failed to send broadcast: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const insertText = (before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);

    const replacement = before + (selected || '') + after;
    const nextValue = text.substring(0, start) + replacement + text.substring(end);
    
    setMessage(nextValue);
    
    setTimeout(() => {
      textarea.focus();
      const nextPos = start + before.length + (selected || '').length;
      textarea.setSelectionRange(nextPos, nextPos);
    }, 0);
  };

  const MINISTRY_LABELS: Record<string, string> = {
    choir_a: 'Choir A',
    choir_b: 'Choir B',
    lector_commentator: 'Lectors/Comm.',
    usher: 'Ushers',
    altar_server: 'Altar Servers',
    kitchen: 'Kitchen',
    cleaning: 'Cleaning'
  };

  const emojis = [
    '📢', '⚠️', '⛪', '📅', '🔔', '✉️', '🙏', '✨', 
    '🙌', '❤️', '👍', '😊', '📌', '💡', '🕒', '💬',
    '🎉', '🌟', '🤝', '🍕', '🧹', '🥪', '🍜', '☕'
  ];

  return (
    <section className="kcfc-surface overflow-hidden p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200">
          <Megaphone size={24} />
        </div>
        <div>
          <h2 className="text-[22px] font-extrabold tracking-tight text-[#172033] dark:text-white">Broadcast System</h2>
          <p className="mt-1 text-[13px] leading-5 text-slate-500 dark:text-slate-400">Every broadcast keeps a durable KCFC Inbox copy; PWA and email are secondary alerts.</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Dynamic Filters */}
        <div className="space-y-3">
          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1 block">Target Audience Group ({filteredRecipients.length} members selected)</span>
          
          <div className="space-y-4 bg-gray-50/50 dark:bg-slate-950/30 p-5 rounded-3xl border border-gray-150 dark:border-white/5">
            {/* Standard filters */}
            <div>
              <span className="text-[8px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-2 font-medium">Standard Roles (Click to select/toggle)</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => toggleTarget('all')}
                  className={cn(
                    "min-h-11 px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer",
                    selectedTargets.includes('all') 
                      ? "bg-[#123B66] border-[#123B66] text-white shadow-xs" 
                      : "bg-white dark:bg-slate-900 border-gray-150 dark:border-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                  )}
                >
                  All Members ({users.length})
                </button>
                
                <button
                  type="button"
                  onClick={() => toggleTarget('core_members')}
                  className={cn(
                    "min-h-11 px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer",
                    selectedTargets.includes('core_members') 
                      ? "bg-orange-600 border-orange-600 text-white shadow-xs" 
                      : "bg-white dark:bg-slate-900 border-orange-100/30 dark:border-orange-950/20 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                  )}
                >
                  Core Members ({users.filter(u => u.isCoreMember === true).length})
                </button>

                <button
                  type="button"
                  onClick={() => toggleTarget('regular_members')}
                  className={cn(
                    "min-h-11 px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer",
                    selectedTargets.includes('regular_members') 
                      ? "bg-blue-600 border-blue-600 text-white shadow-xs" 
                      : "bg-white dark:bg-slate-900 border-blue-100/30 dark:border-blue-950/20 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                  )}
                >
                  Regular Members ({users.filter(u => !u.isCoreMember).length})
                </button>

                <button
                  type="button"
                  onClick={() => toggleTarget('individuals')}
                  className={cn(
                    "min-h-11 px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer",
                    selectedTargets.includes('individuals') 
                      ? "bg-green-600 border-green-600 text-white shadow-xs" 
                      : "bg-white dark:bg-slate-900 border-green-100/30 dark:border-green-950/20 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/20"
                  )}
                >
                  <Users size={12} />
                  Specific Member(s) ({selectedIndividualIds.length})
                </button>
              </div>
            </div>

            {/* Profile incompleteness filters */}
            <div className="pt-2 border-t border-gray-100 dark:border-white/5">
              <span className="text-[8px] font-bold text-[#64748B] dark:text-slate-400 uppercase tracking-widest block mb-2 font-medium">Profile completeness actions</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => toggleTarget('missing_fullname')}
                  className={cn(
                    "min-h-11 px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer",
                    selectedTargets.includes('missing_fullname') 
                      ? "bg-red-650 border-red-650 text-white shadow-xs" 
                      : "bg-white dark:bg-slate-900 border-red-100/30 dark:border-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20"
                  )}
                >
                  <UserX size={12} />
                  Missing Full Name ({users.filter(u => !u.displayName || u.displayName.trim() === '' || u.displayName.toLowerCase() === u.email?.toLowerCase()).length})
                </button>

                <button
                  type="button"
                  onClick={() => toggleTarget('missing_nickname')}
                  className={cn(
                    "min-h-11 px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer",
                    selectedTargets.includes('missing_nickname') 
                      ? "bg-amber-600 border-amber-600 text-white shadow-xs" 
                      : "bg-white dark:bg-slate-900 border-amber-100/30 dark:border-amber-950/20 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                  )}
                >
                  <Smile size={12} />
                  Missing Nickname ({users.filter(u => !u.nickname || u.nickname.trim() === '').length})
                </button>

                <button
                  type="button"
                  onClick={() => toggleTarget('missing_phone')}
                  className={cn(
                    "min-h-11 px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer",
                    selectedTargets.includes('missing_phone') 
                      ? "bg-teal-600 border-teal-600 text-white shadow-xs" 
                      : "bg-white dark:bg-slate-900 border-[#123B66]/10 dark:border-teal-950/20 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/20"
                  )}
                >
                  <PhoneOff size={12} />
                  Missing Contact No. ({users.filter(u => !u.phoneNumber || u.phoneNumber.trim() === '').length})
                </button>
              </div>
            </div>

            {/* Ministry Specific filters */}
            <div className="pt-2 border-t border-gray-100 dark:border-white/5">
              <span className="text-[8px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-2 font-medium">Ministries & Committees (Multiple selections allowed)</span>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(MINISTRY_LABELS).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => toggleTarget(val)}
                    className={cn(
                      "min-h-11 px-3 py-2 rounded-xl text-[11px] font-bold transition-all border cursor-pointer",
                      selectedTargets.includes(val) 
                        ? "bg-[#2563EB] border-[#2563EB] text-white shadow-xs" 
                        : "bg-white dark:bg-slate-900 border-gray-150 dark:border-white/5 text-gray-550 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                    )}
                  >
                    {label} ({users.filter(u => u.ministries?.includes(val as MinistryType)).length})
                  </button>
                ))}

                {/* Sub-groups for Lectors and Commentators */}
                <button
                  type="button"
                  onClick={() => toggleTarget('lector_only')}
                  className={cn(
                    "min-h-11 px-3 py-2 rounded-xl text-[11px] font-bold transition-all border cursor-pointer",
                    selectedTargets.includes('lector_only')
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-xs" 
                      : "bg-white dark:bg-slate-900 border-indigo-100/30 dark:border-indigo-950/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20"
                  )}
                >
                  Lectors Only ({users.filter(u => u.ministries?.includes('lector_commentator') && u.lcRoles?.some(r => r.toLowerCase().includes('lector'))).length})
                </button>

                <button
                  type="button"
                  onClick={() => toggleTarget('commentator_only')}
                  className={cn(
                    "min-h-11 px-3 py-2 rounded-xl text-[11px] font-bold transition-all border cursor-pointer",
                    selectedTargets.includes('commentator_only')
                      ? "bg-[#1d4ed8] border-[#1d4ed8] text-white shadow-xs" 
                      : "bg-white dark:bg-slate-900 border-blue-100/30 dark:border-blue-950/20 text-blue-600 dark:text-[#60a5fa] hover:bg-blue-50 dark:hover:bg-blue-950/20"
                  )}
                >
                  Commentators Only ({users.filter(u => u.ministries?.includes('lector_commentator') && u.lcRoles?.some(r => r.toLowerCase().includes('commentator'))).length})
                </button>
              </div>
            </div>

            {/* Specific Individual Selection */}
            {selectedTargets.includes('individuals') && (
              <div className="pt-3 border-t border-gray-100 dark:border-white/5 space-y-3">
                <span className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-widest block font-medium">Select Specific Member(s)</span>
                
                {/* Selected Members badges */}
                {selectedIndividualIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-green-500/5 rounded-2xl border border-green-500/10">
                    {selectedIndividualIds.map(uid => {
                      const u = users.find(usr => usr.uid === uid);
                      if (!u) return null;
                      return (
                        <span 
                          key={uid} 
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-[#123B66] text-white shadow-xs"
                        >
                          {u.displayName || u.email}
                          <button 
                            type="button"
                            aria-label={`Remove ${u.displayName || u.email || 'member'} from selection`}
                            onClick={() => setSelectedIndividualIds(selectedIndividualIds.filter(id => id !== uid))}
                            className="min-h-11 min-w-11 inline-flex items-center justify-center hover:bg-white/20 rounded-full transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Member Search */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    aria-label="Search members by name or email"
                    placeholder="Search member by name or email..."
                    value={individualSearch}
                    onChange={(e) => setIndividualSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/5 rounded-2xl text-xs focus:ring-1 focus:ring-green-500 outline-none text-gray-900 dark:text-white"
                  />
                </div>

                {/* Search Results list */}
                {individualSearch.trim().length > 0 && (
                  <div className="max-h-40 overflow-y-auto divide-y divide-gray-100 dark:divide-white/5 border border-gray-200 dark:border-white/5 rounded-2xl bg-white dark:bg-slate-900">
                    {users
                      .filter(u => {
                        const searchLower = individualSearch.toLowerCase();
                        const matchesName = (u.displayName || '').toLowerCase().includes(searchLower);
                        const matchesNick = (u.nickname || '').toLowerCase().includes(searchLower);
                        const matchesEmail = (u.email || '').toLowerCase().includes(searchLower);
                        return matchesName || matchesNick || matchesEmail;
                      })
                      .map(u => {
                        const isSelected = selectedIndividualIds.includes(u.uid);
                        return (
                          <button
                            type="button"
                            key={u.uid}
                            aria-pressed={isSelected}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedIndividualIds(selectedIndividualIds.filter(id => id !== u.uid));
                              } else {
                                setSelectedIndividualIds([...selectedIndividualIds, u.uid]);
                              }
                            }}
                            className={cn(
                              "min-h-11 w-full p-2.5 text-left text-xs flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                              isSelected && "bg-green-500/5"
                            )}
                          >
                            <div className="flex flex-col">
                              <span className="font-bold">{u.displayName || 'Unnamed Member'} {u.nickname ? `(${u.nickname})` : ''}</span>
                              <span className="text-[10px] text-gray-400 dark:text-gray-500">{u.email}</span>
                            </div>
                            <div className={cn(
                              "w-4 h-4 rounded-full border flex items-center justify-center transition-all",
                              isSelected ? "bg-green-600 border-green-600 text-white" : "border-gray-350 dark:border-white/10"
                            )}>
                              {isSelected && <span className="text-[10px]">✓</span>}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Channels Selector */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1 block">Broadcast Distribution Channels</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              aria-pressed={sendInPortal}
              onClick={() => setSendInPortal(!sendInPortal)}
              className={cn(
                "min-h-16 p-4 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                sendInPortal 
                  ? "bg-[#EAF3FF] dark:bg-blue-500/10 border-blue-200 dark:border-blue-400/20 text-[#123B66] dark:text-blue-200" 
                  : "bg-white dark:bg-slate-900 border-gray-150 dark:border-white/5 text-gray-500 dark:text-gray-400"
              )}
            >
              <div className={cn(
                "p-2 rounded-xl",
                sendInPortal ? "bg-[#2563EB] text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-400"
              )}>
                <Globe size={18} />
              </div>
              <div>
                <div className="font-bold text-xs uppercase tracking-wider">PWA / Portal Alert</div>
                <div className="text-[10px] font-serif italic mt-1 text-gray-400 dark:text-gray-500">Sends the member a PWA alert while the KCFC Inbox remains the durable copy.</div>
              </div>
            </button>

            <button
              type="button"
              aria-pressed={sendByEmail}
              onClick={() => setSendByEmail(!sendByEmail)}
              className={cn(
                "min-h-16 p-4 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                sendByEmail 
                  ? "bg-blue-50 dark:bg-blue-950/10 border-blue-200 dark:border-blue-950/40 text-blue-905 dark:text-blue-200" 
                  : "bg-white dark:bg-slate-900 border-gray-150 dark:border-white/5 text-gray-500 dark:text-gray-400"
              )}
            >
              <div className={cn(
                "p-2 rounded-xl",
                sendByEmail ? "bg-blue-500 text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-400"
              )}>
                <Mail size={18} />
              </div>
              <div>
                <div className="font-bold text-xs uppercase tracking-wider">Email Partner Alert</div>
                <div className="text-[10px] font-serif italic mt-1 text-gray-400 dark:text-gray-500">Sends to eligible members' registered email while retaining the KCFC Inbox copy.</div>
              </div>
            </button>
          </div>
        </div>

        {/* Broadcast Title */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1">Broadcast Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-6 py-4 bg-gray-50 dark:bg-slate-800 border border-transparent rounded-2xl focus:ring-1 focus:ring-blue-500 hover:bg-gray-100/50 dark:hover:bg-slate-700 transition-all font-medium text-gray-900 dark:text-white outline-none placeholder-gray-400 dark:placeholder-gray-600 text-sm"
            placeholder="e.g. Action Required: Fill Out Member Verification..."
          />
        </div>

        {/* Message Content with Formatting Toolbar */}
        <div className="space-y-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center justify-between ml-1 mb-1 gap-2">
            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Message Content</label>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] font-serif italic text-gray-400">Markdown is supported</span>
              <span className="text-gray-300 dark:text-white/10">|</span>
              <button
                type="button"
                onClick={() => insertText('[name]')}
                className="min-h-11 text-[10px] bg-[#EAF3FF] dark:bg-blue-500/10 text-[#2563EB] dark:text-blue-300 px-2 py-0.5 rounded-md hover:bg-blue-100 transition-colors font-bold cursor-pointer"
                title="Inserts personalized full name"
              >
                + [name]
              </button>
              <button
                type="button"
                onClick={() => insertText('[nickname]')}
                className="min-h-11 text-[10px] bg-[#EAF3FF] dark:bg-blue-500/10 text-[#2563EB] dark:text-blue-300 px-2 py-0.5 rounded-md hover:bg-blue-100 transition-colors font-bold cursor-pointer"
                title="Inserts personalized nickname"
              >
                + [nickname]
              </button>
            </div>
          </div>

          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1 flex-wrap">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#2563EB]"></span>
            Use <code className="bg-gray-150 dark:bg-white/5 px-1 py-0.5 rounded font-mono font-bold">[name]</code> or <code className="bg-gray-150 dark:bg-white/5 px-1 py-0.5 rounded font-mono font-bold">[nickname]</code> anywhere to automatically address members directly in portal alerts and email boxes!
          </p>

          <div className="bg-gray-50 dark:bg-slate-800 rounded-2xl overflow-hidden border border-gray-150 dark:border-white/5 focus-within:ring-1 focus-within:ring-blue-500">
            {/* Rich text formatting helper toolbar */}
            <div className="flex items-center gap-1 p-2 bg-gray-100 dark:bg-slate-950 border-b border-gray-200 dark:border-white/5 flex-wrap">
              <button
                type="button"
                onClick={() => insertText('**', '**')}
                className="min-h-11 min-w-11 p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-400"
                title="Bold"
              >
                <Bold size={14} />
              </button>
              <button
                type="button"
                onClick={() => insertText('*', '*')}
                className="min-h-11 min-w-11 p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-400"
                title="Italic"
              >
                <Italic size={14} />
              </button>
              <button
                type="button"
                onClick={() => insertText('\n### ', '')}
                className="min-h-11 min-w-11 p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-400"
                title="Header"
              >
                <Heading size={14} />
              </button>
              <button
                type="button"
                onClick={() => insertText('\n- ', '')}
                className="min-h-11 min-w-11 p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-400"
                title="Bullet List"
              >
                <List size={14} />
              </button>

              <div className="w-px h-4 bg-gray-300 dark:bg-white/10 mx-1" />

              {/* Emoji tray toggle */}
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={cn(
                  "min-h-11 px-3 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-400 flex items-center gap-1 text-[11px] font-bold cursor-pointer",
                  showEmojiPicker && "bg-[#EAF3FF] text-[#123B66] dark:bg-blue-500/15 dark:text-blue-200"
                )}
                title="Insert Emojis"
              >
                <Smile size={14} />
                <span>Emojis</span>
              </button>
            </div>

            {/* Emoji Selector Tray */}
            {showEmojiPicker && (
              <div className="p-3 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-white/5 grid grid-cols-8 sm:grid-cols-12 gap-1.5 max-h-28 overflow-y-auto">
                {emojis.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      insertText(emoji);
                    }}
                    className="min-h-11 min-w-11 p-2 text-center hover:bg-gray-150 dark:hover:bg-slate-800 rounded-lg text-lg transition-transform hover:scale-110 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            <textarea
              ref={textareaRef}
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-6 py-4 bg-transparent border-none outline-none resize-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 text-sm leading-relaxed"
              placeholder="e.g. Dear members, we noticed some profiles are incomplete. Please visit My Profile using the top menu to complete your full name, nickname and contact number. Thank you! 📢"
            />
          </div>
        </div>

        {/* Feedback / Success alerts */}
        <AnimatePresence>
          {success && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30 rounded-2xl flex items-center gap-3 text-green-700 dark:text-green-400 text-xs"
            >
              <CheckCircle2 size={16} />
              <div>
                <span className="font-bold">Dispatch Success:</span> {successDetails}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer controls */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-white/5 flex-wrap gap-4">
          <div className="flex items-center gap-2 text-yellow-600 bg-yellow-50 dark:bg-yellow-950/10 px-4 py-2 rounded-xl border border-yellow-101/50 dark:border-yellow-500/10">
            <AlertTriangle size={14} />
            <span className="text-[9px] font-bold uppercase tracking-widest">Targeting {filteredRecipients.length} members</span>
          </div>

          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !title || !message || (!sendInPortal && !sendByEmail)}
            className={cn(
              "flex items-center gap-3 px-8 py-4 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all shadow-lg cursor-pointer",
              success 
                ? "bg-green-500 text-white shadow-green-500/20" 
                : "bg-[#123B66] text-white shadow-blue-900/20 hover:bg-[#0f3156] disabled:opacity-40"
            )}
          >
            {sending ? (
              'Sending...'
            ) : success ? (
              <>
                <CheckCircle2 size={18} />
                Dispatched
              </>
            ) : (
              <>
                <Send size={18} />
                Send Broadcast
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
