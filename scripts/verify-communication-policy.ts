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
import { buildLeadershipQueueMetrics } from '../src/lib/leadershipQueueMetrics';
import { buildTreasuryMetrics } from '../src/lib/treasuryMetrics';

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

const queueMetrics = buildLeadershipQueueMetrics({
  users: [
    { uid: 'pending', isVerified: false, isDisabled: false } as any,
    { uid: 'disabled', isVerified: false, isDisabled: true } as any,
    { uid: 'verified', isVerified: true, isDisabled: false } as any,
  ],
  messages: [
    { status: 'unread' },
    { status: 'read' },
    {},
  ],
  polls: [
    { id: 'active', category: 'committee', status: 'active' } as any,
    { id: 'needs-review', category: 'committee', status: 'closed', publicationMode: 'explicit', rosterPublished: false } as any,
    { id: 'published', category: 'committee', status: 'closed', publicationMode: 'explicit', rosterPublished: true } as any,
  ],
});
assert.equal(queueMetrics.pendingMembers, 1);
assert.equal(queueMetrics.unreadInquiries, 2);
assert.equal(queueMetrics.activeAvailability, 1);
assert.equal(queueMetrics.unpublishedRosters, 1);
assert.equal(queueMetrics.attentionItems, 4);

const treasury = buildTreasuryMetrics([
  { id: 'income-old', type: 'income', amount: 10000, category: 'Dues', description: '', date: '2026-08-01', status: 'approved' } as any,
  { id: 'income-now', type: 'income', amount: 5000, category: 'Donation', description: '', date: '2026-09-05', status: 'approved' } as any,
  { id: 'expense-now', type: 'expense', amount: 3000, category: 'Supplies', description: '', date: '2026-09-06', status: 'approved' } as any,
  { id: 'pending', type: 'expense', amount: 2000, category: 'Event', description: '', date: '2026-09-07', status: 'pending' } as any,
], new Date('2026-09-10T12:00:00+09:00'));
assert.equal(treasury.approvedIncome, 15000);
assert.equal(treasury.approvedExpenses, 3000);
assert.equal(treasury.approvedBalance, 12000);
assert.equal(treasury.pendingCount, 1);
assert.equal(treasury.pendingAmount, 2000);
assert.equal(treasury.currentMonthIncome, 5000);
assert.equal(treasury.currentMonthExpenses, 3000);

console.log('Communication, leadership, and treasury policy verification passed.');
