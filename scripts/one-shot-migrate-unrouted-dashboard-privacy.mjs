import fs from 'node:fs';

const replaceOnce = (source, before, after, label) => {
  const parts = source.split(before);
  if (parts.length !== 2) throw new Error(`Refusing Legacy Dashboard privacy migration: expected exactly one ${label} anchor.`);
  return `${parts[0]}${after}${parts[1]}`;
};

{
  const path = 'src/pages/LegacyDashboard.tsx';
  let source = fs.readFileSync(path, 'utf8');

  source = replaceOnce(
    source,
    "import { UserProfile, Poll, Resource, Announcement, MinistryType, Transaction } from '../types';",
    "import { Poll, Resource, Announcement, MinistryType, Transaction } from '../types';",
    'legacy dashboard type import',
  );
  source = replaceOnce(
    source,
    "import { seedDatabase, purgeAllDummyData } from '../lib/seeder';",
    "import { seedDatabase, purgeAllDummyData } from '../lib/seeder';\nimport { subscribeMemberDirectory } from '../lib/memberDirectoryClient';\nimport { subscribePendingMembers } from '../lib/privilegedMemberQueries';\nimport type { PendingMemberSummary } from '../lib/privilegedMemberQueries';",
    'legacy dashboard helper imports',
  );
  source = replaceOnce(
    source,
    '  const [pendingList, setPendingList] = useState<UserProfile[]>([]);',
    '  const [pendingList, setPendingList] = useState<PendingMemberSummary[]>([]);',
    'legacy dashboard pending state',
  );

  source = replaceOnce(
    source,
    `    // Real-time listener for pending users if admin\n    let unsubscribePending = () => {};\n    if (isAdmin) {\n      unsubscribePending = onSnapshot(query(collection(db, 'users'), where('isVerified', '==', false)), (snap) => {\n        const pending = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));\n        setPendingList(pending);\n        setStats(prev => ({ ...prev, pendingUsers: pending.length }));\n      }, (err) => {\n        console.error("Error listing pending users on Dashboard:", err);\n      });\n    }`,
    `    // Privileged pending-member summaries remain behind the audited helper boundary.\n    let unsubscribePending = () => {};\n    if (isAdmin) {\n      unsubscribePending = subscribePendingMembers((pending) => {\n        setPendingList(pending);\n        setStats(prev => ({ ...prev, pendingUsers: pending.length }));\n      }, (err) => {\n        console.error("Error listing pending users on Dashboard:", err);\n      });\n    }`,
    'legacy dashboard pending users listener',
  );

  source = replaceOnce(
    source,
    `    // Real-time listener for users to compute committee stats\n    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snap) => {\n      const users = snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)).filter(u => u.email !== 'kcfc.jp@gmail.com');\n      const counts: { [key: string]: number } = {};\n      \n      users.forEach(u => {\n        u.ministries?.forEach(m => {\n          counts[m] = (counts[m] || 0) + 1;\n        });\n      });\n      \n      setCommitteeCounts(counts);\n      setStats(prev => ({ ...prev, members: users.length }));\n    }, (err) => {\n      console.error("Error listing users on Dashboard:", err);\n    });`,
    `    // Public member/ministry statistics come only from the sanitized directory projection.\n    const unsubscribeUsers = subscribeMemberDirectory((users) => {\n      const counts: { [key: string]: number } = {};\n      users.forEach(u => {\n        u.ministries?.forEach(m => {\n          counts[m] = (counts[m] || 0) + 1;\n        });\n      });\n      setCommitteeCounts(counts);\n      setStats(prev => ({ ...prev, members: users.length }));\n    }, (err) => {\n      console.error("Error listing public member directory on Dashboard:", err);\n    });`,
    'legacy dashboard private users listener',
  );

  if (source.includes("collection(db, 'users')")) throw new Error('Legacy Dashboard still directly lists private users.');
  if (!source.includes('subscribeMemberDirectory')) throw new Error('Legacy Dashboard lost public member-directory boundary.');
  if (!source.includes('subscribePendingMembers')) throw new Error('Legacy Dashboard lost privileged pending-member boundary.');
  fs.writeFileSync(path, source, 'utf8');
}

{
  const path = 'scripts/verify-member-profile-read-boundary.ts';
  let source = fs.readFileSync(path, 'utf8');
  source = replaceOnce(
    source,
    "  ['src/components/ChoreCommitteeDashboard.tsx', 'MemberDirectoryProfile'],\n]);",
    "  ['src/components/ChoreCommitteeDashboard.tsx', 'MemberDirectoryProfile'],\n  ['src/pages/LegacyDashboard.tsx', 'subscribeMemberDirectory'],\n]);",
    'migrated consumer map',
  );
  source = replaceOnce(
    source,
    `// Retained source that is not routed by the current App shell. Keep it visible in\n// the containment report so reintroducing it requires deliberate review.\nconst unroutedLegacyConsumers = new Set([\n  'src/pages/LegacyDashboard.tsx',\n]);`,
    `// No retained unrouted source may list the private users collection.\nconst unroutedLegacyConsumers = new Set<string>();`,
    'unrouted legacy allowance',
  );
  source = replaceOnce(
    source,
    `const homeSource = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');\nif (!homeSource.includes('subscribePendingMemberCount')) {\n  throw new Error('Routine Home must keep pending-registration access behind the privileged member-query helper.');\n}`,
    `const homeSource = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');\nif (!homeSource.includes('subscribePendingMemberCount')) {\n  throw new Error('Routine Home must keep pending-registration access behind the privileged member-query helper.');\n}\nconst legacyHomeSource = fs.readFileSync('src/pages/LegacyDashboard.tsx', 'utf8');\nif (!legacyHomeSource.includes('subscribePendingMembers')) {\n  throw new Error('Legacy Dashboard pending-registration access must remain behind the privileged member-query helper.');\n}`,
    'home privileged helper contract',
  );
  fs.writeFileSync(path, source, 'utf8');
}

console.log('Legacy Dashboard privacy migration: PASS');
