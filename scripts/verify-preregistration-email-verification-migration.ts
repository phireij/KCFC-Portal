import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appSource = readFileSync('src/App.tsx', 'utf8');

const unsafeExpression = 'isEmailVerified: isBootstrapAdmin || emailVerified || pendingData.isEmailVerified || true,';
const safeExpression = 'isEmailVerified: isBootstrapAdmin || emailVerified || pendingData.isEmailVerified || false,';

assert.equal(
  appSource.includes(unsafeExpression),
  false,
  'Pending-profile migration must never force isEmailVerified=true for an unverified Firebase Auth user.',
);

assert.equal(
  appSource.includes(safeExpression),
  true,
  'Pending-profile migration must preserve real Firebase/pending verification state and the bootstrap-admin exception.',
);

assert.match(
  appSource,
  /if \(user && !user\.emailVerified && profile && !profile\.isEmailVerified && !profile\.isVerified && !isRegistering\)/,
  'Email-verification holding state must remain reachable for unverified migrated members.',
);

console.log('Pre-registration email-verification migration verification passed.');
