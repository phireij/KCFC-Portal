import assert from 'node:assert/strict';
import type { UserProfile } from '../src/types';
import { getMemberAccountStatus, summarizeMemberAccountStatus } from '../src/lib/memberAccountStatus';

const profile = (uid: string, overrides: Partial<UserProfile> = {}): UserProfile => ({
  uid,
  email: `${uid}@example.com`,
  displayName: uid,
  photoURL: '',
  roles: ['member'],
  ministries: [],
  isVerified: true,
  createdAt: '2026-09-10T00:00:00.000Z',
  updatedAt: '2026-09-10T00:00:00.000Z',
  ...overrides,
});

assert.equal(getMemberAccountStatus(profile('active')), 'active');
assert.equal(getMemberAccountStatus(profile('pending', { isVerified: false })), 'pending');
assert.equal(getMemberAccountStatus(profile('disabled', { isDisabled: true })), 'disabled');
assert.equal(getMemberAccountStatus(profile('disabled-pending', { isDisabled: true, isVerified: false })), 'disabled');

const summary = summarizeMemberAccountStatus([
  profile('active'),
  profile('pending', { isVerified: false }),
  profile('disabled', { isDisabled: true }),
  profile('admin', { roles: ['member', 'admin'] }),
]);

assert.deepEqual(summary, { total: 3, active: 1, pending: 1, disabled: 1 });
console.log('Read-only member account status classification and summary verified.');
