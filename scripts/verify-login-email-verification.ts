import fs from 'node:fs';

const source = fs.readFileSync('src/pages/Login.tsx', 'utf8');

const forbidden = [
  'isEmailVerified: isBootstrapAdmin || emailVerified || pendingData.isEmailVerified || true,',
  'isEmailVerified: isBootstrapAdmin || emailVerified || true,',
];

for (const marker of forbidden) {
  if (source.includes(marker)) {
    throw new Error(`Forced-true Login email-verification marker found: ${marker}`);
  }
}

const required = [
  'isEmailVerified: isBootstrapAdmin || emailVerified || pendingData.isEmailVerified || false,',
  'isEmailVerified: isBootstrapAdmin || emailVerified || false,',
  'isEmailVerified: isBootstrapAdmin || pendingData.isEmailVerified || false,',
  'isEmailVerified: isBootstrapAdmin || false,',
];

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(`Expected Login email-verification safety marker missing: ${marker}`);
  }
}

console.log('Login email-verification migration safety: PASS');
