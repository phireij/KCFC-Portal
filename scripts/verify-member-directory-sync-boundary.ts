import fs from 'node:fs';

const requireMarkers = (file: string, markers: string[]) => {
  const source = fs.readFileSync(file, 'utf8');
  for (const marker of markers) {
    if (!source.includes(marker)) throw new Error(`${file} must retain member-directory synchronization marker: ${marker}`);
  }
};

requireMarkers('server.ts', [
  'registerMemberDirectorySyncRoutes',
  'collection(\"member_directory\").doc(targetUserId).delete()',
  'collection(\"member_directory\").doc(currentUid).delete()',
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
requireMarkers('scripts/backfill-member-directory-staging.ts', ['staleProjectionDocuments', 'Refusing apply:']);

const governanceRoles = ['admin', 'president', 'secretary'] as const;
const forbiddenGovernanceRoles = ['vice_president', 'treasurer', 'auditor', 'pro', 'spiritual_director', 'member', 'leader', 'chore_leader'] as const;

const syncRoutes = fs.readFileSync('server/memberDirectorySyncRoutes.ts', 'utf8');
const syncRoleStart = syncRoutes.indexOf('const GOVERNANCE_SYNC_ROLES = new Set([');
const syncRoleEnd = syncRoutes.indexOf(']);', syncRoleStart);
if (syncRoleStart < 0 || syncRoleEnd < 0) throw new Error('Unable to locate bounded GOVERNANCE_SYNC_ROLES definition.');
const syncRoleBlock = syncRoutes.slice(syncRoleStart, syncRoleEnd);
for (const role of governanceRoles) {
  if (!syncRoleBlock.includes(`'${role}'`)) throw new Error(`Trusted member-directory synchronization is missing managed-member role: ${role}`);
}
for (const role of forbiddenGovernanceRoles) {
  if (syncRoleBlock.includes(`'${role}'`)) throw new Error(`Trusted member-directory synchronization unexpectedly grants managed-member sync to: ${role}`);
}

const rules = fs.readFileSync('firestore.rules', 'utf8');
for (const marker of [
  "function canAdministerMembers()",
  "return hasRole('admin') || hasRole('president');",
  "function canGovernMemberAssignments()",
  "return canAdministerMembers() || hasRole('secretary');",
  "allow delete: if canAdministerMembers();",
  "(hasRole('secretary') && incoming().diff(existing()).affectedKeys().hasOnly(['roles', 'isVerified', 'isCoreMember', 'updatedAt', 'ministries', 'lcRoles']))",
]) {
  if (!rules.includes(marker)) throw new Error(`Firestore managed-member authorization marker missing: ${marker}`);
}
const usersStart = rules.indexOf('match /users/{userId}');
const usersEnd = rules.indexOf('// --- Public-safe Member Directory Projection ---', usersStart);
if (usersStart < 0 || usersEnd < 0) throw new Error('Unable to locate bounded users rules.');
const usersBlock = rules.slice(usersStart, usersEnd);
if (usersBlock.includes('(isAdmin() && incoming().diff(existing()).affectedKeys()')) throw new Error('Broad isAdmin() user-profile mutation authorization must not return.');
if (usersBlock.includes('allow delete: if isAdmin();')) throw new Error('Broad isAdmin() member deletion authorization must not return.');

const projectionStart = rules.indexOf('match /member_directory/{userId}');
const projectionEnd = rules.indexOf('// --- Polls Collection ---', projectionStart);
if (projectionStart < 0 || projectionEnd < 0) throw new Error('Unable to locate bounded member_directory rules.');
const projectionBlock = rules.slice(projectionStart, projectionEnd);
if (!projectionBlock.includes('allow create, update, delete: if false;')) throw new Error('member_directory browser writes must remain disabled.');

console.log('Member directory synchronization boundary: PASS');
