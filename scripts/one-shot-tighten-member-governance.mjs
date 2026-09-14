import fs from 'node:fs';

function replaceOnce(source, before, after, label) {
  const parts = source.split(before);
  if (parts.length !== 2) throw new Error(`Refusing governance tightening: expected exactly one ${label} anchor.`);
  return `${parts[0]}${after}${parts[1]}`;
}

{
  const path = 'firestore.rules';
  let source = fs.readFileSync(path, 'utf8');
  source = replaceOnce(
    source,
    `    function isAdmin() { \n`,
    `    function canAdministerMembers() {\n      return hasRole('admin') || hasRole('president');\n    }\n    function canGovernMemberAssignments() {\n      return canAdministerMembers() || hasRole('secretary');\n    }\n    function isAdmin() { \n`,
    'member governance helper',
  );
  source = replaceOnce(
    source,
    `        (isAdmin() && incoming().diff(existing()).affectedKeys().hasOnly(['roles', 'isVerified', 'isCoreMember', 'isDisabled', 'updatedAt', 'ministries', 'lcRoles', 'isEmailVerified', 'displayName', 'nickname', 'phoneNumber', 'fcmTokens', 'webPushSubscriptions']))\n      ) && isValidUser(incoming());\n      allow delete: if isAdmin();`,
    `        (canAdministerMembers() && incoming().diff(existing()).affectedKeys().hasOnly(['roles', 'isVerified', 'isCoreMember', 'isDisabled', 'updatedAt', 'ministries', 'lcRoles', 'isEmailVerified', 'displayName', 'nickname', 'phoneNumber', 'fcmTokens', 'webPushSubscriptions'])) ||\n        (hasRole('secretary') && incoming().diff(existing()).affectedKeys().hasOnly(['roles', 'isVerified', 'isCoreMember', 'updatedAt', 'ministries', 'lcRoles']))\n      ) && isValidUser(incoming());\n      allow delete: if canAdministerMembers();`,
    'users update/delete authorization',
  );
  fs.writeFileSync(path, source, 'utf8');
}

{
  const path = 'server/memberDirectorySyncRoutes.ts';
  let source = fs.readFileSync(path, 'utf8');
  const start = source.indexOf('const GOVERNANCE_SYNC_ROLES = new Set([');
  const end = source.indexOf(']);', start);
  if (start < 0 || end < 0) throw new Error('Refusing governance tightening: unable to locate GOVERNANCE_SYNC_ROLES.');
  const replacement = `const GOVERNANCE_SYNC_ROLES = new Set([\n  'admin',\n  'president',\n  'secretary',\n]);`;
  source = source.slice(0, start) + replacement + source.slice(end + 3);
  source = source.replace(
    '// Keep this aligned with the Firestore isAdmin() governance roles that are already\n// allowed to mutate managed member profiles. If a governance mutation is allowed,\n// its resulting public projection must be synchronizable in the same transaction flow.\n',
    '// Keep this aligned with the dedicated managed-member governance boundary in Firestore.\n// Directory refresh may follow only roles that can actually mutate public member fields.\n',
  );
  fs.writeFileSync(path, source, 'utf8');
}

{
  const path = 'scripts/verify-member-directory-sync-boundary.ts';
  const source = `import fs from 'node:fs';\n\nconst requireMarkers = (file: string, markers: string[]) => {\n  const source = fs.readFileSync(file, 'utf8');\n  for (const marker of markers) {\n    if (!source.includes(marker)) throw new Error(\`${'${file}'} must retain member-directory synchronization marker: ${'${marker}'}\`);\n  }\n};\n\nrequireMarkers('server.ts', [\n  'registerMemberDirectorySyncRoutes',\n  'collection(\\\"member_directory\\\").doc(targetUserId).delete()',\n  'collection(\\\"member_directory\\\").doc(currentUid).delete()',\n]);\nrequireMarkers('server/memberDirectorySyncRoutes.ts', [\n  '/api/member-directory/sync-self',\n  '/api/admin/member-directory/sync',\n  'toMemberDirectoryProfile',\n  \"collection('member_directory')\",\n]);\nrequireMarkers('src/pages/Profile.tsx', ['syncOwnMemberDirectoryProfile']);\nrequireMarkers('src/pages/Login.tsx', ['syncOwnMemberDirectoryProfile']);\nrequireMarkers('src/App.tsx', ['syncOwnMemberDirectoryProfile']);\nrequireMarkers('src/components/admin/MemberApprovalQueue.tsx', ['syncManagedMemberDirectoryProfile']);\nrequireMarkers('src/components/admin/MemberRoleEditor.tsx', ['syncManagedMemberDirectoryProfile']);\nrequireMarkers('src/pages/LegacyAdmin.tsx', ['syncManagedMemberDirectoryProfile']);\nrequireMarkers('scripts/backfill-member-directory-staging.ts', ['staleProjectionDocuments', 'Refusing apply:']);\n\nconst governanceRoles = ['admin', 'president', 'secretary'] as const;\nconst forbiddenGovernanceRoles = ['vice_president', 'treasurer', 'auditor', 'pro', 'spiritual_director', 'member', 'leader', 'chore_leader'] as const;\n\nconst syncRoutes = fs.readFileSync('server/memberDirectorySyncRoutes.ts', 'utf8');\nconst syncRoleStart = syncRoutes.indexOf('const GOVERNANCE_SYNC_ROLES = new Set([');\nconst syncRoleEnd = syncRoutes.indexOf(']);', syncRoleStart);\nif (syncRoleStart < 0 || syncRoleEnd < 0) throw new Error('Unable to locate bounded GOVERNANCE_SYNC_ROLES definition.');\nconst syncRoleBlock = syncRoutes.slice(syncRoleStart, syncRoleEnd);\nfor (const role of governanceRoles) {\n  if (!syncRoleBlock.includes(\`'${'${role}'}'\`)) throw new Error(\`Trusted member-directory synchronization is missing managed-member role: ${'${role}'}\`);\n}\nfor (const role of forbiddenGovernanceRoles) {\n  if (syncRoleBlock.includes(\`'${'${role}'}'\`)) throw new Error(\`Trusted member-directory synchronization unexpectedly grants managed-member sync to: ${'${role}'}\`);\n}\n\nconst rules = fs.readFileSync('firestore.rules', 'utf8');\nfor (const marker of [\n  \"function canAdministerMembers()\",\n  \"return hasRole('admin') || hasRole('president');\",\n  \"function canGovernMemberAssignments()\",\n  \"return canAdministerMembers() || hasRole('secretary');\",\n  \"allow delete: if canAdministerMembers();\",\n  \"(hasRole('secretary') && incoming().diff(existing()).affectedKeys().hasOnly(['roles', 'isVerified', 'isCoreMember', 'updatedAt', 'ministries', 'lcRoles']))\",\n]) {\n  if (!rules.includes(marker)) throw new Error(\`Firestore managed-member authorization marker missing: ${'${marker}'}\`);\n}\nconst usersStart = rules.indexOf('match /users/{userId}');\nconst usersEnd = rules.indexOf('// --- Public-safe Member Directory Projection ---', usersStart);\nif (usersStart < 0 || usersEnd < 0) throw new Error('Unable to locate bounded users rules.');\nconst usersBlock = rules.slice(usersStart, usersEnd);\nif (usersBlock.includes('(isAdmin() && incoming().diff(existing()).affectedKeys()')) throw new Error('Broad isAdmin() user-profile mutation authorization must not return.');\nif (usersBlock.includes('allow delete: if isAdmin();')) throw new Error('Broad isAdmin() member deletion authorization must not return.');\n\nconst projectionStart = rules.indexOf('match /member_directory/{userId}');\nconst projectionEnd = rules.indexOf('// --- Polls Collection ---', projectionStart);\nif (projectionStart < 0 || projectionEnd < 0) throw new Error('Unable to locate bounded member_directory rules.');\nconst projectionBlock = rules.slice(projectionStart, projectionEnd);\nif (!projectionBlock.includes('allow create, update, delete: if false;')) throw new Error('member_directory browser writes must remain disabled.');\n\nconsole.log('Member directory synchronization boundary: PASS');\n`;
  fs.writeFileSync(path, source, 'utf8');
}

console.log('Managed-member governance tightening: PASS');
