import fs from 'node:fs';

const source = fs.readFileSync('src/pages/Login.tsx', 'utf8');
const claimRoute = fs.readFileSync('server/pendingProfileClaimRoutes.ts', 'utf8');
const memberProfileRoute = fs.readFileSync('server/authMemberProfileRoutes.ts', 'utf8');

const forbidden = [
  'isEmailVerified: isBootstrapAdmin || emailVerified || pendingData.isEmailVerified || true,',
  'isEmailVerified: isBootstrapAdmin || emailVerified || true,',
  'isEmailVerified: isBootstrapAdmin || true,',
  'isEmailVerified: isBootstrapAdmin || authUser.emailVerified || true,',
];

for (const marker of forbidden) {
  if (source.includes(marker) || claimRoute.includes(marker) || memberProfileRoute.includes(marker)) {
    throw new Error(`Forced-true email-verification marker found: ${marker}`);
  }
}

const requiredLogin = [
  'const pendingClaim = await claimPendingProfile();',
  'await ensureAuthenticatedMemberProfile(displayName || undefined);',
  "await claimOrCreateAuthenticatedProfile(credential.user.displayName || undefined);",
  'await claimOrCreateAuthenticatedProfile(name.trim());',
];

for (const marker of requiredLogin) {
  if (!source.includes(marker)) {
    throw new Error(`Expected Login email-verification/profile-initialization safety marker missing: ${marker}`);
  }
}

const requiredClaim = 'isEmailVerified: isBootstrapAdmin || authUser.emailVerified || pending.isEmailVerified === true,';
if (!claimRoute.includes(requiredClaim)) {
  throw new Error(`Expected trusted pending-claim email-verification safety marker missing: ${requiredClaim}`);
}

const requiredMemberProfile = 'isEmailVerified: isBootstrapAdmin || authUser.emailVerified === true,';
if (!memberProfileRoute.includes(requiredMemberProfile)) {
  throw new Error(`Expected trusted member-profile email-verification safety marker missing: ${requiredMemberProfile}`);
}

console.log('Login email-verification and trusted member-profile initialization safety: PASS');
