import fs from 'node:fs';

const source = fs.readFileSync('server.ts', 'utf8');

const required = [
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

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(`Web Push registration boundary missing marker: ${marker}`);
  }
}

const forbidden = [
  'if (!subscription || !subscription.endpoint)',
  'sub.endpoint !== subscription.endpoint',
  '...subscription,\n        registeredAt',
];

for (const marker of forbidden) {
  if (source.includes(marker)) {
    throw new Error(`Web Push registration boundary regression: ${marker}`);
  }
}

console.log('Web Push registration boundary: PASS (shape/HTTPS/size validation, endpoint dedupe, bounded recent-device retention).');
