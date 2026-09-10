import assert from 'node:assert/strict';
import {
  initializeDeliveryDiagnostics,
  isDeliverySuccessful,
  recordDeliveryOutcome,
  summarizeDeliveryDiagnostics,
} from '../src/lib/deliveryDiagnostics';

const initialized = initializeDeliveryDiagnostics(['inbox', 'pwa', 'email', 'pwa']);
assert.deepEqual(initialized, [
  { channel: 'pwa', status: 'queued' },
  { channel: 'email', status: 'queued' },
]);
assert.equal(initialized.some(isDeliverySuccessful), false);

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

console.log('Communication delivery diagnostics verification passed.');
