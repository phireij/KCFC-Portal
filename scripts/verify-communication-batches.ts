import assert from 'node:assert/strict';
import { buildBroadcastBatchPlan } from '../src/lib/broadcastCommunication';
import { buildDutyAssignmentBatchPlan } from '../src/lib/dutyCommunication';

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

const dutyBatch = buildDutyAssignmentBatchPlan({
  dutyId: 'duty-1',
  title: 'Community duty assigned',
  message: 'Please review your duty.',
  link: '/duties?view=mine',
  recipients: [
    { uid: 'core-1', preferences: defaults, fcmTokens: ['duty-a', 'shared'] },
    { uid: 'core-muted', preferences: { ...defaults, duties: false }, fcmTokens: ['duty-muted'] },
    { uid: 'core-2', preferences: defaults, fcmTokens: ['shared', 'duty-b'] },
  ],
});
assert.equal(dutyBatch.notifications.length, 3);
assert.deepEqual(dutyBatch.pushRecipientIds.sort(), ['core-1', 'core-2']);
assert.deepEqual(dutyBatch.pushTokens.sort(), ['duty-a', 'duty-b', 'shared']);
assert.equal(dutyBatch.notifications.find((plan) => plan.record.userId === 'core-muted')?.record.channels?.join(','), 'inbox');

const broadcastBatch = buildBroadcastBatchPlan({
  broadcastId: 'broadcast-1',
  title: 'KCFC notice',
  message: 'Routine community message.',
  recipients: [
    { uid: 'member-1', preferences: defaults, fcmTokens: ['broadcast-a'] },
    { uid: 'member-muted', preferences: { ...defaults, broadcasts: false }, fcmTokens: ['broadcast-muted'] },
    { uid: 'member-1', preferences: defaults, fcmTokens: ['broadcast-newer'] },
  ],
});
assert.equal(broadcastBatch.notifications.length, 2);
assert.deepEqual(broadcastBatch.pushRecipientIds, ['member-1']);
assert.deepEqual(broadcastBatch.pushTokens, ['broadcast-newer']);
assert.equal(broadcastBatch.notifications.find((plan) => plan.record.userId === 'member-muted')?.record.channels?.join(','), 'inbox');

const urgentBatch = buildBroadcastBatchPlan({
  broadcastId: 'broadcast-urgent',
  title: 'Urgent KCFC notice',
  message: 'Same-day operational change.',
  urgent: true,
  recipients: [
    { uid: 'member-urgent', preferences: defaults, fcmTokens: ['urgent-a'] },
  ],
});
assert.equal(urgentBatch.notifications[0].record.urgency, 'urgent');
assert.ok(urgentBatch.notifications[0].record.channels?.includes('inbox'));
assert.ok(urgentBatch.notifications[0].record.channels?.includes('pwa'));

console.log('Communication batch verification passed.');
