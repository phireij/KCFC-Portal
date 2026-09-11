import fs from 'node:fs';

const app = fs.readFileSync('src/App.tsx', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');

for (const marker of [
  'Successfully migrated pre-registered pending document ${pendingDocId} to real UID ${authenticatedUser.uid}',
  'Force signing out zombie session:", authenticatedUser.uid',
]) {
  if (app.includes(marker)) {
    throw new Error(`Browser diagnostic privacy regression: identifier-bearing App log present: ${marker}`);
  }
}

for (const marker of [
  'Successfully migrated pre-registered pending member profile to the authenticated account.',
  'User profile was removed from Firestore. Force signing out stale authenticated session.',
]) {
  if (!app.includes(marker)) {
    throw new Error(`Browser diagnostic privacy guard missing safe App marker: ${marker}`);
  }
}

const routeStart = server.indexOf('app.get("/api/admin/read-delete-logs"');
const routeEnd = server.indexOf('const publicContactUpload = multer(', routeStart);
if (routeStart === -1 || routeEnd === -1) throw new Error('Admin diagnostic log route boundary not found.');
const route = server.slice(routeStart, routeEnd);

if (route.includes('res.status(500).json({ error: error.message });')) {
  throw new Error('Admin diagnostic reader must not expose raw backend exception text.');
}
for (const marker of [
  'console.error("[ADMIN DIAGNOSTIC LOG READ ERROR] Failed to read diagnostic service logs.", error);',
  'res.status(500).json({ error: "Failed to read diagnostic service logs" });',
  '["admin", "president"].includes(r)',
]) {
  if (!route.includes(marker)) {
    throw new Error(`Admin diagnostic privacy/authorization guard missing marker: ${marker}`);
  }
}

console.log('Browser/admin diagnostic privacy boundary: PASS');
