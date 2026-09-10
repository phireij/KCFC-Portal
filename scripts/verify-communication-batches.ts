import assert from 'node:assert/strict';
import { buildBroadcastBatchPlan } from '../src/lib/broadcastCommunication';
import { buildDutyAssignmentBatchPlan } from '../src/lib/dutyCommunication';
import { buildCommunicationBatchPlan } from '../src/lib/communicationBatch';
import {
  leadershipCommunicationRecipients,
  recipientsForUserIds,
  toCommunicationRecipient,
} from '../src/lib/communicationRecipient';
import {
  buildQueuedDeliveryLedger,
  materializeNotificationRecord,
} from '../src/lib/notificationPersistence';

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
assert.deepEqual(dutyBatch.emailRecipientIds.sort(), ['core-1', 'core-2']);
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
assert.deepEqual(broadcastBatch.emailRecipientIds, ['member-1']);
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

const connectorBatch = buildCommunicationBatchPlan(
  [
    { uid: 'line-user', fcmTokens: ['line-push'] },
    { uid: 'telegram-user' },
    { uid: 'inbox-only' },
  ],
  (recipient) => {
    const channels = recipient.uid === 'line-user'
      ? ['inbox', 'pwa', 'email', 'line'] as const
      : recipient.uid === 'telegram-user'
        ? ['inbox', 'telegram'] as const
        : ['inbox'] as const;
    return {
      routing: { channels: [...channels] },
      record: { userId: recipient.uid, channels: [...channels] },
    };
  },
);
assert.deepEqual(connectorBatch.pushRecipientIds, ['line-user']);
assert.deepEqual(connectorBatch.emailRecipientIds, ['line-user']);
assert.deepEqual(connectorBatch.connectorRecipientIds.line, ['line-user']);
assert.deepEqual(connectorBatch.connectorRecipientIds.telegram, ['telegram-user']);
assert.equal(connectorBatch.connectorRecipientIds.whatsapp, undefined);
assert.equal(connectorBatch.connectorRecipientIds.viber, undefined);

const syntheticProfiles = [
  {
    uid: 'leader-admin',
    roles: ['admin'],
    preferences: defaults,
    connectedCommunicationApps: [{ provider: 'line', status: 'connected' }],
    fcmTokens: ['admin-token'],
  },
  {
    uid: 'creator',
    roles: ['member'],
    preferences: { ...defaults, availability: false },
    fcmTokens: ['creator-token'],
  },
  {
    uid: 'disabled-president',
    roles: ['president'],
    isDisabled: true,
    preferences: defaults,
    fcmTokens: ['disabled-token'],
  },
] as any[];

const mapped = toCommunicationRecipient(syntheticProfiles[0]);
assert.equal(mapped.uid, 'leader-admin');
assert.deepEqual(mapped.fcmTokens, ['admin-token']);
assert.equal(mapped.connectedCommunicationApps?.[0]?.provider, 'line');

const selected = recipientsForUserIds(syntheticProfiles, ['creator', 'disabled-president']);
assert.deepEqual(selected.map((recipient) => recipient.uid), ['creator']);

const leaders = leadershipCommunicationRecipients(syntheticProfiles, ['creator']);
assert.deepEqual(leaders.map((recipient) => recipient.uid).sort(), ['creator', 'leader-admin']);

const syntheticTimestamp = { seconds: 123456, nanoseconds: 0 };
const persisted = materializeNotificationRecord({
  userId: 'member-persist',
  title: 'Persist me',
  message: 'Synthetic persistence test',
  type: 'system',
  status: 'unread',
  channels: ['inbox', 'pwa', 'email'],
}, syntheticTimestamp);
assert.deepEqual(persisted.createdAt, syntheticTimestamp);
assert.equal(persisted.userId, 'member-persist');

const queuedDeliveries = buildQueuedDeliveryLedger(['inbox', 'pwa', 'email', 'pwa']);
assert.deepEqual(queuedDeliveries, [
  { channel: 'pwa', status: 'queued' },
  { channel: 'email', status: 'queued' },
]);

console.log('Communication batch verification passed.');
