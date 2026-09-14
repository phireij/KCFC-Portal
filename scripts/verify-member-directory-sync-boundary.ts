import fs from 'node:fs';

const requireMarkers = (file: string, markers: string[]) => {
  const source = fs.readFileSync(file, 'utf8');
  for (const marker of markers) {
    if (!source.includes(marker)) throw new Error(`${file} must retain member-directory synchronization marker: ${marker}`);
  }
};

requireMarkers('server.ts', [
  'registerMemberDirectorySyncRoutes',
  'collection("member_directory").doc(targetUserId).delete()',
  'collection("member_directory").doc(currentUid).delete()',
]);
requireMarkers('server/memberDirectorySyncRoutes.ts', [
  '/api/member-directory/sync-self',
  '/api/admin/member-directory/sync',
  'toMemberDirectoryProfile',
  "collection('member_directory')",
]);
requireMarkers('src/pages/Profile.tsx', ['syncOwnMemberDirectoryProfile']);
requireMarkers('src/pages/Login.tsx', ['syncOwnMemberDirectoryProfile']);
requireMarkers('src/App.tsx', ['syncOwnMemberDirectoryProfile']);
requireMarkers('src/components/admin/MemberApprovalQueue.tsx', ['syncManagedMemberDirectoryProfile']);
requireMarkers('src/components/admin/MemberRoleEditor.tsx', ['syncManagedMemberDirectoryProfile']);
requireMarkers('src/pages/LegacyAdmin.tsx', ['syncManagedMemberDirectoryProfile']);
requireMarkers('scripts/backfill-member-directory-staging.ts', [
  'staleProjectionDocuments',
  'Refusing apply:',
]);

const governanceRoles = [
  'admin',
  'president',
  'vice_president',
  'secretary',
  'auditor',
  'pro',
  'spiritual_director',
] as const;

const syncRoutes = fs.readFileSync('server/memberDirectorySyncRoutes.ts', 'utf8');
const syncRoleStart = syncRoutes.indexOf('const GOVERNANCE_SYNC_ROLES = new Set([');
const syncRoleEnd = syncRoutes.indexOf(']);', syncRoleStart);
if (syncRoleStart < 0 || syncRoleEnd < 0) {
  throw new Error('Unable to locate bounded GOVERNANCE_SYNC_ROLES definition.');
}
const syncRoleBlock = syncRoutes.slice(syncRoleStart, syncRoleEnd);
for (const role of governanceRoles) {
  if (!syncRoleBlock.includes(`'${role}'`)) {
    throw new Error(`Trusted member-directory synchronization is missing Firestore governance role: ${role}`);
  }
}
for (const disallowed of ['treasurer', 'member', 'leader', 'chore_leader']) {
  if (syncRoleBlock.includes(`'${disallowed}'`)) {
    throw new Error(`Trusted member-directory synchronization unexpectedly grants governance sync to: ${disallowed}`);
  }
}

const rules = fs.readFileSync('firestore.rules', 'utf8');
const adminStart = rules.indexOf('function isAdmin()');
const adminEnd = rules.indexOf('function isLeader()', adminStart);
if (adminStart < 0 || adminEnd < 0) throw new Error('Unable to locate bounded Firestore isAdmin() role contract.');
const adminBlock = rules.slice(adminStart, adminEnd);
for (const role of governanceRoles) {
  if (!adminBlock.includes(`'${role}' in roles`)) {
    throw new Error(`Firestore isAdmin() governance contract is missing role: ${role}`);
  }
}
for (const disallowed of ['treasurer', 'member', 'leader', 'chore_leader']) {
  if (adminBlock.includes(`'${disallowed}' in roles`)) {
    throw new Error(`Firestore isAdmin() unexpectedly contains non-governance role: ${disallowed}`);
  }
}

const start = rules.indexOf('match /member_directory/{userId}');
const end = rules.indexOf('// --- Polls Collection ---', start);
if (start < 0 || end < 0) throw new Error('Unable to locate bounded member_directory rules.');
const block = rules.slice(start, end);
if (!block.includes('allow create, update, delete: if false;')) {
  throw new Error('member_directory browser writes must remain disabled.');
}

console.log('Member directory synchronization boundary: PASS');
