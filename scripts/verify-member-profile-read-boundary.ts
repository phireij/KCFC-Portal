import fs from 'node:fs';
import path from 'node:path';

const srcRoot = path.resolve('src');
const extensions = new Set(['.ts', '.tsx']);
const directUsersListPattern = /collection\s*\(\s*db\s*,\s*['"`]users['"`]\s*\)/g;

const memberFacingPrivacyDebt = new Set([
  'src/pages/Members.tsx',
  'src/pages/Duties.tsx',
  'src/pages/Polls.tsx',
  'src/pages/LegacyPollsImpl.tsx',
  'src/pages/LegacyDutiesImpl.tsx',
]);

const privilegedKnownConsumers = new Set([
  'src/lib/seeder.ts',
  'src/pages/Dashboard.tsx',
  'src/pages/Announcements.tsx',
  'src/pages/Admin.tsx',
  'src/components/admin/BroadcastTool.tsx',
]);

const knownConsumers = new Set([
  ...memberFacingPrivacyDebt,
  ...privilegedKnownConsumers,
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

const debtStillPresent = directConsumers.filter((file) => memberFacingPrivacyDebt.has(file));

// The current Directory still reads member.email solely to exclude the bootstrap account.
// That known dependency is part of the migration debt above; do not expand it to other
// contact/device-delivery fields while the public/private profile split is pending.
const forbiddenDirectoryFieldReferences = [
  '.birthdate',
  '.homeAddress',
  '.phoneNumber',
  '.fcmTokens',
  '.webPushSubscriptions',
  '.connectedCommunicationApps',
];
const directorySource = fs.readFileSync('src/pages/Members.tsx', 'utf8');
for (const marker of forbiddenDirectoryFieldReferences) {
  if (directorySource.includes(`member${marker}`)) {
    throw new Error(`Community Directory must not consume private profile field: member${marker}`);
  }
}

const bootstrapEmailUses = directorySource.match(/member\.email/g)?.length || 0;
if (bootstrapEmailUses > 1) {
  throw new Error('Community Directory email dependency expanded beyond the single known bootstrap-account exclusion');
}

console.log(`Member profile read-boundary containment: PASS (${directConsumers.length} known full-list consumers; ${debtStillPresent.length} member-facing migration debt paths remain)`);
if (debtStillPresent.length > 0) {
  console.warn(`Privacy remediation remains open for: ${debtStillPresent.join(', ')}`);
}
