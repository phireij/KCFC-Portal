import assert from 'node:assert/strict';
import { buildCoreStatusMutationPlan, coreStatusPlanStillMatches } from '../src/lib/coreStatusMutationPlan';
import type { UserProfile } from '../src/types';

const coreMember: UserProfile = {
  uid: 'member-1',
  email: 'member@example.test',
  displayName: 'Core Member',
  photoURL: '',
  roles: ['member', 'secretary'],
  ministries: ['lector_commentator', 'kitchen', 'cleaning', 'cleaning_toilet_ok'],
  isVerified: true,
  isCoreMember: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-09-10T12:00:00.000Z',
};

const downgrade = buildCoreStatusMutationPlan({
  member: coreMember,
  toCore: false,
  actorUid: 'leader-1',
  reason: 'Membership review completed',
});

assert.equal(downgrade.targetUid, coreMember.uid);
assert.equal(downgrade.actorUid, 'leader-1');
assert.equal(downgrade.update.isCoreMember, false);
assert.deepEqual(downgrade.update.roles, ['member']);
assert.deepEqual(downgrade.update.ministries, ['lector_commentator']);
assert.deepEqual(downgrade.removedRoles, ['secretary']);
assert.deepEqual(downgrade.removedMinistries.sort(), ['cleaning', 'cleaning_toilet_ok', 'kitchen'].sort());
assert.equal(downgrade.precondition.expectedUpdatedAt, coreMember.updatedAt);
assert.equal(coreStatusPlanStillMatches(coreMember, downgrade), true);

const changedProfile = { ...coreMember, roles: ['member'] as UserProfile['roles'] };
assert.equal(coreStatusPlanStillMatches(changedProfile, downgrade), false, 'stale plan must fail if governance fields changed');

const changedTimestamp = { ...coreMember, updatedAt: '2026-09-10T12:01:00.000Z' };
assert.equal(coreStatusPlanStillMatches(changedTimestamp, downgrade), false, 'stale plan must fail if profile revision changed');

const regularMember: UserProfile = {
  ...coreMember,
  uid: 'member-2',
  displayName: 'Regular Member',
  roles: ['member'],
  ministries: ['usher'],
  isCoreMember: false,
};
const upgrade = buildCoreStatusMutationPlan({
  member: regularMember,
  toCore: true,
  actorUid: 'leader-1',
  reason: 'Approved for Core service',
});
assert.equal(upgrade.requiresCleanup, false);
assert.deepEqual(upgrade.update.roles, ['member']);
assert.deepEqual(upgrade.update.ministries, ['usher']);
assert.equal(upgrade.audit.fromCore, false);
assert.equal(upgrade.audit.toCore, true);

assert.throws(() => buildCoreStatusMutationPlan({ member: regularMember, toCore: true, actorUid: '', reason: 'x' }), /actor UID/);
assert.throws(() => buildCoreStatusMutationPlan({ member: regularMember, toCore: true, actorUid: 'leader-1', reason: '   ' }), /review reason/);

console.log('Core status mutation plan safeguards verified.');
