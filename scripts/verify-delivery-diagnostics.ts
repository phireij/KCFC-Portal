import assert from 'node:assert/strict';
import {
  initializeDeliveryDiagnostics,
  isDeliverySuccessful,
  recordDeliveryOutcome,
  summarizeDeliveryDiagnostics,
} from '../src/lib/deliveryDiagnostics';
import { materializeNotificationRecord } from '../src/lib/notificationPersistence';
import { buildPwaDeliveryEvidence } from '../src/lib/pwaDeliveryEvidence';

const initialized = initializeDeliveryDiagnostics(['inbox', 'pwa', 'email', 'pwa']);
assert.deepEqual(initialized, [
  { channel: 'pwa', status: 'queued' },
  { channel: 'email', status: 'queued' },
]);
assert.equal(initialized.some(isDeliverySuccessful), false);

const materialized = materializeNotificationRecord({
  userId: 'member-1',
  title: 'Synthetic notice',
  message: 'Delivery diagnostics test',
  type: 'system',
  status: 'unread',
  channels: ['inbox', 'pwa', 'email', 'pwa'],
}, 'synthetic-created-at');
assert.deepEqual(materialized.deliveries, [
  { channel: 'pwa', status: 'queued' },
  { channel: 'email', status: 'queued' },
]);
assert.equal(materialized.createdAt, 'synthetic-created-at');

const preservedLedger = materializeNotificationRecord({
  userId: 'member-2',
  title: 'Synthetic existing ledger',
  message: 'Preserve transport evidence',
  type: 'system',
  status: 'unread',
  channels: ['inbox', 'pwa'],
  deliveries: [{ channel: 'pwa', status: 'sent', updatedAt: 'synthetic-existing-time' }],
}, 'synthetic-created-at-2');
assert.equal(preservedLedger.deliveries?.[0].status, 'sent');
assert.equal(preservedLedger.deliveries?.[0].updatedAt, 'synthetic-existing-time');

const pushSent = recordDeliveryOutcome({
  deliveries: initialized,
  channel: 'pwa',
  status: 'sent',
  updatedAt: 'synthetic-time-1',
});
assert.equal(pushSent.find((item) => item.channel === 'pwa')?.status, 'sent');
assert.equal(pushSent.find((item) => item.channel === 'email')?.status, 'queued');

const emailFailed = recordDeliveryOutcome({
  deliveries: pushSent,
  channel: 'email',
  status: 'failed',
  updatedAt: 'synthetic-time-2',
  detail: 'Synthetic SMTP rejection',
});
const summary = summarizeDeliveryDiagnostics(emailFailed);
assert.equal(summary.sent, 1);
assert.equal(summary.failed, 1);
assert.equal(summary.queued, 0);
assert.equal(summary.hasFailure, true);
assert.equal(summary.hasPending, false);
assert.equal(isDeliverySuccessful(emailFailed.find((item) => item.channel === 'email')!), false);

const retriedEmail = recordDeliveryOutcome({
  deliveries: emailFailed,
  channel: 'email',
  status: 'delivered',
});
assert.equal(retriedEmail.filter((item) => item.channel === 'email').length, 1);
assert.equal(retriedEmail.find((item) => item.channel === 'email')?.status, 'delivered');
assert.equal(summarizeDeliveryDiagnostics(retriedEmail).hasFailure, false);

const pwaEvidence = buildPwaDeliveryEvidence(
  ['member-success', 'member-failed', 'member-skipped', 'member-success'],
  [
    { userId: 'member-success', transport: 'fcm', success: false },
    { userId: 'member-success', transport: 'webpush', success: true },
    { userId: 'member-failed', transport: 'fcm', success: false },
    { userId: 'other-member', transport: 'webpush', success: true },
  ],
);
assert.equal(pwaEvidence.length, 3);
assert.equal(pwaEvidence.find((item) => item.userId === 'member-success')?.status, 'sent');
assert.equal(pwaEvidence.find((item) => item.userId === 'member-success')?.successes, 1);
assert.equal(pwaEvidence.find((item) => item.userId === 'member-failed')?.status, 'failed');
assert.equal(pwaEvidence.find((item) => item.userId === 'member-skipped')?.status, 'skipped');
assert.match(pwaEvidence.find((item) => item.userId === 'member-success')?.detail || '', /Web Push 1\/1/);

console.log('Communication delivery diagnostics verification passed.');
