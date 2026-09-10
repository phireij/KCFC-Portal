import fs from 'node:fs';

const path = 'src/pages/Polls.tsx';
let source = fs.readFileSync(path, 'utf8');

function replaceOnce(label, from, to) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`${label}: expected source block not found`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`${label}: source block matched more than once`);
  source = source.replace(from, to);
}

replaceOnce(
  'publication plan import',
  "import { appendCommunicationNotificationsToBatch } from '../lib/communicationFirestore';\n",
  "import { appendCommunicationNotificationsToBatch } from '../lib/communicationFirestore';\nimport { buildLiturgicalPublicationPlan } from '../lib/liturgicalPublicationPlan';\n",
);

replaceOnce(
  'extended poll revision fields',
  `  publicationMode?: 'explicit';\n  updatedAt?: unknown;\n};`,
  `  publicationMode?: 'explicit';\n  lastPublishedAssignments?: Record<string, Record<string, string>>;\n  rosterRevision?: number;\n  updatedAt?: unknown;\n};`,
);

replaceOnce(
  'preserve published snapshot on edit',
  `      await updateDoc(doc(db, 'polls', poll.id), {\n        assignments: nextAssignments,\n        rosterPublished: false,\n        rosterPublishedAt: null,\n        rosterPublishedBy: null,\n        rosterPublishedByName: null,\n        publicationMode: 'explicit',\n        updatedAt: serverTimestamp(),\n      });`,
  `      await updateDoc(doc(db, 'polls', poll.id), {\n        assignments: nextAssignments,\n        rosterPublished: false,\n        rosterPublishedAt: null,\n        rosterPublishedBy: null,\n        rosterPublishedByName: null,\n        publicationMode: 'explicit',\n        ...(poll.rosterPublished && !poll.lastPublishedAssignments\n          ? { lastPublishedAssignments: poll.assignments || {} }\n          : {}),\n        updatedAt: serverTimestamp(),\n      });`,
);

replaceOnce(
  'publication confirmation and plan',
  `    const count = assignedUserIds(poll).size;\n    if (!window.confirm(\`Publish this liturgical roster now? \${count} assigned members will receive a Portal notification.\`)) return;\n\n    setPublishingPollId(poll.id);\n    try {\n      const batch = writeBatch(db);\n      batch.update(doc(db, 'polls', poll.id), {\n        rosterPublished: true,\n        rosterPublishedAt: serverTimestamp(),\n        rosterPublishedBy: user.uid,\n        rosterPublishedByName: profile.displayName,\n        publicationMode: 'explicit',\n        updatedAt: serverTimestamp(),\n      });\n\n      const creatorPlan = buildPublishedRosterCreatorPlan({\n        members,\n        assignedUserIds: assignedUserIds(poll),\n        pollId: poll.id,\n        pollTitle: poll.title,\n      });\n      appendCommunicationNotificationsToBatch(batch, db, creatorPlan);\n      await batch.commit();`,
  `    const publicationPlan = buildLiturgicalPublicationPlan({\n      members,\n      pollId: poll.id,\n      pollTitle: poll.title,\n      state: {\n        assignments: poll.assignments || {},\n        lastPublishedAssignments: poll.lastPublishedAssignments,\n        rosterRevision: poll.rosterRevision,\n      },\n    });\n    const notifyCount = publicationPlan.communicationPlan.notifications.length;\n    const confirmation = publicationPlan.mode === 'revision'\n      ? \`Publish revised liturgical roster now? \${notifyCount} affected members will receive an updated-schedule Portal notification.\`\n      : publicationPlan.mode === 'no_change'\n        ? 'Publish this roster again? No member assignments changed, so no new assignment notification will be created.'\n        : \`Publish this liturgical roster now? \${notifyCount} assigned members will receive a Portal notification.\`;\n    if (!window.confirm(confirmation)) return;\n\n    setPublishingPollId(poll.id);\n    try {\n      const batch = writeBatch(db);\n      batch.update(doc(db, 'polls', poll.id), {\n        rosterPublished: true,\n        rosterPublishedAt: serverTimestamp(),\n        rosterPublishedBy: user.uid,\n        rosterPublishedByName: profile.displayName,\n        publicationMode: 'explicit',\n        lastPublishedAssignments: poll.assignments || {},\n        rosterRevision: publicationPlan.nextRevision,\n        updatedAt: serverTimestamp(),\n      });\n\n      appendCommunicationNotificationsToBatch(batch, db, publicationPlan.communicationPlan);\n      await batch.commit();`,
);

fs.writeFileSync(path, source);
console.log('Staged Polls roster revision migration candidate.');
