import fs from 'node:fs';

const replaceOnce = (source, before, after, label) => {
  const parts = source.split(before);
  if (parts.length !== 2) throw new Error(`Refusing final assignment migration: expected exactly one ${label} anchor.`);
  return `${parts[0]}${after}${parts[1]}`;
};

// LegacyDutiesImpl: public-safe member projection only.
{
  const path = 'src/pages/LegacyDutiesImpl.tsx';
  let source = fs.readFileSync(path, 'utf8');
  source = replaceOnce(source,
    "import { DutyAssignment, UserProfile, Poll, PollResponse } from '../types';",
    "import { DutyAssignment, Poll, PollResponse } from '../types';\nimport { subscribeMemberDirectory } from '../lib/memberDirectoryClient';\nimport type { MemberDirectoryProfile } from '../lib/memberPublicProjection';",
    'Legacy Duties profile import');
  source = replaceOnce(source,
    '  const [users, setUsers] = useState<UserProfile[]>([]);',
    '  const [users, setUsers] = useState<MemberDirectoryProfile[]>([]);',
    'Legacy Duties users state');
  source = replaceOnce(source,
    `    // Listen to users\n    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {\n      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)).filter(u => u.email !== 'kcfc.jp@gmail.com'));\n    }, (err) => {\n      console.error("Error listening to users in Duties page:", err);\n    });`,
    `    // Listen only to public-safe assignment/member metadata.\n    const unsubUsers = subscribeMemberDirectory(\n      setUsers,\n      (err) => console.error("Error listening to public member directory in Duties page:", err),\n    );`,
    'Legacy Duties private users listener');
  if (source.includes("collection(db, 'users')") || source.includes('UserProfile')) {
    throw new Error('Legacy Duties still contains private-profile list markers.');
  }
  fs.writeFileSync(path, source, 'utf8');
}

// CommitteeAssignments: public directory for identity/eligibility; privileged email lookup only on send.
{
  const path = 'src/components/CommitteeAssignments.tsx';
  let source = fs.readFileSync(path, 'utf8');
  source = replaceOnce(source,
    "import { Poll, PollResponse, COMMITTEE_ROLES, ROLE_COLORS, UserProfile } from '../types';",
    "import { Poll, PollResponse, COMMITTEE_ROLES, ROLE_COLORS, UserProfile } from '../types';\nimport type { MemberDirectoryProfile } from '../lib/memberPublicProjection';\nimport { listPrivilegedPollEmailRecipients } from '../lib/privilegedMemberQueries';",
    'Committee privacy imports');
  source = replaceOnce(source,
    '  users?: UserProfile[];',
    '  users?: MemberDirectoryProfile[];',
    'Committee users prop');
  source = source.replace('          const usersSnap = await getDocs(collection(db, \'users\'));\n', '');
  source = source.replace('          const usersToEmail: UserProfile[] = [];\n\n          usersSnap.docs.forEach(userDoc => {\n            if (assignedUserIds.has(userDoc.id)) {\n              usersToEmail.push({ uid: userDoc.id, ...userDoc.data() } as UserProfile);\n              const notificationRef = doc(collection(db, \'notifications\'));\n              batch.set(notificationRef, {\n                userId: userDoc.id,', "          const usersToEmail = users.filter(member => assignedUserIds.has(member.uid));\n\n          usersToEmail.forEach(member => {\n            if (assignedUserIds.has(member.uid)) {\n              const notificationRef = doc(collection(db, 'notifications'));\n              batch.set(notificationRef, {\n                userId: member.uid,");
  source = source.replace('          usersSnap.docs.forEach(userDoc => {', '          usersToEmail.forEach(member => {');
  source = source.replaceAll('userDoc.id', 'member.uid');
  source = source.replace('            const subject = `[KCFC] New Assignments: ${poll.title}`;', "            const privilegedRecipients = await listPrivilegedPollEmailRecipients();\n            const subject = `[KCFC] New Assignments: ${poll.title}`;");
  source = source.replace('              if (member.email) {\n                try {', "              const emailRecipient = privilegedRecipients.find(recipient => recipient.uid === member.uid);\n              if (emailRecipient?.email) {\n                try {");
  source = source.replaceAll('member.email}', 'emailRecipient.email}');
  source = source.replaceAll('member.email}>', 'emailRecipient.email}>');
  source = source.replaceAll(': member.email;', ': emailRecipient.email;');
  source = source.replace('    let recipientUsers: UserProfile[] = [];', '    let recipientUsers: MemberDirectoryProfile[] = [];');
  source = source.replace('      const baseUrl = window.location.origin;\n\n      // We should also write system notifications in Firestore', "      const baseUrl = window.location.origin;\n      const privilegedRecipients = await listPrivilegedPollEmailRecipients();\n\n      // We should also write system notifications in Firestore");
  source = source.replace('      for (const member of recipientUsers) {\n        if (member.email) {\n          try {', "      for (const member of recipientUsers) {\n        const emailRecipient = privilegedRecipients.find(recipient => recipient.uid === member.uid);\n        if (emailRecipient?.email) {\n          try {");
  source = source.replaceAll('member.email', 'emailRecipient.email');
  if (source.includes("getDocs(collection(db, 'users'))")) throw new Error('CommitteeAssignments still fetches the private users collection.');
  if (!source.includes('listPrivilegedPollEmailRecipients')) throw new Error('CommitteeAssignments lost privileged email boundary.');
  fs.writeFileSync(path, source, 'utf8');
}

// ChoreCommitteeDashboard: public directory for scheduling; privileged email lookup only on send.
{
  const path = 'src/components/ChoreCommitteeDashboard.tsx';
  let source = fs.readFileSync(path, 'utf8');
  source = replaceOnce(source,
    "import { Poll, PollResponse, UserProfile, DutyAssignment } from '../types';",
    "import { Poll, PollResponse, UserProfile, DutyAssignment } from '../types';\nimport type { MemberDirectoryProfile } from '../lib/memberPublicProjection';\nimport { listPrivilegedPollEmailRecipients } from '../lib/privilegedMemberQueries';",
    'Chore privacy imports');
  source = replaceOnce(source,
    '  users: UserProfile[];',
    '  users: MemberDirectoryProfile[];',
    'Chore users prop');
  source = source.replace("      try {\n        const resultsArray = Array.from(uniqueSelectedUsers).map(userId => {", "      try {\n        const privilegedRecipients = await listPrivilegedPollEmailRecipients();\n        const resultsArray = Array.from(uniqueSelectedUsers).map(userId => {");
  source = source.replace("          return {\n            email: userProfile?.email || '',", "          const emailRecipient = privilegedRecipients.find(recipient => recipient.uid === userId);\n          return {\n            email: emailRecipient?.email || '',");
  source = source.replace('    let recipientUsers: UserProfile[] = [];', '    let recipientUsers: MemberDirectoryProfile[] = [];');
  source = source.replace('    try {\n      const baseUrl = window.location.origin;\n      let successCount = 0;', "    try {\n      const baseUrl = window.location.origin;\n      const privilegedRecipients = await listPrivilegedPollEmailRecipients();\n      let successCount = 0;");
  source = source.replace('      for (const recipient of recipientUsers) {\n        if (!recipient.email) continue;\n\n        let contentHtml = \'\';', "      for (const recipient of recipientUsers) {\n        const emailRecipient = privilegedRecipients.find(candidate => candidate.uid === recipient.uid);\n        if (!emailRecipient?.email) continue;\n\n        let contentHtml = '';");
  source = source.replaceAll('sendGmail(recipient.email, customSubject, body)', 'sendGmail(emailRecipient.email, customSubject, body)');
  source = source.replaceAll('Could not dispatch Gmail to ${recipient.email}', 'Could not dispatch Gmail to ${emailRecipient.email}');
  if (!source.includes('listPrivilegedPollEmailRecipients')) throw new Error('Chore dashboard lost privileged email boundary.');
  fs.writeFileSync(path, source, 'utf8');
}

console.log('Final legacy assignment privacy migration: PASS');
