import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../../lib/firebase';
import { collection, getDocs, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
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
  PhoneOff
} from 'lucide-react';
import { UserProfile, MinistryType } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

export default function BroadcastTool() {
  const [target, setTarget] = useState<'all' | 'core_members' | 'regular_members' | 'missing_fullname' | 'missing_nickname' | 'missing_phone' | MinistryType>('all');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sendInPortal, setSendInPortal] = useState(true);
  const [sendByEmail, setSendByEmail] = useState(false);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successDetails, setSuccessDetails] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

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

  const getFilteredRecipients = () => {
    if (target === 'all') {
      return users;
    } else if (target === 'core_members') {
      return users.filter(u => u.isCoreMember === true);
    } else if (target === 'regular_members') {
      return users.filter(u => !u.isCoreMember);
    } else if (target === 'missing_fullname') {
      return users.filter(u => !u.displayName || u.displayName.trim() === '' || u.displayName.toLowerCase() === u.email?.toLowerCase());
    } else if (target === 'missing_nickname') {
      return users.filter(u => !u.nickname || u.nickname.trim() === '');
    } else if (target === 'missing_phone') {
      return users.filter(u => !u.phoneNumber || u.phoneNumber.trim() === '');
    } else {
      return users.filter(u => u.ministries?.includes(target as MinistryType));
    }
  };

  const filteredRecipients = getFilteredRecipients();

  const handleSend = async () => {
    if (!title || !message) return;
    if (!sendInPortal && !sendByEmail) {
      alert("Please select at least one delivery channel (Portal or Email).");
      return;
    }
    
    const getTargetLabel = () => {
      if (target === 'all') return 'all members';
      if (target === 'core_members') return 'Core Group Members';
      if (target === 'regular_members') return 'Regular Members';
      if (target === 'missing_fullname') return 'Members missing Full Name';
      if (target === 'missing_nickname') return 'Members missing Nickname';
      if (target === 'missing_phone') return 'Members missing Contact Number';
      return MINISTRY_LABELS[target] || target;
    };

    const targetLabel = getTargetLabel();
    const channels = [];
    if (sendInPortal) channels.push("Portal notifications");
    if (sendByEmail) channels.push("Emails");

    if (!confirm(`Send this broadcast to ${filteredRecipients.length} ${targetLabel} via ${channels.join(" and ")}?`)) {
      return;
    }

    setSending(true);
    try {
      // 1. Send via Portal (Firestore push notifications)
      if (sendInPortal) {
        const batch = writeBatch(db);
        filteredRecipients.forEach(u => {
          // Respect notification preference
          if (u.preferences?.broadcasts === false) return;

          const noteRef = doc(collection(db, 'notifications'));
          batch.set(noteRef, {
            userId: u.uid,
            title: `Broadcast: ${title}`,
            message: message,
            type: 'broadcast',
            status: 'unread',
            createdAt: serverTimestamp()
          });
        });
        await batch.commit();
      }

      // 2. Send via Email (Backend SMTP proxy)
      let emailStats = "";
      if (sendByEmail) {
        const recipientEmails = filteredRecipients
          .map(u => u.email)
          .filter(email => !!email && email.includes('@'));

        if (recipientEmails.length === 0) {
          throw new Error("No recipients with valid email addresses found for this target group.");
        }

        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error("Could not authenticate administrative session.");

        const response = await fetch('/api/admin/broadcast-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            emails: recipientEmails,
            title: title,
            body: message
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Server Email Error: ${response.statusText}`);
        }

        const result = await response.json();
        emailStats = result.usingSMTP 
          ? "Emails successfully sent via SMTP." 
          : "Emails simulated (view log in Dashboard).";
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
    <section className="bg-white dark:bg-[#1e1e1a] rounded-[40px] p-8 md:p-10 shadow-sm border border-gray-100 dark:border-white/5">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center">
          <Megaphone size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-serif text-[#1a1a1a] dark:text-[#f5f5f0]">Broadcast System</h2>
          <p className="text-gray-500 dark:text-gray-400 font-serif italic text-sm">Send notifications inside the portal or via direct emails.</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Dynamic Filters */}
        <div className="space-y-3">
          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1 block">Target Audience Group ({filteredRecipients.length} members selected)</span>
          
          <div className="space-y-4 bg-gray-50/50 dark:bg-[#11110f]/20 p-5 rounded-3xl border border-gray-150 dark:border-white/5">
            {/* Standard filters */}
            <div>
              <span className="text-[8px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-2 font-medium">Standard Roles</span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setTarget('all')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer",
                    target === 'all' 
                      ? "bg-[#5A5A40] border-[#5A5A40] text-white shadow-xs" 
                      : "bg-white dark:bg-[#1e1e1a] border-gray-150 dark:border-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2c2c26]"
                  )}
                >
                  All Members ({users.length})
                </button>
                
                <button
                  onClick={() => setTarget('core_members')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer",
                    target === 'core_members' 
                      ? "bg-orange-600 border-orange-600 text-white shadow-xs" 
                      : "bg-white dark:bg-[#1e1e1a] border-orange-100/30 dark:border-orange-950/20 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                  )}
                >
                  Core Members ({users.filter(u => u.isCoreMember === true).length})
                </button>

                <button
                  onClick={() => setTarget('regular_members')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer",
                    target === 'regular_members' 
                      ? "bg-blue-600 border-blue-600 text-white shadow-xs" 
                      : "bg-white dark:bg-[#1e1e1a] border-blue-100/30 dark:border-blue-950/20 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                  )}
                >
                  Regular Members ({users.filter(u => !u.isCoreMember).length})
                </button>
              </div>
            </div>

            {/* Profile incompleteness filters */}
            <div className="pt-2 border-t border-gray-100 dark:border-white/5">
              <span className="text-[8px] font-bold text-[#8a8a65] dark:text-[#8a8a65] uppercase tracking-widest block mb-2 font-medium">Profile completeness actions (Needs configuration)</span>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setTarget('missing_fullname')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer",
                    target === 'missing_fullname' 
                      ? "bg-red-650 border-red-650 text-white shadow-xs" 
                      : "bg-white dark:bg-[#1e1e1a] border-red-100/30 dark:border-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20"
                  )}
                >
                  <UserX size={12} />
                  Missing Full Name ({users.filter(u => !u.displayName || u.displayName.trim() === '' || u.displayName.toLowerCase() === u.email?.toLowerCase()).length})
                </button>

                <button
                  onClick={() => setTarget('missing_nickname')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer",
                    target === 'missing_nickname' 
                      ? "bg-amber-600 border-amber-600 text-white shadow-xs" 
                      : "bg-white dark:bg-[#1e1e1a] border-amber-100/30 dark:border-amber-950/20 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                  )}
                >
                  <Smile size={12} />
                  Missing Nickname ({users.filter(u => !u.nickname || u.nickname.trim() === '').length})
                </button>

                <button
                  onClick={() => setTarget('missing_phone')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer",
                    target === 'missing_phone' 
                      ? "bg-teal-600 border-teal-600 text-white shadow-xs" 
                      : "bg-white dark:bg-[#1e1e1a] border-[#5A5A40]/10 dark:border-teal-950/20 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/20"
                  )}
                >
                  <PhoneOff size={12} />
                  Missing Contact No. ({users.filter(u => !u.phoneNumber || u.phoneNumber.trim() === '').length})
                </button>
              </div>
            </div>

            {/* Ministry Specific filters */}
            <div className="pt-2 border-t border-gray-100 dark:border-white/5">
              <span className="text-[8px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest block mb-2 font-medium">Ministries & Committees</span>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(MINISTRY_LABELS).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setTarget(val as MinistryType)}
                    className={cn(
                      "px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all border cursor-pointer",
                      target === val 
                        ? "bg-purple-600 border-purple-600 text-white shadow-xs" 
                        : "bg-white dark:bg-[#1e1e1a] border-gray-150 dark:border-white/5 text-gray-550 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2c2c26]"
                    )}
                  >
                    {label} ({users.filter(u => u.ministries?.includes(val as MinistryType)).length})
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Channels Selector */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest ml-1 block">Broadcast Distribution Channels</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => setSendInPortal(!sendInPortal)}
              className={cn(
                "p-4 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer",
                sendInPortal 
                  ? "bg-purple-50 dark:bg-purple-950/10 border-purple-200 dark:border-purple-950/40 text-purple-900 dark:text-purple-200" 
                  : "bg-white dark:bg-[#1e1e1a] border-gray-150 dark:border-white/5 text-gray-500 dark:text-gray-400"
              )}
            >
              <div className={cn(
                "p-2 rounded-xl",
                sendInPortal ? "bg-purple-500 text-white" : "bg-gray-100 dark:bg-[#252520] text-gray-400"
              )}>
                <Globe size={18} />
              </div>
              <div>
                <div className="font-bold text-xs uppercase tracking-wider">In-Portal Alert</div>
                <div className="text-[10px] font-serif italic mt-1 text-gray-400 dark:text-gray-500">Pushes an instant notification notice inside the portal dashboard.</div>
              </div>
            </button>

            <button
              onClick={() => setSendByEmail(!sendByEmail)}
              className={cn(
                "p-4 rounded-2xl border text-left flex items-start gap-3 transition-all cursor-pointer",
                sendByEmail 
                  ? "bg-blue-50 dark:bg-blue-950/10 border-blue-200 dark:border-blue-950/40 text-blue-905 dark:text-blue-200" 
                  : "bg-white dark:bg-[#1e1e1a] border-gray-150 dark:border-white/5 text-gray-500 dark:text-gray-400"
              )}
            >
              <div className={cn(
                "p-2 rounded-xl",
                sendByEmail ? "bg-blue-500 text-white" : "bg-gray-100 dark:bg-[#252520] text-gray-400"
              )}>
                <Mail size={18} />
              </div>
              <div>
                <div className="font-bold text-xs uppercase tracking-wider">Direct E-mail Broadcast</div>
                <div className="text-[10px] font-serif italic mt-1 text-gray-400 dark:text-gray-500">Sends directly to recipients' Google/Registered email accounts.</div>
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
            className="w-full px-6 py-4 bg-gray-50 dark:bg-[#252520] border border-transparent rounded-2xl focus:ring-1 focus:ring-purple-500 hover:bg-gray-100/50 dark:hover:bg-[#252520]/80 transition-all font-medium text-gray-900 dark:text-[#f5f5f0] outline-none placeholder-gray-400 dark:placeholder-gray-600 text-sm"
            placeholder="e.g. Action Required: Fill Out Member Verification..."
          />
        </div>

        {/* Message Content with Formatting Toolbar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between ml-1 mb-1">
            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Message Content</label>
            <span className="text-[9px] font-serif italic text-gray-400">Markdown formatting is supported</span>
          </div>

          <div className="bg-gray-50 dark:bg-[#252520] rounded-2xl overflow-hidden border border-gray-150 dark:border-white/5 focus-within:ring-1 focus-within:ring-purple-500">
            {/* Rich text formatting helper toolbar */}
            <div className="flex items-center gap-1 p-2 bg-gray-100 dark:bg-[#1a1a16] border-b border-gray-200 dark:border-white/5 flex-wrap">
              <button
                type="button"
                onClick={() => insertText('**', '**')}
                className="p-1 px-2 rounded-lg hover:bg-gray-200 dark:hover:bg-[#252520] text-gray-600 dark:text-gray-400"
                title="Bold"
              >
                <Bold size={14} />
              </button>
              <button
                type="button"
                onClick={() => insertText('*', '*')}
                className="p-1 px-2 rounded-lg hover:bg-gray-200 dark:hover:bg-[#252520] text-gray-600 dark:text-gray-400"
                title="Italic"
              >
                <Italic size={14} />
              </button>
              <button
                type="button"
                onClick={() => insertText('\n### ', '')}
                className="p-1 px-2 rounded-lg hover:bg-gray-200 dark:hover:bg-[#252520] text-gray-600 dark:text-gray-400"
                title="Header"
              >
                <Heading size={14} />
              </button>
              <button
                type="button"
                onClick={() => insertText('\n- ', '')}
                className="p-1 px-2 rounded-lg hover:bg-gray-200 dark:hover:bg-[#252520] text-gray-600 dark:text-gray-400"
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
                  "p-1 px-2 rounded-lg hover:bg-gray-200 dark:hover:bg-[#252520] text-gray-600 dark:text-gray-400 flex items-center gap-1 text-[11px] font-bold cursor-pointer",
                  showEmojiPicker && "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400"
                )}
                title="Insert Emojis"
              >
                <Smile size={14} />
                <span>Emojis</span>
              </button>
            </div>

            {/* Emoji Selector Tray */}
            {showEmojiPicker && (
              <div className="p-3 bg-white dark:bg-[#1e1e1a] border-b border-gray-200 dark:border-white/5 grid grid-cols-8 sm:grid-cols-12 gap-1.5 max-h-28 overflow-y-auto">
                {emojis.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      insertText(emoji);
                    }}
                    className="p-1 text-center hover:bg-gray-150 dark:hover:bg-[#252520] rounded-lg text-lg transition-transform hover:scale-115 cursor-pointer"
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
              className="w-full px-6 py-4 bg-transparent border-none outline-none resize-none text-gray-900 dark:text-[#f5f5f0] placeholder-gray-400 dark:placeholder-gray-600 text-sm leading-relaxed"
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
            onClick={handleSend}
            disabled={sending || !title || !message || (!sendInPortal && !sendByEmail)}
            className={cn(
              "flex items-center gap-3 px-8 py-4 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all shadow-lg cursor-pointer",
              success 
                ? "bg-green-500 text-white shadow-green-500/20" 
                : "bg-purple-600 text-white shadow-purple-600/20 hover:bg-purple-700 disabled:opacity-40"
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
