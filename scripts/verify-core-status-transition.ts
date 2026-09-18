import assert from 'node:assert/strict';
import { planCoreStatusTransition } from '../src/lib/memberGovernance';
import type { UserProfile } from '../src/types';

function member(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    uid: 'member-1',
    email: 'member@example.com',
    displayName: 'Member One',
    photoURL: '',
    roles: ['member'],
    ministries: [],
    isVerified: true,
    isCoreMember: false,
    createdAt: '2026-09-10T00:00:00.000Z',
    updatedAt: '2026-09-10T00:00:00.000Z',
    ...overrides,
  };
}

const noChange = planCoreStatusTransition(member(), false);
assert.equal(noChange.requiresCleanup, false);
assert.deepEqual(noChange.rolesToRemove, []);
assert.deepEqual(noChange.ministriesToRemove, []);

const upgrade = planCoreStatusTransition(member({ roles: ['member'], ministries: ['lector_commentator'] }), true);
assert.equal(upgrade.requiresCleanup, false);
assert.deepEqual(upgrade.preservedRoles, ['member']);
assert.deepEqual(upgrade.preservedMinistries, ['lector_commentator']);
assert.match(upgrade.warnings.join(' '), /does not automatically assign/i);

const downgrade = planCoreStatusTransition(member({
  isCoreMember: true,
  roles: ['member', 'secretary', 'kitchen_leader'],
  ministries: ['lector_commentator', 'kitchen', 'cleaning', 'cleaning_toilet_ok'],
}), false);
assert.equal(downgrade.requiresCleanup, true);
assert.deepEqual(downgrade.rolesToRemove.sort(), ['kitchen_leader', 'secretary']);
assert.deepEqual(downgrade.ministriesToRemove.sort(), ['cleaning', 'cleaning_toilet_ok', 'kitchen']);
assert.deepEqual(downgrade.preservedRoles, ['member']);
assert.deepEqual(downgrade.preservedMinistries, ['lector_commentator']);

const coreNoChange = planCoreStatusTransition(member({
  isCoreMember: true,
  roles: ['member', 'treasurer'],
  ministries: ['altar_server'],
}), true);
assert.equal(coreNoChange.requiresCleanup, false);
assert.deepEqual(coreNoChange.preservedRoles, ['member', 'treasurer']);
assert.deepEqual(coreNoChange.preservedMinistries, ['altar_server']);

console.log('Core status transition planning verification passed.');
