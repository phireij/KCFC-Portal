import { readFileSync } from 'node:fs';

const source = readFileSync('src/components/InstallPWA.tsx', 'utf8');

const required = [
  "import { isIOSDevice, isStandaloneMode } from '../lib/fcmClient';",
  'setIos(isIOSDevice());',
  "setAndroid(/Android/i.test(userAgent));",
];

for (const snippet of required) {
  if (!source.includes(snippet)) {
    throw new Error(`InstallPWA platform detection contract missing: ${snippet}`);
  }
}

const forbidden = [
  "setIos(/iPad|iPhone|iPod/.test(userAgent));",
];

for (const snippet of forbidden) {
  if (source.includes(snippet)) {
    throw new Error(`InstallPWA must not regress to legacy-only iOS detection: ${snippet}`);
  }
}

console.log('Install PWA platform detection contract: PASS');
