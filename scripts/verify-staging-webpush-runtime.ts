import fs from 'node:fs';

const source = fs.readFileSync('server.ts', 'utf8');

const required = [
  'const envPublicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || "";',
  'const envPrivateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY || process.env.VAPID_PRIVATE_KEY || "";',
  'if (runtimeEnvironment === "staging" && (!envPublicKey || !envPrivateKey)) {',
  'KCFC staging safety guard: staging Web Push requires explicit WEB_PUSH_VAPID_PUBLIC_KEY and WEB_PUSH_VAPID_PRIVATE_KEY.',
];

for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`Staging Web Push runtime marker missing: ${marker}`);
}

const stagingGuard = source.indexOf('if (runtimeEnvironment === "staging" && (!envPublicKey || !envPrivateKey))');
const cacheFallback = source.indexOf('if (existsSync(localKeysPath))');
const firestoreFallback = source.indexOf('const configRef = dbAdmin.collection("configurations").doc("webpush_vapid_keys")');
const generationFallback = source.indexOf('const keys = webpush.generateVAPIDKeys();');

if (stagingGuard < 0 || cacheFallback < 0 || firestoreFallback < 0 || generationFallback < 0) {
  throw new Error('Unable to locate staging Web Push guard/fallback ordering');
}
if (!(stagingGuard < cacheFallback && stagingGuard < firestoreFallback && stagingGuard < generationFallback)) {
  throw new Error('Staging Web Push guard must fail before cached, Firestore, or generated-key fallbacks');
}

console.log('Staging Web Push runtime boundary: PASS');
