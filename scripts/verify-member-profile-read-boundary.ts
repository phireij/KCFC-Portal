import fs from 'node:fs';
import path from 'node:path';

const srcRoot = path.resolve('src');
const extensions = new Set(['.ts', '.tsx']);
const directUsersListPattern = /collection\s*\(\s*db\s*,\s*['"`]users['"`]\s*\)/g;

// All reachable member/Core/ministry-leader surfaces have migrated away from direct
// full users-collection lists. Any new reachable path must fail closed as unexpected.
const memberFacingPrivacyDebt = new Set<string>();

// Member-facing surfaces already migrated to the public-safe projection. Keep this
// list explicit so a future regression back to the private users collection fails CI.
const migratedMemberFacingConsumers = new Map([
  ['src/pages/Members.tsx', 'subscribeMemberDirectory'],
  ['src/pages/Duties.tsx', 'subscribeMemberDirectory'],
  ['src/pages/Dashboard.tsx', 'subscribeMemberDirectory'],
  ['src/pages/Polls.tsx', 'subscribeMemberDirectory'],
  ['src/pages/LegacyPollsImpl.tsx', 'subscribeMemberDirectory'],
  ['src/pages/LegacyDutiesImpl.tsx', 'subscribeMemberDirectory'],
  ['src/components/CommitteeAssignments.tsx', 'MemberDirectoryProfile'],
  ['src/components/ChoreCommitteeDashboard.tsx', 'MemberDirectoryProfile'],
  ['src/pages/LegacyDashboard.tsx', 'subscribeMemberDirectory'],
]);

// Existing governance/administration consumers. These are not proof that every
// role should retain private-profile access forever; they are the bounded set that
// may continue while the final private-profile authorization matrix is reviewed.
const privilegedKnownConsumers = new Set([
  'src/lib/seeder.ts',
  'src/lib/privilegedMemberQueries.ts',
  'src/pages/Announcements.tsx',
  'src/pages/Admin.tsx',
  'src/pages/LegacyAdmin.tsx',
  'src/components/admin/BroadcastTool.tsx',
  'src/components/admin/CoreStatusPlanner.tsx',
  'src/components/admin/LeadershipOverview.tsx',
  'src/components/admin/MemberAccountOverview.tsx',
  'src/components/admin/MemberApprovalQueue.tsx',
  'src/components/admin/MemberPreRegistration.tsx',
  'src/components/admin/MemberRoleEditor.tsx',
]);

// No retained unrouted source may list the private users collection.
const unroutedLegacyConsumers = new Set<string>();

const knownConsumers = new Set([
  ...memberFacingPrivacyDebt,
  ...privilegedKnownConsumers,
  ...unroutedLegacyConsumers,
]);

const files: string[] = [];
const walk = (directory: string) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (extensions.has(path.extname(entry.name))) files.push(fullPath);
  }
};
walk(srcRoot);

const directConsumers: string[] = [];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  directUsersListPattern.lastIndex = 0;
  if (!directUsersListPattern.test(source)) continue;
  directConsumers.push(path.relative(process.cwd(), file).replaceAll('\\', '/'));
}

directConsumers.sort();
const unexpected = directConsumers.filter((file) => !knownConsumers.has(file));
if (unexpected.length > 0) {
  throw new Error(
    `New browser-side full users collection consumer detected. Review the member privacy boundary before allowing it: ${unexpected.join(', ')}`,
  );
}

for (const [file, requiredMarker] of migratedMemberFacingConsumers) {
  const source = fs.readFileSync(file, 'utf8');
  directUsersListPattern.lastIndex = 0;
  if (directUsersListPattern.test(source)) {
    throw new Error(`Migrated member-facing surface regressed to direct private users collection access: ${file}`);
  }
  if (!source.includes(requiredMarker)) {
    throw new Error(`Migrated member-facing surface must retain its public projection boundary (${requiredMarker}): ${file}`);
  }
}

const legacyPollsSource = fs.readFileSync('src/pages/LegacyPollsImpl.tsx', 'utf8');
for (const requiredMarker of [
  'notifyLegacyPollPublished',
  'notifyLegacyPollCompletion',
  'notifyLegacyPollClosed',
  'listPrivilegedPollEmailRecipients',
]) {
  if (!legacyPollsSource.includes(requiredMarker)) {
    throw new Error(`Legacy Polls must retain trusted/private boundary marker: ${requiredMarker}`);
  }
}

for (const file of [
  'src/components/CommitteeAssignments.tsx',
  'src/components/ChoreCommitteeDashboard.tsx',
]) {
  const source = fs.readFileSync(file, 'utf8');
  if (!source.includes('listPrivilegedPollEmailRecipients')) {
    throw new Error(`Legacy assignment email sends must retain privileged recipient lookup: ${file}`);
  }
}

const homeSource = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');
if (!homeSource.includes('subscribePendingMemberCount')) {
  throw new Error('Routine Home must keep pending-registration access behind the privileged member-query helper.');
}
const legacyHomeSource = fs.readFileSync('src/pages/LegacyDashboard.tsx', 'utf8');
if (!legacyHomeSource.includes('subscribePendingMembers')) {
  throw new Error('Legacy Dashboard pending-registration access must remain behind the privileged member-query helper.');
}

const debtStillPresent = directConsumers.filter((file) => memberFacingPrivacyDebt.has(file));
const privilegedStillPresent = directConsumers.filter((file) => privilegedKnownConsumers.has(file));
const unroutedStillPresent = directConsumers.filter((file) => unroutedLegacyConsumers.has(file));
if (debtStillPresent.length !== 0) {
  throw new Error(`Reachable member-facing private-profile debt must remain zero: ${debtStillPresent.join(', ')}`);
}

const directorySource = fs.readFileSync('src/pages/Members.tsx', 'utf8');
const forbiddenDirectoryFieldReferences = [
  '.email',
  '.birthdate',
  '.homeAddress',
  '.phoneNumber',
  '.preferences',
  '.fcmTokens',
  '.webPushSubscriptions',
  '.connectedCommunicationApps',
];
for (const marker of forbiddenDirectoryFieldReferences) {
  if (directorySource.includes(`member${marker}`)) {
    throw new Error(`Community Directory must not consume private profile field: member${marker}`);
  }
}

console.log(
  `Member profile read-boundary containment: PASS (${directConsumers.length} known direct-list consumers; `
  + `0 reachable privacy-debt paths; ${migratedMemberFacingConsumers.size} migrated member-facing paths; `
  + `${privilegedStillPresent.length} privileged paths; ${unroutedStillPresent.length} unrouted legacy path)`,
);