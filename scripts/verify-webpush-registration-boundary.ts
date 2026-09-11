import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const client = fs.readFileSync('src/lib/fcmClient.ts', 'utf8');

const serverRequired = [
  'const MAX_WEB_PUSH_SUBSCRIPTIONS_PER_USER = 8;',
  'const MAX_WEB_PUSH_ENDPOINT_LENGTH = 2048;',
  'const MAX_WEB_PUSH_KEY_LENGTH = 512;',
  'function normalizeWebPushSubscription(input: any)',
  'if (endpointUrl.protocol !== "https:") return null;',
  'const normalizedSubscription = normalizeWebPushSubscription(subscription);',
  'res.status(400).json({ error: "Invalid Web Push subscription data" });',
  '.slice(-(MAX_WEB_PUSH_SUBSCRIPTIONS_PER_USER - 1));',
  'sub.endpoint !== normalizedSubscription.endpoint',
  '...normalizedSubscription,',
];

for (const marker of serverRequired) {
  if (!server.includes(marker)) {
    throw new Error(`Web Push registration boundary missing server marker: ${marker}`);
  }
}

const clientRequired = [
  'fetch("/api/webpush/register"',
  '"Authorization": `Bearer ${idToken}`',
  'throw new Error(`Backend Web Push registration failed with status ${regResponse.status}.`);',
];
for (const marker of clientRequired) {
  if (!client.includes(marker)) {
    throw new Error(`Web Push registration boundary missing client marker: ${marker}`);
  }
}

const forbiddenServer = [
  'if (!subscription || !subscription.endpoint)',
  'sub.endpoint !== subscription.endpoint',
  '...subscription,\n        registeredAt',
];
for (const marker of forbiddenServer) {
  if (server.includes(marker)) {
    throw new Error(`Web Push registration boundary regression: ${marker}`);
  }
}

const forbiddenClient = [
  'webPushSubscriptions: arrayUnion(subscriptionJson)',
  'Falling back to direct Firestore self-update',
  'Successfully registered PushSubscription directly in Firestore',
];
for (const marker of forbiddenClient) {
  if (client.includes(marker)) {
    throw new Error(`Web Push client registration boundary regression: ${marker}`);
  }
}

console.log('Web Push registration boundary: PASS (server shape/HTTPS/size validation, endpoint dedupe, max-8 retention, authenticated backend-only client registration).');
