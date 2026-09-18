import fs from 'node:fs';

const login = fs.readFileSync('src/pages/Login.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const client = fs.readFileSync('src/lib/pendingProfileClaimClient.ts', 'utf8');
const server = fs.readFileSync('server/pendingProfileClaimRoutes.ts', 'utf8');
const serverEntry = fs.readFileSync('server.ts', 'utf8');

for (const [label, source] of [['Login', login], ['App', app]] as const) {
  if (!source.includes('claimPendingProfile')) {
    throw new Error(`${label} must claim pre-registration through the trusted pending-profile route.`);
  }
  for (const forbidden of [
    "pending_${emailLower.split('@')[0]",
    "getDoc(doc(db, 'users', candidateId))",
    "deleteDoc(doc(db, 'users', pendingDocId))",
  ]) {
    if (source.includes(forbidden)) {
      throw new Error(`${label} must not directly read/delete a pending private user document: ${forbidden}`);
    }
  }
}

for (const marker of [
  "fetch('/api/auth/claim-pending-profile'",
  'Authorization: `Bearer ${token}`',
]) {
  if (!client.includes(marker)) throw new Error(`Pending-profile client boundary missing: ${marker}`);
}

for (const marker of [
  "app.post('/api/auth/claim-pending-profile'",
  'auth.verifyIdToken(token)',
  'auth.getUser(decoded.uid)',
  ".where('email', '==', email)",
  "item.id.startsWith('pending_')",
  "if (pendingEmail !== email)",
  'transaction.delete(pendingRef)',
  'toMemberDirectoryProfile(decoded.uid, profile)',
]) {
  if (!server.includes(marker)) throw new Error(`Trusted pending-profile route missing: ${marker}`);
}

for (const forbidden of [
  'req.body?.email',
  'req.body.email',
  'req.body?.pendingDocId',
  'req.body.pendingDocId',
]) {
  if (server.includes(forbidden)) throw new Error(`Trusted pending-profile claim must not trust caller identity input: ${forbidden}`);
}

if (!serverEntry.includes('registerPendingProfileClaimRoutes(app, { auth: authAdmin, db: dbAdmin });')) {
  throw new Error('server.ts must register the trusted pending-profile claim route.');
}

console.log('Trusted pending profile claim boundary: PASS');
