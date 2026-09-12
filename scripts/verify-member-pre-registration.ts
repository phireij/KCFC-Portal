import assert from 'node:assert/strict';
import {
  buildMemberPreRegistrationPlan,
  buildPendingMemberDocumentId,
  normalizeMemberPreRegistrationEmail,
} from '../src/lib/memberPreRegistration';

assert.equal(normalizeMemberPreRegistrationEmail('  MEMBER@Example.COM  '), 'member@example.com');
assert.equal(buildPendingMemberDocumentId('first.last+kcfc@example.com'), 'pending_first_last_kcfc');

const plan = buildMemberPreRegistrationPlan({
  email: '  MEMBER@Example.COM  ',
  displayName: '  Sample Member  ',
});

assert.equal(plan.documentId, 'pending_member');
assert.equal(plan.email, 'member@example.com');
assert.equal(plan.displayName, 'Sample Member');
assert.equal(plan.profile.uid, plan.documentId);
assert.deepEqual(plan.profile.roles, ['member']);
assert.deepEqual(plan.profile.ministries, []);
assert.equal(plan.profile.isVerified, false);
assert.equal(plan.profile.isEmailVerified, false);
assert.equal(plan.profile.isDisabled, false);

assert.throws(
  () => buildMemberPreRegistrationPlan({ email: 'invalid-email', displayName: 'Sample Member' }),
  /valid email/i,
);
assert.throws(
  () => buildMemberPreRegistrationPlan({ email: 'member@example.com', displayName: '   ' }),
  /member name/i,
);

console.log('Member pre-registration safety contract verified.');
