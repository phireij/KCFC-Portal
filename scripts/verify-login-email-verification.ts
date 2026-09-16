import fs from 'node:fs';

const source = fs.readFileSync('src/pages/Login.tsx', 'utf8');
const claimRoute = fs.readFileSync('server/pendingProfileClaimRoutes.ts', 'utf8');

const forbidden = [
  'isEmailVerified: isBootstrapAdmin || emailVerified || pendingData.isEmailVerified || true,',
  'isEmailVerified: isBootstrapAdmin || emailVerified || true,',
  'isEmailVerified: isBootstrapAdmin || true,',
];

for (const marker of forbidden) {
  if (source.includes(marker) || claimRoute.includes(marker)) {
    throw new Error(`Forced-true email-verification marker found: ${marker}`);
  }
}

const requiredLogin = [
  'const pendingClaim = await claimPendingProfile();',
  'isEmailVerified: isBootstrapAdmin || emailVerified || false,',
  'isEmailVerified: isBootstrapAdmin || false,',
];

for (const marker of requiredLogin) {
  if (!source.includes(marker)) {
    throw new Error(`Expected Login email-verification safety marker missing: ${marker}`);
  }
}

const requiredClaim = 'isEmailVerified: isBootstrapAdmin || authUser.emailVerified || pending.isEmailVerified === true,';
if (!claimRoute.includes(requiredClaim)) {
  throw new Error(`Expected trusted pending-claim email-verification safety marker missing: ${requiredClaim}`);
}

console.log('Login email-verification migration safety: PASS');
