import fs from 'node:fs';

function replaceOnce(path, before, after, label) {
  const source = fs.readFileSync(path, 'utf8');
  const parts = source.split(before);
  if (parts.length !== 2) throw new Error(`Expected exactly one ${label} anchor in ${path}.`);
  fs.writeFileSync(path, `${parts[0]}${after}${parts[1]}`, 'utf8');
}

// server.ts wiring
replaceOnce(
  'server.ts',
  'import { registerPrivilegedMemberQueryRoutes } from "./server/privilegedMemberQueryRoutes";\n',
  'import { registerPrivilegedMemberQueryRoutes } from "./server/privilegedMemberQueryRoutes";\nimport { registerPendingProfileClaimRoutes } from "./server/pendingProfileClaimRoutes";\n',
  'pending profile route import',
);
replaceOnce(
  'server.ts',
  '  registerPrivilegedMemberQueryRoutes(app, { auth: authAdmin, db: dbAdmin });\n',
  '  registerPrivilegedMemberQueryRoutes(app, { auth: authAdmin, db: dbAdmin });\n  registerPendingProfileClaimRoutes(app, { auth: authAdmin, db: dbAdmin });\n',
  'pending profile route registration',
);

// Login.tsx imports
replaceOnce(
  'src/pages/Login.tsx',
  "import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';",
  "import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';",
  'Login Firestore import',
);
replaceOnce(
  'src/pages/Login.tsx',
  "import { syncOwnMemberDirectoryProfile } from '../lib/memberDirectorySyncClient';\n",
  "import { syncOwnMemberDirectoryProfile } from '../lib/memberDirectorySyncClient';\nimport { claimPendingProfile } from '../lib/pendingProfileClaimClient';\n",
  'Login pending claim import',
);

let login = fs.readFileSync('src/pages/Login.tsx', 'utf8');
const firstPending = login.indexOf('    let pendingData: Record<string, any> | null = null;');
if (firstPending < 0) throw new Error('Login Google pending migration start not found.');
const firstNewProfileWrite = login.indexOf('    await setDoc(userDocRef, {', firstPending);
if (firstNewProfileWrite < 0) throw new Error('Login Google new-profile write anchor not found.');
login = `${login.slice(0, firstPending)}    const pendingClaim = await claimPendingProfile();\n    if (pendingClaim.claimed) {\n      await syncOwnMemberDirectoryProfile();\n      return;\n    }\n\n${login.slice(firstNewProfileWrite)}`;

const secondPending = login.indexOf('      let pendingData: Record<string, any> | null = null;');
if (secondPending < 0) throw new Error('Login email-registration pending migration start not found.');
const signupSync = login.indexOf('      await syncOwnMemberDirectoryProfile();', secondPending);
if (signupSync < 0) throw new Error('Login email-registration sync anchor not found.');
const signupSyncEnd = signupSync + '      await syncOwnMemberDirectoryProfile();'.length;
const signupReplacement = `      const pendingClaim = await claimPendingProfile();\n      if (!pendingClaim.claimed) {\n        await setDoc(userDocRef, {\n          uid: cred.user.uid,\n          email: cred.user.email || '',\n          displayName: isBootstrapAdmin ? 'ADMIN' : name.trim(),\n          photoURL: avatarUrl(name.trim()),\n          roles: isBootstrapAdmin ? ['admin'] : ['member'],\n          ministries: [],\n          isEmailVerified: isBootstrapAdmin || false,\n          isVerified: isBootstrapAdmin,\n          createdAt: serverTimestamp(),\n          updatedAt: serverTimestamp(),\n        });\n      }\n      await syncOwnMemberDirectoryProfile();`;
login = `${login.slice(0, secondPending)}${signupReplacement}${login.slice(signupSyncEnd)}`;
fs.writeFileSync('src/pages/Login.tsx', login, 'utf8');

// App.tsx removes the second browser-side pending-profile migration attempt.
replaceOnce(
  'src/App.tsx',
  "import { syncOwnMemberDirectoryProfile } from './lib/memberDirectorySyncClient';\n",
  "import { syncOwnMemberDirectoryProfile } from './lib/memberDirectorySyncClient';\nimport { claimPendingProfile } from './lib/pendingProfileClaimClient';\n",
  'App pending claim import',
);
let app = fs.readFileSync('src/App.tsx', 'utf8');
const appStart = app.indexOf('                // Check if there is an existing pre-registered pending document with this email');
const appEnd = app.indexOf('                if (!migrated) {', appStart);
if (appStart < 0 || appEnd < 0) throw new Error('App pending migration block anchors not found.');
const appReplacement = `                // Pending pre-registration claims are resolved by exact authenticated email on the trusted server.\n                let migrated = false;\n                try {\n                  const pendingClaim = await claimPendingProfile();\n                  migrated = pendingClaim.claimed;\n                  if (migrated) {\n                    console.log('Successfully claimed pre-registered member profile through the trusted server boundary.');\n                  }\n                } catch (migrationErr) {\n                  console.error('Failed to claim pre-registered pending profile:', migrationErr);\n                }\n\n`;
app = `${app.slice(0, appStart)}${appReplacement}${app.slice(appEnd)}`;
fs.writeFileSync('src/App.tsx', app, 'utf8');

// Add the new contract to the normal lint gate.
let pkg = fs.readFileSync('package.json', 'utf8');
const lintAnchor = 'npx tsx scripts/verify-member-pre-registration.ts && npx tsx scripts/verify-preregistration-email-verification-migration.ts';
if (!pkg.includes(lintAnchor)) throw new Error('package.json pre-registration lint anchor not found.');
pkg = pkg.replace(
  lintAnchor,
  'npx tsx scripts/verify-member-pre-registration.ts && npx tsx scripts/verify-pending-profile-claim-boundary.ts && npx tsx scripts/verify-preregistration-email-verification-migration.ts',
);
fs.writeFileSync('package.json', pkg, 'utf8');

console.log('Trusted pending profile claim migration patch: PASS');
