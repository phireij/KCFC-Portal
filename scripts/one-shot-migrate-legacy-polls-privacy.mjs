import fs from 'node:fs';

const path = 'src/pages/LegacyPollsImpl.tsx';
let source = fs.readFileSync(path, 'utf8');

const replaceOnce = (before, after, label) => {
  const parts = source.split(before);
  if (parts.length !== 2) throw new Error(`Refusing Legacy Polls migration: expected exactly one ${label} anchor.`);
  source = `${parts[0]}${after}${parts[1]}`;
};

replaceOnce(
  "import { Poll, PollResponse, PollStatus, UserProfile } from '../types';",
  "import { Poll, PollResponse, PollStatus } from '../types';",
  'profile type import',
);
replaceOnce("import { CommitteeAssignments } from '../components/CommitteeAssignments';\n", '', 'unused assignment import');
replaceOnce(
  "import { sendGmail } from '../lib/gmail';",
  "import { sendGmail } from '../lib/gmail';\nimport { subscribeMemberDirectory } from '../lib/memberDirectoryClient';\nimport type { MemberDirectoryProfile } from '../lib/memberPublicProjection';\nimport { listPrivilegedPollEmailRecipients } from '../lib/privilegedMemberQueries';\nimport {\n  notifyLegacyPollClosed,\n  notifyLegacyPollCompletion,\n  notifyLegacyPollPublished,\n} from '../lib/legacyPollCommunicationClient';",
  'privacy imports',
);
replaceOnce(
  '  const [users, setUsers] = useState<UserProfile[]>([]);',
  '  const [users, setUsers] = useState<MemberDirectoryProfile[]>([]);',
  'users state',
);

replaceOnce(
  `    // 1. Listen to users\n    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {\n      const fetchedUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));\n      setUsers(fetchedUsers.filter(u => u.email !== 'kcfc.jp@gmail.com'));\n    }, (err) => {\n      console.error("Error listening to users in Polls page:", err);\n    });`,
  `    // 1. Listen only to the public-safe member directory.\n    const unsubUsers = subscribeMemberDirectory(\n      setUsers,\n      (err) => console.error("Error listening to public member directory in Polls page:", err),\n    );`,
  'private users listener',
);

const createNotifyStart = source.indexOf('        // Create notifications for all users (or targeted users) - ONLY if not draft');
const createNotifyEnd = source.indexOf('\n\n        const newPollRecord: Poll = {', createNotifyStart);
if (createNotifyStart < 0 || createNotifyEnd < 0) throw new Error('Refusing Legacy Polls migration: create notification block not found.');
source = `${source.slice(0, createNotifyStart)}        if (!isDraft) {\n          try {\n            await notifyLegacyPollPublished(docRef.id);\n          } catch (err) {\n            console.error("Failed to create trusted poll notifications", err);\n          }\n        }${source.slice(createNotifyEnd)}`;

const completionStart = source.indexOf('  const checkAndNotifyCoreCompletion = async (pollId: string) => {');
const completionEnd = source.indexOf('\n\n  const handleResponse = async', completionStart);
if (completionStart < 0 || completionEnd < 0) throw new Error('Refusing Legacy Polls migration: completion function boundary not found.');
source = `${source.slice(0, completionStart)}  const checkAndNotifyCoreCompletion = async (pollId: string) => {\n    try {\n      await notifyLegacyPollCompletion(pollId);\n    } catch (err) {\n      console.error("Error in trusted completion notification", err);\n    }\n  };${source.slice(completionEnd)}`;

const toggleStart = source.indexOf('  const togglePollStatus = async (pollId: string, currentStatus: PollStatus) => {');
const toggleEnd = source.indexOf('\n\n  const deletePoll = async', toggleStart);
if (toggleStart < 0 || toggleEnd < 0) throw new Error('Refusing Legacy Polls migration: status function boundary not found.');
const toggleReplacement = `  const togglePollStatus = async (pollId: string, currentStatus: PollStatus) => {\n    let nextStatus: PollStatus;\n    if (currentStatus === 'draft') {\n      nextStatus = 'active';\n    } else {\n      nextStatus = currentStatus === 'active' ? 'closed' : 'active';\n    }\n\n    try {\n      await updateDoc(doc(db, 'polls', pollId), { status: nextStatus, updatedAt: serverTimestamp() });\n      const updatedPoll = polls.find(p => p.id === pollId);\n      if (!updatedPoll) return;\n      setPolls(prev => prev.map(p => p.id === pollId ? { ...p, status: nextStatus } : p));\n\n      if (nextStatus === 'closed' && updatedPoll.category === 'core_member') {\n        try {\n          await notifyLegacyPollClosed(updatedPoll.id);\n        } catch (err) {\n          console.error("Failed to notify on trusted chore poll close", err);\n        }\n      }\n\n      if (currentStatus === 'draft' && nextStatus === 'active') {\n        try {\n          await notifyLegacyPollPublished(updatedPoll.id);\n        } catch (err) {\n          console.error("Failed to create trusted notifications on publish", err);\n        }\n      }\n    } catch (err) {\n      handleFirestoreError(err, OperationType.WRITE, 'polls');\n    }\n  };`;
source = `${source.slice(0, toggleStart)}${toggleReplacement}${source.slice(toggleEnd)}`;

replaceOnce(
  `      // 1. Fetch all verified members\n      const q = query(collection(db, 'users'), where('isVerified', '==', true));\n      const snap = await getDocs(q);\n      let members = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)).filter(m => !!m.email && !m.isDisabled);`,
  `      // 1. Fetch email recipients only through the audited privileged query boundary.\n      let members = await listPrivilegedPollEmailRecipients();`,
  'manager email recipient query',
);

replaceOnce(
  `            const eligibleUsers = (poll.category === 'core_member'\n              ? users.filter(u => u.isCoreMember && !u.isDisabled && u.isVerified)\n              : poll.category === 'committee'\n                ? users.filter(u => u.ministries?.some(m => ['lector_commentator', 'usher', 'altar_server', 'ppt'].includes(m)) && !u.isDisabled && u.isVerified)\n                : users.filter(u => !u.isDisabled && u.isVerified)\n            ).filter(u => u.email !== 'kcfc.jp@gmail.com');`,
  `            const eligibleUsers = poll.category === 'core_member'\n              ? users.filter(u => u.isCoreMember)\n              : poll.category === 'committee'\n                ? users.filter(u => u.ministries?.some(m => ['lector_commentator', 'usher', 'altar_server', 'ppt'].includes(m as string)))\n                : users;`,
  'public eligible users calculation',
);

const forbidden = [
  "collection(db, 'users')",
  'UserProfile',
  'u.isVerified',
  'u.isDisabled',
  "u.email !== 'kcfc.jp@gmail.com'",
];
for (const marker of forbidden) {
  if (source.includes(marker)) throw new Error(`Legacy Polls migration left forbidden private-profile marker: ${marker}`);
}
for (const required of [
  'subscribeMemberDirectory(',
  'notifyLegacyPollPublished(',
  'notifyLegacyPollCompletion(',
  'notifyLegacyPollClosed(',
  'listPrivilegedPollEmailRecipients()',
]) {
  if (!source.includes(required)) throw new Error(`Legacy Polls migration missing required marker: ${required}`);
}

fs.writeFileSync(path, source, 'utf8');
console.log('Legacy Polls public/trusted privacy migration: PASS');
