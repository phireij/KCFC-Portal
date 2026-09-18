import fs from 'node:fs';

const source = fs.readFileSync('server.ts', 'utf8');

const forbidden = [
  'recipientTokens',
  'client-provided tokens for announcement push',
  'client-provided tokens for custom push',
];

for (const marker of forbidden) {
  if (source.includes(marker)) {
    throw new Error(`Broadcast recipient boundary regression: forbidden marker present: ${marker}`);
  }
}

const required = [
  'const { title, body } = req.body;',
  'const { userIds, title, body, clickAction, notificationIdsByUser } = req.body;',
  '[FCM BROADCAST] Fetching tokens from Firestore with REST fallback for announcement push.',
  '[FCM CUSTOM] Fetching tokens from Firestore with REST fallback for custom push.',
  'if (u.preferences?.announcements === false) return;',
  'if (u.preferences?.broadcasts === false) return;',
];

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(`Broadcast recipient boundary guard missing marker: ${marker}`);
  }
}

console.log('Broadcast recipient token boundary: PASS');
