import fs from 'node:fs';

const source = fs.readFileSync('server.ts', 'utf8');

const required = [
  'const envPublicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || "";',
  'const envPrivateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY || process.env.VAPID_PRIVATE_KEY || "";',
  'if (runtimeEnvironment === "staging" && (!envPublicKey || !envPrivateKey)) {',
  'KCFC staging safety guard: staging Web Push requires explicit WEB_PUSH_VAPID_PUBLIC_KEY and WEB_PUSH_VAPID_PRIVATE_KEY.',
  'if (runtimeEnvironment === "staging") {\n      throw err;\n    }',
];

for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`Staging Web Push runtime marker missing: ${marker}`);
}

const stagingGuard = source.indexOf('if (runtimeEnvironment === "staging" && (!envPublicKey || !envPrivateKey))');
const cacheFallback = source.indexOf('if (existsSync(localKeysPath))');
const firestoreFallback = source.indexOf('const configRef = dbAdmin.collection("configurations").doc("webpush_vapid_keys")');
const outerCatch = source.indexOf('} catch (err: any) {\n    console.error("[WEBPUSH] Failed to initialize web-push credentials:", err);');
const stagingRethrow = source.indexOf('if (runtimeEnvironment === "staging") {\n      throw err;\n    }', outerCatch);
const generationFallback = source.indexOf('const keys = webpush.generateVAPIDKeys();', outerCatch);

if ([stagingGuard, cacheFallback, firestoreFallback, outerCatch, stagingRethrow, generationFallback].some((v) => v < 0)) {
  throw new Error('Unable to locate staging Web Push guard/fallback ordering');
}
if (!(stagingGuard < cacheFallback && stagingGuard < firestoreFallback)) {
  throw new Error('Staging Web Push key-presence guard must precede cached and Firestore fallbacks');
}
if (!(outerCatch < stagingRethrow && stagingRethrow < generationFallback)) {
  throw new Error('Staging Web Push initialization errors must be re-thrown before in-memory key generation fallback');
}

console.log('Staging Web Push runtime boundary: PASS');
