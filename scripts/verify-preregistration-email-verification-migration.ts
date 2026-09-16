import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appSource = readFileSync('src/App.tsx', 'utf8');
const claimRouteSource = readFileSync('server/pendingProfileClaimRoutes.ts', 'utf8');

const unsafeExpression = 'isEmailVerified: isBootstrapAdmin || authUser.emailVerified || pending.isEmailVerified === true || true,';
const safeExpression = 'isEmailVerified: isBootstrapAdmin || authUser.emailVerified || pending.isEmailVerified === true,';

assert.equal(
  claimRouteSource.includes(unsafeExpression),
  false,
  'Trusted pending-profile claim must never force isEmailVerified=true for an unverified Firebase Auth user.',
);

assert.equal(
  claimRouteSource.includes(safeExpression),
  true,
  'Trusted pending-profile claim must preserve Firebase/pending verification state and the bootstrap-admin exception.',
);

assert.match(
  appSource,
  /if \(user && !user\.emailVerified && profile && !profile\.isEmailVerified && !profile\.isVerified && !isRegistering\)/,
  'Email-verification holding state must remain reachable for unverified claimed members.',
);

console.log('Pre-registration email-verification migration verification passed.');
