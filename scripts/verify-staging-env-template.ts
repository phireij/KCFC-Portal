import fs from 'node:fs';

const env = fs.readFileSync('.env.example', 'utf8');
const preflight = fs.readFileSync('scripts/staging-preflight.mjs', 'utf8');

const requiredEnvLines = [
  'VITE_FCM_VAPID_KEY=',
  'WEB_PUSH_VAPID_PUBLIC_KEY=',
  'WEB_PUSH_VAPID_PRIVATE_KEY=',
  'VITE_KCFC_RUNTIME_ENV=production',
  'KCFC_RUNTIME_ENV=production',
  'KCFC_CORE_STATUS_STAGING_EXECUTOR_ENABLED=false',
];

for (const line of requiredEnvLines) {
  if (!env.split(/\r?\n/).includes(line)) {
    throw new Error(`Staging env template missing required line: ${line}`);
  }
}

if (env.includes('VITE_WEB_PUSH_VAPID_PRIVATE_KEY=')) {
  throw new Error('Web Push private VAPID key must never be browser-exposed through VITE_*');
}

const requiredPreflightMarkers = [
  "required('VITE_FCM_VAPID_KEY')",
  'process.env.WEB_PUSH_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY',
  'process.env.WEB_PUSH_VAPID_PRIVATE_KEY || process.env.VAPID_PRIVATE_KEY',
  'browser VAPID public key must match the server staging VAPID public key',
];

for (const marker of requiredPreflightMarkers) {
  if (!preflight.includes(marker)) {
    throw new Error(`Staging preflight VAPID contract missing marker: ${marker}`);
  }
}

console.log('Staging environment template contract: PASS');
