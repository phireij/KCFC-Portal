import fs from 'node:fs';

const path = 'src/pages/Polls.tsx';
let source = fs.readFileSync(path, 'utf8');

const replaceOnce = (before, after, label) => {
  const parts = source.split(before);
  if (parts.length !== 2) throw new Error(`Refusing migration: expected exactly one ${label} anchor.`);
  source = `${parts[0]}${after}${parts[1]}`;
};

replaceOnce(
  "  updateDoc,\n  writeBatch,\n} from 'firebase/firestore';",
  "  updateDoc,\n} from 'firebase/firestore';",
  'Firestore import',
);
replaceOnce(
  "import { Poll, PollResponse, UserProfile } from '../types';",
  "import { Poll, PollResponse } from '../types';",
  'profile type import',
);
replaceOnce(
  "import {\n  buildAvailabilityCompletionCreatorPlan,\n  buildAvailabilityRequestCreatorPlan,\n  buildPublishedRosterCreatorPlan,\n} from '../lib/liturgicalCreatorPlan';\nimport { appendCommunicationNotificationsToBatch } from '../lib/communicationFirestore';\nimport { buildLiturgicalPublicationPlan } from '../lib/liturgicalPublicationPlan';",
  "import { subscribeMemberDirectory } from '../lib/memberDirectoryClient';\nimport type { MemberDirectoryProfile } from '../lib/memberPublicProjection';\nimport {\n  notifyAvailabilityCompletion,\n  notifyAvailabilityRequest,\n  planLiturgicalRosterPublication,\n  publishLiturgicalRoster,\n} from '../lib/liturgicalCommunicationClient';",
  'legacy communication imports',
);

const assignedUserIdsBlock = `const assignedUserIds = (poll: Poll) => {\n  const ids = new Set<string>();\n  Object.values(poll.assignments || {}).forEach((dateAssignments) => {\n    Object.keys(dateAssignments || {}).forEach((uid) => ids.add(uid));\n  });\n  return ids;\n};\n\n`;
replaceOnce(assignedUserIdsBlock, '', 'unused assigned-user helper');

source = source.replaceAll('UserProfile[]', 'MemberDirectoryProfile[]');

replaceOnce(
  "    const unsubMembers = onSnapshot(\n      collection(db, 'users'),\n      (snapshot) => {\n        setMembers(snapshot.docs.map((item) => ({ uid: item.id, ...item.data() } as UserProfile)));\n      },\n      (error) => console.error('Availability: failed to load members', error),\n    );",
  "    const unsubMembers = subscribeMemberDirectory(\n      setMembers,\n      (error) => console.error('Availability: failed to load public member directory', error),\n    );",
  'private member subscription',
);
if (source.includes('UserProfile')) throw new Error('Refusing migration: a UserProfile reference remains in modern Polls after subscription replacement.');

replaceOnce(
  "  const eligibleMembers = useMemo(\n    () => members.filter((member) =>\n      member.email !== 'kcfc.jp@gmail.com' &&\n      member.isVerified &&\n      !member.isDisabled &&\n      (member.ministries || []).some((ministry) => memberMinistries.includes(ministry)),\n    ),\n    [members],\n  );",
  "  const eligibleMembers = useMemo(\n    () => members.filter((member) =>\n      (member.ministries || []).some((ministry) => memberMinistries.includes(ministry)),\n    ),\n    [members],\n  );",
  'eligible member filter',
);

const completionStart = source.indexOf('  const checkAndNotifyCompletion = async (poll: Poll) => {');
const completionEnd = source.indexOf('\n\n  const saveAvailability = async', completionStart);
if (completionStart < 0 || completionEnd < 0) throw new Error('Refusing migration: completion notification function boundary not found.');
source = `${source.slice(0, completionStart)}  const checkAndNotifyCompletion = async (poll: Poll) => {\n    try {\n      await notifyAvailabilityCompletion(poll.id);\n    } catch (error) {\n      console.error('Availability: trusted completion notification failed', error);\n    }\n  };${source.slice(completionEnd)}`;

replaceOnce(
  "      const creatorPlan = buildAvailabilityRequestCreatorPlan({\n        eligibleMembers,\n        pollId: created.id,\n        pollTitle: form.title.trim(),\n      });\n      const batch = writeBatch(db);\n      appendCommunicationNotificationsToBatch(batch, db, creatorPlan);\n      await batch.commit();",
  "      await notifyAvailabilityRequest(created.id);",
  'availability request notification batch',
);

const publishStart = source.indexOf('  const publishRoster = async (poll: ExtendedPoll) => {');
const publishEnd = source.indexOf('\n\n  const unpublishRoster = async', publishStart);
if (publishStart < 0 || publishEnd < 0) throw new Error('Refusing migration: roster publication function boundary not found.');
const publishReplacement = [
  "  const publishRoster = async (poll: ExtendedPoll) => {",
  "    if (!canLead || !user || !profile || publishingPollId) return;",
  "    if (poll.status !== 'closed') {",
  "      alert('Close the availability request before publishing the final roster.');",
  "      return;",
  "    }",
  "",
  "    const assignments = poll.assignments || {};",
  "    const requiredMissing: string[] = [];",
  "    massDatesForPoll(poll).forEach((mass) => {",
  "      const values = Object.values(assignments[mass.date] || {});",
  "      if (!values.includes('Commentator')) requiredMissing.push(`${formatDate(mass.date)}: Commentator`);",
  "      if (!values.some((role) => role.startsWith('Lector'))) requiredMissing.push(`${formatDate(mass.date)}: Lector`);",
  "      if (!values.some((role) => role.startsWith('Altar Server'))) requiredMissing.push(`${formatDate(mass.date)}: Altar Server`);",
  "      if (!values.some((role) => role.startsWith('Usher'))) requiredMissing.push(`${formatDate(mass.date)}: Usher`);",
  "    });",
  "",
  "    if (requiredMissing.length > 0) {",
  "      alert(`Please complete the required roles before publishing:\\n\\n${requiredMissing.slice(0, 12).join('\\n')}`);",
  "      return;",
  "    }",
  "",
  "    setPublishingPollId(poll.id);",
  "    try {",
  "      const publicationPlan = await planLiturgicalRosterPublication(poll.id);",
  "      const notifyCount = publicationPlan.notificationCount || 0;",
  "      const confirmation = publicationPlan.mode === 'revision'",
  "        ? `Publish revised liturgical roster now? ${notifyCount} affected members will receive an updated-schedule Portal notification.`",
  "        : publicationPlan.mode === 'no_change'",
  "          ? 'Publish this roster again? No member assignments changed, so no new assignment notification will be created.'",
  "          : `Publish this liturgical roster now? ${notifyCount} assigned members will receive a Portal notification.`;",
  "      if (!window.confirm(confirmation)) return;",
  "",
  "      await publishLiturgicalRoster(poll.id);",
  "    } catch (error) {",
  "      console.error('Assignments: trusted roster publication failed', error);",
  "      alert(error instanceof Error ? error.message : 'The roster could not be published.');",
  "    } finally {",
  "      setPublishingPollId(null);",
  "    }",
  "  };",
].join('\n');
source = `${source.slice(0, publishStart)}${publishReplacement}${source.slice(publishEnd)}`;

const forbidden = [
  "collection(db, 'users')",
  'buildAvailabilityCompletionCreatorPlan',
  'buildAvailabilityRequestCreatorPlan',
  'buildPublishedRosterCreatorPlan',
  'appendCommunicationNotificationsToBatch',
  'buildLiturgicalPublicationPlan',
  'writeBatch(',
  '.fcmTokens',
  '.webPushSubscriptions',
  '.connectedCommunicationApps',
  'member.email',
  'member.isVerified',
  'member.isDisabled',
];
for (const marker of forbidden) {
  if (source.includes(marker)) throw new Error(`Migration left forbidden modern Availability marker: ${marker}`);
}
for (const required of [
  'subscribeMemberDirectory(',
  'notifyAvailabilityRequest(created.id)',
  'notifyAvailabilityCompletion(poll.id)',
  'planLiturgicalRosterPublication(poll.id)',
  'publishLiturgicalRoster(poll.id)',
]) {
  if (!source.includes(required)) throw new Error(`Migration missing required modern Availability marker: ${required}`);
}

fs.writeFileSync(path, source, 'utf8');
console.log('Modern Availability public/trusted privacy migration: PASS');
