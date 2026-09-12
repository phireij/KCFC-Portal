import assert from 'node:assert/strict';
import { buildLiturgicalPublicationPlan } from '../src/lib/liturgicalPublicationPlan';

const defaults = {
  announcements: true,
  duties: true,
  broadcasts: true,
  availability: true,
  assignments: true,
  urgentNotices: true,
  emailPartner: true,
  optionalChannels: { line: false, telegram: false, whatsapp: false, viber: false },
};

const members = [
  { uid: 'a', roles: ['member'], ministries: ['lector_commentator'], isDisabled: false, preferences: defaults, fcmTokens: ['a-token'] },
  { uid: 'b', roles: ['member'], ministries: ['usher'], isDisabled: false, preferences: defaults, fcmTokens: ['b-token'] },
  { uid: 'c', roles: ['member'], ministries: ['altar_server'], isDisabled: false, preferences: defaults, fcmTokens: ['c-token'] },
  { uid: 'disabled', roles: ['member'], ministries: ['usher'], isDisabled: true, preferences: defaults, fcmTokens: ['disabled-token'] },
] as any[];

const initial = buildLiturgicalPublicationPlan({
  members,
  pollId: 'poll-1',
  pollTitle: 'October Roster',
  state: {
    assignments: {
      '2026-10-04': { a: 'Lector 1', b: 'Usher 1', disabled: 'Usher 2' },
    },
  },
});
assert.equal(initial.mode, 'initial');
assert.equal(initial.nextRevision, 1);
assert.deepEqual(initial.affectedUserIds, ['a', 'b', 'disabled']);
assert.deepEqual(initial.communicationPlan.notifications.map((item) => item.record.userId).sort(), ['a', 'b']);

const revision = buildLiturgicalPublicationPlan({
  members,
  pollId: 'poll-1',
  pollTitle: 'October Roster',
  state: {
    rosterRevision: 1,
    lastPublishedAssignments: {
      '2026-10-04': { a: 'Lector 1', b: 'Usher 1' },
    },
    assignments: {
      '2026-10-04': { a: 'Lector 2', c: 'Altar Server 1' },
    },
  },
});
assert.equal(revision.mode, 'revision');
assert.equal(revision.nextRevision, 2);
assert.deepEqual(revision.affectedUserIds, ['a', 'b', 'c']);
assert.deepEqual(revision.communicationPlan.notifications.map((item) => item.record.userId).sort(), ['a', 'b', 'c']);
assert.ok(revision.communicationPlan.notifications.every((item) => item.record.urgency === 'important'));

const unchanged = buildLiturgicalPublicationPlan({
  members,
  pollId: 'poll-1',
  pollTitle: 'October Roster',
  state: {
    rosterRevision: 3,
    lastPublishedAssignments: {
      '2026-10-04': { a: 'Lector 1', b: 'Usher 1' },
    },
    assignments: {
      '2026-10-04': { b: 'Usher 1', a: 'Lector 1' },
    },
  },
});
assert.equal(unchanged.mode, 'no_change');
assert.equal(unchanged.nextRevision, 3);
assert.deepEqual(unchanged.affectedUserIds, []);
assert.deepEqual(unchanged.communicationPlan.notifications, []);

console.log('Liturgical publication plan verification passed.');
