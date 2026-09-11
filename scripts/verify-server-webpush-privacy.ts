import fs from 'node:fs';

const source = fs.readFileSync('server.ts', 'utf8');

const forbidden = [
  'Failed to deliver to endpoint ${subscription?.endpoint}',
  'console.log(subscription?.endpoint)',
  'console.error(subscription?.endpoint)',
  'logMessage(subscription?.endpoint)',
];

for (const marker of forbidden) {
  if (source.includes(marker)) {
    throw new Error(`Server Web Push privacy regression: ${marker}`);
  }
}

const required = [
  'await webpush.sendNotification(subscription, payload, options);',
  'console.error(`[WEBPUSH SEND ERROR] Failed to deliver Web Push notification:`, err.message);',
  'if (err.statusCode === 410 || err.statusCode === 404)',
];

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(`Server Web Push delivery/privacy marker missing: ${marker}`);
  }
}

console.log('Server Web Push privacy logging: PASS');
