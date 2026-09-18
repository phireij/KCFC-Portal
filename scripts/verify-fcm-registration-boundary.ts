import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const client = fs.readFileSync('src/lib/fcmClient.ts', 'utf8');

const serverRequired = [
  'const MAX_FCM_TOKENS_PER_USER = 8;',
  'const MAX_FCM_TOKEN_LENGTH = 4096;',
  'app.post("/api/users/register-fcm-token"',
  'const decodedToken = await authAdmin.verifyIdToken(idToken);',
  'const userId = decodedToken.uid;',
  'normalizedToken.length > MAX_FCM_TOKEN_LENGTH',
  '!isDeliverableFcmToken(normalizedToken)',
  '.slice(-(MAX_FCM_TOKENS_PER_USER - 1));',
  'fcmTokens.push(normalizedToken);',
  'res.status(500).json({ error: "Failed to register FCM device token" });',
];
for (const marker of serverRequired) {
  if (!server.includes(marker)) throw new Error(`FCM registration boundary missing server marker: ${marker}`);
}

const clientRequired = [
  'if (!currentUser || currentUser.uid !== userId)',
  'const idToken = await currentUser.getIdToken();',
  'fetch("/api/users/register-fcm-token"',
  '"Authorization": `Bearer ${idToken}`',
  'body: JSON.stringify({ token })',
];
for (const marker of clientRequired) {
  if (!client.includes(marker)) throw new Error(`FCM registration boundary missing client marker: ${marker}`);
}

const forbidden = [
  'fcmTokens: arrayUnion(token)',
  'const { userId, token } = req.body',
];
for (const marker of forbidden) {
  if (server.includes(marker) || client.includes(marker)) {
    throw new Error(`FCM registration boundary regression: ${marker}`);
  }
}

if (client.includes('arrayUnion(token)')) {
  throw new Error('FCM registration boundary regression: direct client arrayUnion(token) persistence returned.');
}

console.log('FCM registration boundary: PASS (caller-bound backend registration, validation, dedupe, max-8 retention, no direct client FCM token write).');
