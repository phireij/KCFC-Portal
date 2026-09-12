import assert from 'node:assert/strict';
import { normalizeMemberRoles, validateMemberGovernance } from '../src/lib/memberGovernance';
import type { UserProfile } from '../src/types';

const base = (uid: string, roles: UserProfile['roles'] = ['member'], ministries: UserProfile['ministries'] = [], core = true): UserProfile => ({
  uid,
  email: `${uid}@example.com`,
  displayName: uid,
  photoURL: '',
  roles,
  ministries,
  isVerified: true,
  isCoreMember: core,
  createdAt: '2026-09-10',
  updatedAt: '2026-09-10',
});

assert.deepEqual(normalizeMemberRoles(['secretary']), ['secretary', 'member']);
assert.deepEqual(normalizeMemberRoles(['member', 'member']), ['member']);

const president = base('president');
let issues = validateMemberGovernance({
  member: president,
  allMembers: [president],
  roles: ['president', 'usher_leader'],
  ministries: ['usher'],
});
assert(issues.some((issue) => issue.code === 'president_exclusive'));
assert(issues.some((issue) => issue.code === 'too_many_roles'));

const regular = base('regular', ['member'], [], false);
issues = validateMemberGovernance({
  member: regular,
  allMembers: [regular],
  roles: ['member', 'usher_leader'],
  ministries: ['usher', 'kitchen'],
});
assert(issues.some((issue) => issue.code === 'core_required_for_leadership'));
assert(issues.some((issue) => issue.code === 'core_required_for_chore'));

const choir = base('choir');
issues = validateMemberGovernance({
  member: choir,
  allMembers: [choir],
  roles: ['member'],
  ministries: ['choir_a', 'lector_commentator'],
});
assert(issues.some((issue) => issue.code === 'choir_exclusive'));

const usherLeader = base('usher-leader');
issues = validateMemberGovernance({
  member: usherLeader,
  allMembers: [usherLeader],
  roles: ['member', 'usher_leader'],
  ministries: [],
});
assert(issues.some((issue) => issue.code === 'role_requires_ministry'));

const existingSecretary = base('existing-secretary', ['member', 'secretary']);
const candidate = base('candidate');
issues = validateMemberGovernance({
  member: candidate,
  allMembers: [existingSecretary, candidate],
  roles: ['member', 'secretary'],
  ministries: [],
});
assert(issues.some((issue) => issue.code === 'role_limit'));

const dualRole = base('dual');
issues = validateMemberGovernance({
  member: dualRole,
  allMembers: [dualRole],
  roles: ['member', 'secretary', 'kitchen_leader'],
  ministries: ['kitchen'],
});
assert.equal(issues.length, 0);

issues = validateMemberGovernance({
  member: dualRole,
  allMembers: [dualRole],
  roles: ['member', 'secretary', 'usher_leader'],
  ministries: ['usher'],
});
assert(issues.some((issue) => issue.code === 'too_many_roles'));

console.log('Member governance verification passed.');
