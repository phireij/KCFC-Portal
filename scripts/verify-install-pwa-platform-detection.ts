import { readFileSync } from 'node:fs';

const installSource = readFileSync('src/components/InstallPWA.tsx', 'utf8');
const healthSource = readFileSync('src/components/NotificationHealth.tsx', 'utf8');

const installRequired = [
  "import { isIOSDevice, isStandaloneMode } from '../lib/fcmClient';",
  'setIos(isIOSDevice());',
  "setAndroid(/Android/i.test(userAgent));",
];

for (const snippet of installRequired) {
  if (!installSource.includes(snippet)) {
    throw new Error(`InstallPWA platform detection contract missing: ${snippet}`);
  }
}

const healthRequired = [
  "import { registerDeviceToken, isIOSDevice, isStandaloneMode } from '../lib/fcmClient';",
  "const ios = typeof navigator !== 'undefined' && isIOSDevice();",
  "if (!standalone && ios) return { label: 'Install the app first on iPhone/iPad'",
  "disabled={!user || !online || enabling || permission === 'denied' || permission === 'unsupported' || (ios && !standalone)}",
];

for (const snippet of healthRequired) {
  if (!healthSource.includes(snippet)) {
    throw new Error(`NotificationHealth platform detection contract missing: ${snippet}`);
  }
}

const forbiddenLegacyIosChecks = [
  "setIos(/iPad|iPhone|iPod/.test(userAgent));",
  "/iPad|iPhone|iPod/.test(navigator.userAgent)",
];

for (const snippet of forbiddenLegacyIosChecks) {
  if (installSource.includes(snippet) || healthSource.includes(snippet)) {
    throw new Error(`Install/notification setup must not regress to legacy-only iOS detection: ${snippet}`);
  }
}

console.log('Install + notification platform detection contract: PASS');
