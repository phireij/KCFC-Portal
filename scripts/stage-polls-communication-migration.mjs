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
  'communication imports',
  "import LegacyPolls from './LegacyPolls';\n",
  "import LegacyPolls from './LegacyPolls';\nimport {\n  buildAvailabilityCompletionCreatorPlan,\n  buildAvailabilityRequestCreatorPlan,\n  buildPublishedRosterCreatorPlan,\n} from '../lib/liturgicalCreatorPlan';\nimport { appendCommunicationNotificationsToBatch } from '../lib/communicationFirestore';\n",
);

replaceOnce(
  'availability completion creator',
  `      const leadershipRecipients = members.filter((member) =>\n        (member.roles || []).some((role) => ['admin', 'president'].includes(role)),\n      );\n      const recipientIds = new Set<string>();\n      if (poll.createdBy) recipientIds.add(poll.createdBy);\n      leadershipRecipients.forEach((member) => recipientIds.add(member.uid));\n\n      const batch = writeBatch(db);\n      recipientIds.forEach((uid) => {\n        const notificationRef = doc(collection(db, 'notifications'));\n        batch.set(notificationRef, {\n          userId: uid,\n          title: 'Liturgical availability complete',\n          message: \`All eligible ministry members have responded to “\${poll.title}”. You can close the request and begin assignment planning.\`,\n          type: 'system',\n          status: 'unread',\n          link: \`/polls?id=\${poll.id}&leader=1\`,\n          createdAt: serverTimestamp(),\n        });\n      });\n      batch.update(doc(db, 'polls', poll.id), { availabilityCompletionNotifiedAt: serverTimestamp() });\n      await batch.commit();`,
  `      const creatorPlan = buildAvailabilityCompletionCreatorPlan({\n        members,\n        pollId: poll.id,\n        pollTitle: poll.title,\n        createdBy: poll.createdBy,\n      });\n\n      const batch = writeBatch(db);\n      appendCommunicationNotificationsToBatch(batch, db, creatorPlan);\n      batch.update(doc(db, 'polls', poll.id), { availabilityCompletionNotifiedAt: serverTimestamp() });\n      await batch.commit();`,
);

replaceOnce(
  'availability request creator',
  `      const batch = writeBatch(db);\n      eligibleMembers.forEach((member) => {\n        const notificationRef = doc(collection(db, 'notifications'));\n        batch.set(notificationRef, {\n          userId: member.uid,\n          title: 'New liturgical availability request',\n          message: \`\${form.title.trim()}: please select every Mass where you are available to serve.\`,\n          type: 'system',\n          status: 'unread',\n          link: \`/polls?id=\${created.id}\`,\n          createdAt: serverTimestamp(),\n        });\n      });\n      await batch.commit();`,
  `      const creatorPlan = buildAvailabilityRequestCreatorPlan({\n        eligibleMembers,\n        pollId: created.id,\n        pollTitle: form.title.trim(),\n      });\n      const batch = writeBatch(db);\n      appendCommunicationNotificationsToBatch(batch, db, creatorPlan);\n      await batch.commit();`,
);

replaceOnce(
  'published roster creator',
  `      assignedUserIds(poll).forEach((uid) => {\n        const notificationRef = doc(collection(db, 'notifications'));\n        batch.set(notificationRef, {\n          userId: uid,\n          title: 'Your liturgical schedule is ready',\n          message: \`The final roster for “\${poll.title}” has been published. Please review your assignments.\`,\n          type: 'system',\n          status: 'unread',\n          link: '/duties?view=mine',\n          createdAt: serverTimestamp(),\n        });\n      });\n      await batch.commit();`,
  `      const creatorPlan = buildPublishedRosterCreatorPlan({\n        members,\n        assignedUserIds: assignedUserIds(poll),\n        pollId: poll.id,\n        pollTitle: poll.title,\n      });\n      appendCommunicationNotificationsToBatch(batch, db, creatorPlan);\n      await batch.commit();`,
);

fs.writeFileSync(path, source);
console.log('Staged Polls communication migration candidate.');
