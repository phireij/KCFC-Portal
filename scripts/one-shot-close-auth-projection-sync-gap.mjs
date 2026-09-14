import fs from 'node:fs';

const replaceOnce = (source, before, after, label) => {
  const parts = source.split(before);
  if (parts.length !== 2) throw new Error(`Refusing auth projection sync patch: expected exactly one ${label} anchor.`);
  return `${parts[0]}${after}${parts[1]}`;
};

{
  const path = 'src/pages/Login.tsx';
  let source = fs.readFileSync(path, 'utf8');
  source = replaceOnce(
    source,
    "import { cn } from '../lib/utils';",
    "import { cn } from '../lib/utils';\nimport { syncOwnMemberDirectoryProfile } from '../lib/memberDirectorySyncClient';",
    'Login sync import',
  );
  source = replaceOnce(
    source,
    '    const existing = await getDoc(userDocRef);\n    if (existing.exists()) return;',
    '    const existing = await getDoc(userDocRef);\n    if (existing.exists()) {\n      await syncOwnMemberDirectoryProfile();\n      return;\n    }',
    'Google existing profile self-heal',
  );
  source = replaceOnce(
    source,
    '      if (pendingDocId) await deleteDoc(doc(db, \'users\', pendingDocId));\n      return;',
    '      if (pendingDocId) await deleteDoc(doc(db, \'users\', pendingDocId));\n      await syncOwnMemberDirectoryProfile();\n      return;',
    'Google pending migration sync',
  );
  source = replaceOnce(
    source,
    `    await setDoc(userDocRef, {\n      uid,\n      email: emailLower,\n      displayName: isBootstrapAdmin ? 'ADMIN' : (displayName || 'Member'),\n      photoURL: photoURL || avatarUrl(displayName || 'Member'),\n      roles: isBootstrapAdmin ? ['admin'] : ['member'],\n      ministries: [],\n      isEmailVerified: isBootstrapAdmin || emailVerified || false,\n      isVerified: isBootstrapAdmin,\n      createdAt: serverTimestamp(),\n      updatedAt: serverTimestamp(),\n    });`,
    `    await setDoc(userDocRef, {\n      uid,\n      email: emailLower,\n      displayName: isBootstrapAdmin ? 'ADMIN' : (displayName || 'Member'),\n      photoURL: photoURL || avatarUrl(displayName || 'Member'),\n      roles: isBootstrapAdmin ? ['admin'] : ['member'],\n      ministries: [],\n      isEmailVerified: isBootstrapAdmin || emailVerified || false,\n      isVerified: isBootstrapAdmin,\n      createdAt: serverTimestamp(),\n      updatedAt: serverTimestamp(),\n    });\n    await syncOwnMemberDirectoryProfile();`,
    'Google new profile sync',
  );
  source = replaceOnce(
    source,
    `      } else {\n        await setDoc(userDocRef, {\n          uid: cred.user.uid,\n          email: cred.user.email || '',\n          displayName: isBootstrapAdmin ? 'ADMIN' : name.trim(),\n          photoURL: avatarUrl(name.trim()),\n          roles: isBootstrapAdmin ? ['admin'] : ['member'],\n          ministries: [],\n          isEmailVerified: isBootstrapAdmin || false,\n          isVerified: isBootstrapAdmin,\n          createdAt: serverTimestamp(),\n          updatedAt: serverTimestamp(),\n        });\n      }\n\n      try {`,
    `      } else {\n        await setDoc(userDocRef, {\n          uid: cred.user.uid,\n          email: cred.user.email || '',\n          displayName: isBootstrapAdmin ? 'ADMIN' : name.trim(),\n          photoURL: avatarUrl(name.trim()),\n          roles: isBootstrapAdmin ? ['admin'] : ['member'],\n          ministries: [],\n          isEmailVerified: isBootstrapAdmin || false,\n          isVerified: isBootstrapAdmin,\n          createdAt: serverTimestamp(),\n          updatedAt: serverTimestamp(),\n        });\n      }\n      await syncOwnMemberDirectoryProfile();\n\n      try {`,
    'email registration profile sync',
  );
  fs.writeFileSync(path, source, 'utf8');
}

{
  const path = 'src/App.tsx';
  let source = fs.readFileSync(path, 'utf8');
  source = replaceOnce(
    source,
    "import { registerDeviceToken, preloadVapidKeyFromServer, isStandaloneMode, prepareNativeWebPushPrerequisites, observeForegroundMessages } from './lib/fcmClient';",
    "import { registerDeviceToken, preloadVapidKeyFromServer, isStandaloneMode, prepareNativeWebPushPrerequisites, observeForegroundMessages } from './lib/fcmClient';\nimport { syncOwnMemberDirectoryProfile } from './lib/memberDirectorySyncClient';",
    'App sync import',
  );
  source = replaceOnce(
    source,
    `                      // Delete old pending document\n                      await deleteDoc(pendingDocRef);\n                      console.log("Successfully migrated pre-registered pending member profile to the authenticated account.");`,
    `                      // Delete old pending document\n                      await deleteDoc(pendingDocRef);\n                      await syncOwnMemberDirectoryProfile();\n                      console.log("Successfully migrated pre-registered pending member profile to the authenticated account.");`,
    'App pending migration sync',
  );
  fs.writeFileSync(path, source, 'utf8');
}

{
  const path = 'scripts/verify-member-directory-sync-boundary.ts';
  let source = fs.readFileSync(path, 'utf8');
  source = replaceOnce(
    source,
    "requireMarkers('src/pages/Profile.tsx', ['syncOwnMemberDirectoryProfile']);",
    "requireMarkers('src/pages/Profile.tsx', ['syncOwnMemberDirectoryProfile']);\nrequireMarkers('src/pages/Login.tsx', ['syncOwnMemberDirectoryProfile']);\nrequireMarkers('src/App.tsx', ['syncOwnMemberDirectoryProfile']);",
    'auth sync verifier markers',
  );
  fs.writeFileSync(path, source, 'utf8');
}

console.log('Authentication/member-directory synchronization gap: PASS');
