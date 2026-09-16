import assert from 'node:assert/strict';
import {
  buildAssignmentChangeCreatorPlan,
  buildAvailabilityCompletionCreatorPlan,
  buildAvailabilityRequestCreatorPlan,
  buildPublishedRosterCreatorPlan,
} from '../src/lib/liturgicalCreatorPlan';

const defaults = {
  announcements: true,
  duties: true,
  broadcasts: true,
  availability: true,
  assignments: true,
  urgentNotices: true,
  emailPartner: true,
  optionalChannels: {
    line: false,
    telegram: false,
    whatsapp: false,
    viber: false,
  },
};

const members = [
  {
    uid: 'admin-1',
    email: 'admin@example.invalid',
    displayName: 'Admin One',
    photoURL: '',
    roles: ['admin'],
    ministries: [],
    isVerified: true,
    createdAt: '',
    updatedAt: '',
    preferences: defaults,
    fcmTokens: ['admin-token'],
  },
  {
    uid: 'creator-1',
    email: 'creator@example.invalid',
    displayName: 'Creator One',
    photoURL: '',
    roles: ['member'],
    ministries: ['lector_commentator'],
    isVerified: true,
    createdAt: '',
    updatedAt: '',
    preferences: defaults,
    fcmTokens: ['creator-token'],
  },
  {
    uid: 'usher-muted',
    email: 'usher@example.invalid',
    displayName: 'Usher Muted',
    photoURL: '',
    roles: ['member'],
    ministries: ['usher'],
    isVerified: true,
    createdAt: '',
    updatedAt: '',
    preferences: { ...defaults, availability: false, assignments: false },
    fcmTokens: ['muted-token'],
  },
  {
    uid: 'disabled-president',
    email: 'president@example.invalid',
    displayName: 'Disabled President',
    photoURL: '',
    roles: ['president'],
    ministries: [],
    isVerified: true,
    isDisabled: true,
    createdAt: '',
    updatedAt: '',
    preferences: defaults,
    fcmTokens: ['disabled-token'],
  },
] as any[];

const request = buildAvailabilityRequestCreatorPlan({
  eligibleMembers: [members[1], members[2], members[3]],
  pollId: 'poll-1',
  pollTitle: 'October Availability',
});
assert.deepEqual(request.notifications.map((plan) => plan.record.userId).sort(), ['creator-1', 'usher-muted']);
assert.deepEqual(request.pushRecipientIds, ['creator-1']);
assert.deepEqual(request.emailRecipientIds, ['creator-1']);

const completion = buildAvailabilityCompletionCreatorPlan({
  members,
  pollId: 'poll-1',
  pollTitle: 'October Availability',
  createdBy: 'creator-1',
});
assert.deepEqual(completion.notifications.map((plan) => plan.record.userId).sort(), ['admin-1', 'creator-1']);
assert.deepEqual(completion.pushRecipientIds.sort(), ['admin-1', 'creator-1']);
assert.equal(completion.notifications.some((plan) => plan.record.userId === 'disabled-president'), false);

const published = buildPublishedRosterCreatorPlan({
  members,
  assignedUserIds: ['creator-1', 'usher-muted', 'disabled-president'],
  pollId: 'poll-1',
  pollTitle: 'October Availability',
});
assert.deepEqual(published.notifications.map((plan) => plan.record.userId).sort(), ['creator-1', 'usher-muted']);
assert.deepEqual(published.pushRecipientIds, ['creator-1']);
assert.deepEqual(published.emailRecipientIds, ['creator-1']);
assert.equal(published.notifications.find((plan) => plan.record.userId === 'usher-muted')?.record.urgency, 'important');

const changed = buildAssignmentChangeCreatorPlan({
  members,
  affectedUserIds: ['creator-1', 'usher-muted'],
  pollId: 'poll-1',
  pollTitle: 'October Availability',
});
assert.deepEqual(changed.pushRecipientIds, ['creator-1']);
assert.equal(changed.notifications.find((plan) => plan.record.userId === 'creator-1')?.record.urgency, 'important');
assert.equal((changed.notifications.find((plan) => plan.record.userId === 'creator-1')?.record as any)?.eventKind, 'assignment_change');

console.log('Liturgical creator plan verification passed.');
