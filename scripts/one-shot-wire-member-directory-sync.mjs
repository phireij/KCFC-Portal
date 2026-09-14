import fs from 'node:fs';

const replaceOnce = (source, before, after, label) => {
  const parts = source.split(before);
  if (parts.length !== 2) throw new Error(`Refusing member-directory sync wiring: expected exactly one ${label} anchor.`);
  return `${parts[0]}${after}${parts[1]}`;
};

// Register trusted synchronization routes and ensure destructive member cleanup removes projections.
{
  const path = 'server.ts';
  let source = fs.readFileSync(path, 'utf8');
  source = replaceOnce(
    source,
    'import { registerLiturgicalCommunicationRoutes } from "./server/liturgicalCommunicationRoutes";',
    'import { registerLiturgicalCommunicationRoutes } from "./server/liturgicalCommunicationRoutes";\nimport { registerMemberDirectorySyncRoutes } from "./server/memberDirectorySyncRoutes";',
    'server sync route import',
  );
  source = replaceOnce(
    source,
    '  registerLiturgicalCommunicationRoutes(app, { auth: authAdmin, db: dbAdmin });',
    '  registerLiturgicalCommunicationRoutes(app, { auth: authAdmin, db: dbAdmin });\n  registerMemberDirectorySyncRoutes(app, { auth: authAdmin, db: dbAdmin });',
    'server sync route registration',
  );
  source = replaceOnce(
    source,
    '        await dbAdmin.collection("users").doc(targetUserId).delete();\n        logMessage(`[SUCCESS] Deleted document from users collection for UID: [redacted]`);',
    '        await dbAdmin.collection("users").doc(targetUserId).delete();\n        await dbAdmin.collection("member_directory").doc(targetUserId).delete();\n        logMessage(`[SUCCESS] Deleted private profile and public directory projection for UID: [redacted]`);',
    'delete-user directory cleanup',
  );
  source = replaceOnce(
    source,
    '          await dbAdmin.collection("users").doc(currentUid).delete();\n          logMessage(`[SUCCESS] Document deleted from users collection for UID: [redacted]`);',
    '          await dbAdmin.collection("users").doc(currentUid).delete();\n          await dbAdmin.collection("member_directory").doc(currentUid).delete();\n          logMessage(`[SUCCESS] Private profile and public directory projection deleted for UID: [redacted]`);',
    'delete-user-by-email directory cleanup',
  );
  fs.writeFileSync(path, source, 'utf8');
}

// Keep self-profile public fields synchronized immediately after private profile writes.
{
  const path = 'src/pages/Profile.tsx';
  let source = fs.readFileSync(path, 'utf8');
  source = replaceOnce(
    source,
    "import { cn } from '../lib/utils';",
    "import { cn } from '../lib/utils';\nimport { syncOwnMemberDirectoryProfile } from '../lib/memberDirectorySyncClient';",
    'Profile sync import',
  );
  source = replaceOnce(
    source,
    `      await updateDoc(doc(db, 'users', user.uid), {\n        displayName: formData.displayName,\n        nickname: formData.nickname,\n        phoneNumber: formData.phoneNumber,\n        homeAddress: formData.homeAddress,\n        birthdate: formData.birthdate,\n        preferences: formData.preferences,\n        updatedAt: serverTimestamp(),\n      });\n      setMessage({ type: 'success', text: 'Your profile and communication preferences were saved.' });`,
    `      await updateDoc(doc(db, 'users', user.uid), {\n        displayName: formData.displayName,\n        nickname: formData.nickname,\n        phoneNumber: formData.phoneNumber,\n        homeAddress: formData.homeAddress,\n        birthdate: formData.birthdate,\n        preferences: formData.preferences,\n        updatedAt: serverTimestamp(),\n      });\n      await syncOwnMemberDirectoryProfile();\n      setMessage({ type: 'success', text: 'Your profile and communication preferences were saved.' });`,
    'Profile public field save sync',
  );
  source = replaceOnce(
    source,
    `        await updateDoc(doc(db, 'users', user.uid), {\n          photoURL: reader.result as string,\n          updatedAt: serverTimestamp(),\n        });\n        setMessage({ type: 'success', text: 'Profile photo updated.' });`,
    `        await updateDoc(doc(db, 'users', user.uid), {\n          photoURL: reader.result as string,\n          updatedAt: serverTimestamp(),\n        });\n        await syncOwnMemberDirectoryProfile();\n        setMessage({ type: 'success', text: 'Profile photo updated.' });`,
    'Profile photo sync',
  );
  fs.writeFileSync(path, source, 'utf8');
}

// Focused member approval must create the projection as soon as verification becomes true.
{
  const path = 'src/components/admin/MemberApprovalQueue.tsx';
  let source = fs.readFileSync(path, 'utf8');
  source = replaceOnce(
    source,
    "import { db } from '../../lib/firebase';",
    "import { db } from '../../lib/firebase';\nimport { syncManagedMemberDirectoryProfile } from '../../lib/memberDirectorySyncClient';",
    'approval sync import',
  );
  source = replaceOnce(
    source,
    `      await updateDoc(doc(db, 'users', member.uid), {\n        isVerified: true,\n        updatedAt: serverTimestamp(),\n      });\n      setMessage(\`${'${name}'} is now verified. Roles and ministries were left unchanged.\`);`,
    `      await updateDoc(doc(db, 'users', member.uid), {\n        isVerified: true,\n        updatedAt: serverTimestamp(),\n      });\n      await syncManagedMemberDirectoryProfile(member.uid);\n      setMessage(\`${'${name}'} is now verified. Roles and ministries were left unchanged.\`);`,
    'approval verification sync',
  );
  fs.writeFileSync(path, source, 'utf8');
}

// Focused role/ministry edits must refresh the projection.
{
  const path = 'src/components/admin/MemberRoleEditor.tsx';
  let source = fs.readFileSync(path, 'utf8');
  source = replaceOnce(
    source,
    "import { db } from '../../lib/firebase';",
    "import { db } from '../../lib/firebase';\nimport { syncManagedMemberDirectoryProfile } from '../../lib/memberDirectorySyncClient';",
    'role editor sync import',
  );
  source = replaceOnce(
    source,
    "      await updateDoc(doc(db, 'users', selected.uid), updates);\n      setFeedback(`${name}'s roles and ministries were updated without changing the account identity.`);",
    "      await updateDoc(doc(db, 'users', selected.uid), updates);\n      await syncManagedMemberDirectoryProfile(selected.uid);\n      setFeedback(`${name}'s roles and ministries were updated without changing the account identity.`);",
    'role editor save sync',
  );
  fs.writeFileSync(path, source, 'utf8');
}

// Preserved legacy administration still owns several public-field/status mutations.
{
  const path = 'src/pages/LegacyAdmin.tsx';
  let source = fs.readFileSync(path, 'utf8');
  source = replaceOnce(
    source,
    "import { sendGmail } from '../lib/gmail';",
    "import { sendGmail } from '../lib/gmail';\nimport { syncManagedMemberDirectoryProfile } from '../lib/memberDirectorySyncClient';",
    'Legacy Admin sync import',
  );

  source = source.replaceAll(
    "      await updateDoc(doc(db, 'users', userId), updates);\n      setUsers(prev => prev.map(u => u.uid === userId ? { ...u, ...updates } : u));",
    "      await updateDoc(doc(db, 'users', userId), updates);\n      await syncManagedMemberDirectoryProfile(userId);\n      setUsers(prev => prev.map(u => u.uid === userId ? { ...u, ...updates } : u));",
  );
  source = replaceOnce(
    source,
    "      await updateDoc(doc(db, 'users', userId), dbUpdates);\n      setUsers(prev => prev.map(u => u.uid === userId ? { ...u, ...localUpdates } : u));",
    "      await updateDoc(doc(db, 'users', userId), dbUpdates);\n      await syncManagedMemberDirectoryProfile(userId);\n      setUsers(prev => prev.map(u => u.uid === userId ? { ...u, ...localUpdates } : u));",
    'Legacy Admin profile edit sync',
  );
  source = replaceOnce(
    source,
    `      await updateDoc(doc(db, 'users', userId), {\n        isVerified: nextStatus,\n        updatedAt: serverTimestamp()\n      });\n      setUsers(prev => prev.map(u => u.uid === userId ? { ...u, isVerified: nextStatus } : u));`,
    `      await updateDoc(doc(db, 'users', userId), {\n        isVerified: nextStatus,\n        updatedAt: serverTimestamp()\n      });\n      await syncManagedMemberDirectoryProfile(userId);\n      setUsers(prev => prev.map(u => u.uid === userId ? { ...u, isVerified: nextStatus } : u));`,
    'Legacy Admin verification sync',
  );
  source = replaceOnce(
    source,
    `        await updateDoc(doc(db, 'users', userId), {\n          isDisabled: false,\n          updatedAt: serverTimestamp()\n        });\n        setUsers(prev => prev.map(u => u.uid === userId ? { ...u, isDisabled: false } : u));`,
    `        await updateDoc(doc(db, 'users', userId), {\n          isDisabled: false,\n          updatedAt: serverTimestamp()\n        });\n        await syncManagedMemberDirectoryProfile(userId);\n        setUsers(prev => prev.map(u => u.uid === userId ? { ...u, isDisabled: false } : u));`,
    'Legacy Admin enable sync',
  );
  source = replaceOnce(
    source,
    `                      await updateDoc(doc(db, 'users', u.uid), {\n                        isDisabled: true,\n                        updatedAt: serverTimestamp()\n                      });\n                      setUsers(prev => prev.map(item => item.uid === u.uid ? { ...item, isDisabled: true } : item));`,
    `                      await updateDoc(doc(db, 'users', u.uid), {\n                        isDisabled: true,\n                        updatedAt: serverTimestamp()\n                      });\n                      await syncManagedMemberDirectoryProfile(u.uid);\n                      setUsers(prev => prev.map(item => item.uid === u.uid ? { ...item, isDisabled: true } : item));`,
    'Legacy Admin disable sync',
  );
  source = replaceOnce(
    source,
    `        await deleteDoc(doc(db, 'users', userId));\n      } catch (clientFsError: any) {`,
    `        await deleteDoc(doc(db, 'users', userId));\n        await syncManagedMemberDirectoryProfile(userId);\n      } catch (clientFsError: any) {`,
    'Legacy Admin direct delete sync',
  );
  source = replaceOnce(
    source,
    `          await deleteDoc(doc(db, 'users', targetDeletedUid));\n        } catch (clientFsError: any) {`,
    `          await deleteDoc(doc(db, 'users', targetDeletedUid));\n          await syncManagedMemberDirectoryProfile(targetDeletedUid);\n        } catch (clientFsError: any) {`,
    'Legacy Admin purge direct delete sync',
  );
  if (!source.includes('syncManagedMemberDirectoryProfile')) throw new Error('Legacy Admin lost member-directory sync marker.');
  fs.writeFileSync(path, source, 'utf8');
}

// Backfill must detect stale public documents instead of silently leaving them behind.
{
  const path = 'scripts/backfill-member-directory-staging.ts';
  let source = fs.readFileSync(path, 'utf8');
  source = replaceOnce(
    source,
    `const projections = usersSnapshot.docs\n  .map((document) => toMemberDirectoryProfile(document.id, document.data()))\n  .filter((member): member is NonNullable<typeof member> => Boolean(member));`,
    `const projections = usersSnapshot.docs\n  .map((document) => toMemberDirectoryProfile(document.id, document.data()))\n  .filter((member): member is NonNullable<typeof member> => Boolean(member));\nconst existingDirectorySnapshot = await db.collection('member_directory').get();\nconst desiredIds = new Set(projections.map((member) => member.uid));\nconst staleProjectionDocuments = existingDirectorySnapshot.docs\n  .map((document) => document.id)\n  .filter((uid) => !desiredIds.has(uid));`,
    'backfill stale projection scan',
  );
  source = replaceOnce(
    source,
    `  sourceUserDocuments: usersSnapshot.size,\n  publicProjectionDocuments: projections.length,\n  destructiveDeletes: 0,`,
    `  sourceUserDocuments: usersSnapshot.size,\n  publicProjectionDocuments: projections.length,\n  sourceDocumentsNotProjected: usersSnapshot.size - projections.length,\n  existingProjectionDocuments: existingDirectorySnapshot.size,\n  staleProjectionDocuments: staleProjectionDocuments.length,\n  destructiveDeletes: 0,`,
    'backfill evidence fields',
  );
  source = replaceOnce(
    source,
    `if (!apply) {\n  console.log('Plan only. No Firestore writes performed. Set KCFC_MEMBER_DIRECTORY_BACKFILL_APPLY=true to write to isolated staging.');\n  process.exit(0);\n}\n\nfor (let offset = 0; offset < projections.length; offset += 400) {`,
    `if (!apply) {\n  console.log('Plan only. No Firestore writes performed. Set KCFC_MEMBER_DIRECTORY_BACKFILL_APPLY=true to write to isolated staging.');\n  process.exit(0);\n}\n\nif (staleProjectionDocuments.length > 0) {\n  throw new Error(\`Refusing apply: ${'${staleProjectionDocuments.length}'} stale member_directory document(s) would remain because this backfill is intentionally non-destructive. Review cleanup before applying.\`);\n}\n\nfor (let offset = 0; offset < projections.length; offset += 400) {`,
    'backfill stale apply guard',
  );
  fs.writeFileSync(path, source, 'utf8');
}

// Projection writes are now server-only. Firebase Admin SDK bypasses client rules.
{
  const path = 'firestore.rules';
  let source = fs.readFileSync(path, 'utf8');
  source = replaceOnce(
    source,
    `      allow read: if isApproved();\n      allow create, update: if isAdmin() && isValidMemberDirectoryProfile(incoming());\n      allow delete: if isAdmin();`,
    `      allow read: if isApproved();\n      // Projection synchronization is trusted-server only; Admin SDK bypasses client rules.\n      allow create, update, delete: if false;`,
    'member_directory client write rules',
  );
  fs.writeFileSync(path, source, 'utf8');
}

// Keep existing projection verifier aligned with the server-only write boundary.
{
  const path = 'scripts/verify-member-public-projection.ts';
  let source = fs.readFileSync(path, 'utf8');
  source = replaceOnce(
    source,
    `if (!projectionRules.includes('allow create, update: if isAdmin() && isValidMemberDirectoryProfile(incoming());')) {\n  throw new Error('member_directory writes must remain restricted to validated administrative writes.');\n}\nif (!projectionRules.includes('allow delete: if isAdmin();')) {\n  throw new Error('member_directory deletion must remain administrative.');\n}`,
    `if (!projectionRules.includes('allow create, update, delete: if false;')) {\n  throw new Error('member_directory browser writes must remain disabled; synchronization is trusted-server only.');\n}`,
    'projection verifier write contract',
  );
  fs.writeFileSync(path, source, 'utf8');
}

// Persistent synchronization guard.
{
  const path = 'scripts/verify-member-directory-sync-boundary.ts';
  fs.writeFileSync(path, `import fs from 'node:fs';\n\nconst requireMarkers = (file: string, markers: string[]) => {\n  const source = fs.readFileSync(file, 'utf8');\n  for (const marker of markers) {\n    if (!source.includes(marker)) throw new Error(\`${'${file}'} must retain member-directory synchronization marker: ${'${marker}'}\`);\n  }\n};\n\nrequireMarkers('server.ts', [\n  'registerMemberDirectorySyncRoutes',\n  'collection(\\"member_directory\\").doc(targetUserId).delete()',\n  'collection(\\"member_directory\\").doc(currentUid).delete()',\n]);\nrequireMarkers('server/memberDirectorySyncRoutes.ts', [\n  '/api/member-directory/sync-self',\n  '/api/admin/member-directory/sync',\n  'toMemberDirectoryProfile',\n  "collection('member_directory')",\n]);\nrequireMarkers('src/pages/Profile.tsx', ['syncOwnMemberDirectoryProfile']);\nrequireMarkers('src/components/admin/MemberApprovalQueue.tsx', ['syncManagedMemberDirectoryProfile']);\nrequireMarkers('src/components/admin/MemberRoleEditor.tsx', ['syncManagedMemberDirectoryProfile']);\nrequireMarkers('src/pages/LegacyAdmin.tsx', ['syncManagedMemberDirectoryProfile']);\nrequireMarkers('scripts/backfill-member-directory-staging.ts', [\n  'staleProjectionDocuments',\n  'Refusing apply:',\n]);\n\nconst rules = fs.readFileSync('firestore.rules', 'utf8');\nconst start = rules.indexOf('match /member_directory/{userId}');\nconst end = rules.indexOf('// --- Polls Collection ---', start);\nif (start < 0 || end < 0) throw new Error('Unable to locate bounded member_directory rules.');\nconst block = rules.slice(start, end);\nif (!block.includes('allow create, update, delete: if false;')) {\n  throw new Error('member_directory browser writes must remain disabled.');\n}\n\nconsole.log('Member directory synchronization boundary: PASS');\n`, 'utf8');
}

// Wire the persistent guard into lint.
{
  const path = 'package.json';
  let source = fs.readFileSync(path, 'utf8');
  source = replaceOnce(
    source,
    'npx tsx scripts/verify-member-public-projection.ts && npx tsx scripts/verify-private-user-read-boundary.ts && npx tsx scripts/verify-trusted-liturgical-recipient-resolution.ts',
    'npx tsx scripts/verify-member-public-projection.ts && npx tsx scripts/verify-member-directory-sync-boundary.ts && npx tsx scripts/verify-private-user-read-boundary.ts && npx tsx scripts/verify-trusted-liturgical-recipient-resolution.ts',
    'package lint sync guard',
  );
  fs.writeFileSync(path, source, 'utf8');
}

console.log('Member directory synchronization wiring: PASS');
