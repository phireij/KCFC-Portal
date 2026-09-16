import { readFileSync } from 'node:fs';

const source = readFileSync('src/lib/fcmClient.ts', 'utf8');

const forbidden = [
  'console.log("WebPush: Preloaded VAPID public key from server successfully:", cleanedKey)',
  'console.log("WebPush: Obtained PushSubscription successfully:", subscription)',
  'console.log("FCM: Device push token registered successfully:", token)',
  'console.log(`FCM: Device push token registered successfully: ${token}`)',
];

for (const snippet of forbidden) {
  if (source.includes(snippet)) {
    throw new Error(`Push privacy logging contract violated: ${snippet}`);
  }
}

console.log('Push privacy logging contract: PASS');
