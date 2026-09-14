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
requireMarkers('src/components/admin/MemberApprovalQueue.tsx', ['syncManagedMemberDirectoryProfile']);
requireMarkers('src/components/admin/MemberRoleEditor.tsx', ['syncManagedMemberDirectoryProfile']);
requireMarkers('src/pages/LegacyAdmin.tsx', ['syncManagedMemberDirectoryProfile']);
requireMarkers('scripts/backfill-member-directory-staging.ts', [
  'staleProjectionDocuments',
  'Refusing apply:',
]);

const rules = fs.readFileSync('firestore.rules', 'utf8');
const start = rules.indexOf('match /member_directory/{userId}');
const end = rules.indexOf('// --- Polls Collection ---', start);
if (start < 0 || end < 0) throw new Error('Unable to locate bounded member_directory rules.');
const block = rules.slice(start, end);
if (!block.includes('allow create, update, delete: if false;')) {
  throw new Error('member_directory browser writes must remain disabled.');
}

console.log('Member directory synchronization boundary: PASS');
