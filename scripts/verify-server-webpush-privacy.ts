import fs from 'node:fs';

const source = fs.readFileSync('server.ts', 'utf8');

const forbidden = [
  'Failed to deliver to endpoint ${subscription?.endpoint}',
  'console.log(subscription?.endpoint)',
  'console.error(subscription?.endpoint)',
  'logMessage(subscription?.endpoint)',
  'Dispatching test notification to user ${callerProfile.email || callerUid}',
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
  'logMessage(`[FCM TEST PUSH] Dispatching caller-bound test notification to ${realTokens.length} registered device token(s)...`);',
  'logMessage(`[WEBPUSH TEST PUSH] Dispatching caller-bound test notification to ${callerWebPushSubs.length} registered subscription(s)...`);',
];

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(`Server Web Push delivery/privacy marker missing: ${marker}`);
  }
}

console.log('Server Web Push privacy logging: PASS');
