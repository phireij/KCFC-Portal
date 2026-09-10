import assert from 'node:assert/strict';
import { buildLeadershipBroadcastCreatorPlan } from '../src/lib/broadcastCreatorPlan';

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

const plan = buildLeadershipBroadcastCreatorPlan({
  broadcastId: 'broadcast-synthetic',
  title: 'Community notice',
  message: 'Hello [nickname], welcome {name}.',
  recipients: [
    {
      uid: 'member-1',
      displayName: 'Maria Santos',
      nickname: 'Mia',
      email: 'mia@example.com',
      photoURL: '',
      roles: ['member'],
      ministries: [],
      isVerified: true,
      createdAt: '',
      updatedAt: '',
      preferences: defaults,
      fcmTokens: ['push-a', 'shared'],
    },
    {
      uid: 'member-muted',
      displayName: 'Muted Member',
      nickname: 'Muted',
      email: 'muted@example.com',
      photoURL: '',
      roles: ['member'],
      ministries: [],
      isVerified: true,
      createdAt: '',
      updatedAt: '',
      preferences: { ...defaults, broadcasts: false },
      fcmTokens: ['push-muted'],
    },
    {
      uid: 'member-disabled',
      displayName: 'Disabled Member',
      email: 'disabled@example.com',
      photoURL: '',
      roles: ['member'],
      ministries: [],
      isVerified: true,
      isDisabled: true,
      createdAt: '',
      updatedAt: '',
      preferences: defaults,
      fcmTokens: ['push-disabled'],
    },
    {
      uid: 'member-1',
      displayName: 'Maria Santos',
      nickname: 'Mia',
      email: 'mia@example.com',
      photoURL: '',
      roles: ['member'],
      ministries: [],
      isVerified: true,
      createdAt: '',
      updatedAt: '',
      preferences: defaults,
      fcmTokens: ['shared', 'push-newer'],
    },
  ] as any[],
});

assert.equal(plan.notifications.length, 2);
assert.deepEqual(plan.pushRecipientIds, ['member-1']);
assert.deepEqual(plan.pushTokens.sort(), ['push-newer', 'shared']);
assert.deepEqual(plan.emailRecipientIds, []);
assert.equal(plan.notifications.find((item) => item.record.userId === 'member-1')?.record.message, 'Hello Mia, welcome Maria Santos.');
assert.equal(plan.notifications.find((item) => item.record.userId === 'member-muted')?.record.channels?.join(','), 'inbox');
assert.equal(plan.notifications.some((item) => item.record.userId === 'member-disabled'), false);
assert.equal(plan.notifications[0].record.sourceId, 'broadcast-synthetic');
assert.equal(plan.notifications[0].record.sourceType, 'broadcast');

const noPush = buildLeadershipBroadcastCreatorPlan({
  recipients: plan.notifications.map((item) => ({
    uid: item.record.userId,
    displayName: 'Synthetic',
    email: 'synthetic@example.com',
    photoURL: '',
    roles: ['member'],
    ministries: [],
    isVerified: true,
    createdAt: '',
    updatedAt: '',
    preferences: defaults,
    fcmTokens: ['token'],
  })) as any[],
  title: 'Portal only',
  message: 'Inbox only.',
  allowPwa: false,
});
assert.deepEqual(noPush.pushRecipientIds, []);
assert.ok(noPush.notifications.every((item) => item.record.channels?.join(',') === 'inbox'));

console.log('Leadership broadcast creator plan verification passed.');
