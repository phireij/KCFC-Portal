import assert from 'node:assert/strict';
import { buildCommunicationRoutingPlan } from '../src/lib/communicationRouting';
import { buildNotificationRecord } from '../src/lib/notificationRecord';
import { isProfileEligibleForAudience } from '../src/lib/communicationAudience';
import {
  buildAvailabilityCompletionNotification,
  buildAvailabilityRequestNotification,
  buildPublishedAssignmentNotification,
} from '../src/lib/liturgicalCommunication';
import { buildDutyAssignmentNotification } from '../src/lib/dutyCommunication';
import { buildBroadcastNotification } from '../src/lib/broadcastCommunication';

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

const routine = buildCommunicationRoutingPlan({ kind: 'announcement', preferences: defaults });
assert.deepEqual(routine.channels, ['inbox', 'pwa', 'email']);
assert.equal(routine.urgency, 'normal');

const muted = buildCommunicationRoutingPlan({
  kind: 'announcement',
  preferences: { ...defaults, announcements: false },
});
assert.deepEqual(muted.channels, ['inbox']);

const composerNoPush = buildCommunicationRoutingPlan({
  kind: 'announcement',
  preferences: defaults,
  allowPwa: false,
});
assert.deepEqual(composerNoPush.channels, ['inbox', 'email']);

const composerInboxOnly = buildCommunicationRoutingPlan({
  kind: 'announcement',
  preferences: defaults,
  allowPwa: false,
  allowEmail: false,
});
assert.deepEqual(composerInboxOnly.channels, ['inbox']);

const assignment = buildCommunicationRoutingPlan({ kind: 'assignment', preferences: defaults });
assert.equal(assignment.urgency, 'important');
assert.ok(assignment.channels.includes('inbox'));
assert.ok(assignment.channels.includes('pwa'));

const connectorBlocked = buildCommunicationRoutingPlan({
  kind: 'announcement',
  preferences: {
    ...defaults,
    optionalChannels: { ...defaults.optionalChannels, line: true },
  },
  connectedProviders: ['line'],
  allowExternalConnectors: false,
});
assert.equal(connectorBlocked.channels.includes('line'), false);

const connectorAllowed = buildCommunicationRoutingPlan({
  kind: 'announcement',
  preferences: {
    ...defaults,
    optionalChannels: { ...defaults.optionalChannels, line: true },
  },
  connectedProviders: ['line'],
  allowExternalConnectors: true,
});
assert.equal(connectorAllowed.channels.includes('line'), true);

const record = buildNotificationRecord({
  userId: 'synthetic-user',
  title: 'KCFC Update',
  message: 'Synthetic policy verification',
  type: 'announcement',
  sourceId: 'synthetic-announcement',
  sourceType: 'announcement',
  channels: ['pwa', 'email'],
});
assert.equal(record.status, 'unread');
assert.deepEqual(record.channels, ['inbox', 'pwa', 'email']);

assert.equal(isProfileEligibleForAudience({ isDisabled: true, isVerified: true }, 'kcfc_members'), false);
assert.equal(isProfileEligibleForAudience({ isVerified: false }, 'kcfc_members'), false);
assert.equal(isProfileEligibleForAudience({ isVerified: true }, 'kcfc_members'), true);
assert.equal(isProfileEligibleForAudience({ roles: ['member'] }, 'leadership'), false);
assert.equal(isProfileEligibleForAudience({ roles: ['president'] }, 'leadership'), true);
assert.equal(isProfileEligibleForAudience({ isDisabled: false }, 'public'), true);
assert.equal(isProfileEligibleForAudience({ isDisabled: false }, 'parishioners'), true);

const availabilityRequest = buildAvailabilityRequestNotification({
  userId: 'lector-1',
  pollId: 'poll-availability',
  pollTitle: 'October Liturgical Availability',
  preferences: defaults,
});
assert.equal(availabilityRequest.record.sourceType, 'availability');
assert.equal(availabilityRequest.record.sourceId, 'poll-availability');
assert.equal(availabilityRequest.record.urgency, 'normal');
assert.deepEqual(availabilityRequest.record.channels, ['inbox', 'pwa', 'email']);
assert.equal(availabilityRequest.record.link, '/polls?id=poll-availability');

const mutedAvailability = buildAvailabilityRequestNotification({
  userId: 'usher-1',
  pollId: 'poll-availability',
  pollTitle: 'October Liturgical Availability',
  preferences: { ...defaults, availability: false },
});
assert.deepEqual(mutedAvailability.record.channels, ['inbox']);

const availabilityComplete = buildAvailabilityCompletionNotification({
  userId: 'leader-1',
  pollId: 'poll-availability',
  pollTitle: 'October Liturgical Availability',
  preferences: defaults,
});
assert.equal(availabilityComplete.record.sourceType, 'availability');
assert.equal(availabilityComplete.record.link, '/polls?id=poll-availability&leader=1');

const publishedAssignment = buildPublishedAssignmentNotification({
  userId: 'altar-server-1',
  pollId: 'poll-availability',
  pollTitle: 'October Liturgical Availability',
  preferences: defaults,
});
assert.equal(publishedAssignment.record.sourceType, 'assignment');
assert.equal(publishedAssignment.record.urgency, 'important');
assert.equal(publishedAssignment.record.link, '/duties?view=mine');
assert.ok(publishedAssignment.record.channels.includes('inbox'));
assert.ok(publishedAssignment.record.channels.includes('pwa'));

const duty = buildDutyAssignmentNotification({
  userId: 'core-1',
  dutyId: 'duty-1',
  title: 'Community duty assigned',
  message: 'Please review your kitchen duty.',
  link: '/duties?view=mine',
  preferences: defaults,
});
assert.equal(duty.record.sourceType, 'duty');
assert.equal(duty.record.urgency, 'normal');
assert.deepEqual(duty.record.channels, ['inbox', 'pwa', 'email']);

const mutedDuty = buildDutyAssignmentNotification({
  userId: 'core-2',
  title: 'Community duty assigned',
  message: 'Please review your cleaning duty.',
  preferences: { ...defaults, duties: false },
});
assert.deepEqual(mutedDuty.record.channels, ['inbox']);

const broadcast = buildBroadcastNotification({
  userId: 'member-1',
  broadcastId: 'broadcast-1',
  title: 'KCFC notice',
  message: 'Routine community message.',
  preferences: defaults,
});
assert.equal(broadcast.record.sourceType, 'broadcast');
assert.equal(broadcast.record.urgency, 'normal');
assert.deepEqual(broadcast.record.channels, ['inbox', 'pwa', 'email']);

const urgentBroadcast = buildBroadcastNotification({
  userId: 'member-2',
  broadcastId: 'broadcast-urgent',
  title: 'Urgent KCFC notice',
  message: 'Same-day operational change.',
  preferences: defaults,
  urgent: true,
});
assert.equal(urgentBroadcast.record.urgency, 'urgent');
assert.ok(urgentBroadcast.record.channels.includes('inbox'));
assert.ok(urgentBroadcast.record.channels.includes('pwa'));

console.log('Communication policy verification passed.');
