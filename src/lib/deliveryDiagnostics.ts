import type { CommunicationChannel, NotificationDelivery } from '../types';
import { buildQueuedDeliveryLedger } from './notificationPersistence';

export type DeliveryTerminalStatus = 'sent' | 'delivered' | 'failed' | 'skipped' | 'read';

export function initializeDeliveryDiagnostics(channels: CommunicationChannel[]): NotificationDelivery[] {
  return buildQueuedDeliveryLedger(channels);
}

export function recordDeliveryOutcome({
  deliveries,
  channel,
  status,
  updatedAt,
  detail,
}: {
  deliveries: NotificationDelivery[];
  channel: Exclude<CommunicationChannel, 'inbox'>;
  status: DeliveryTerminalStatus;
  updatedAt?: unknown;
  detail?: string;
}): NotificationDelivery[] {
  const next = deliveries.filter((item) => item.channel !== channel);
  next.push({
    channel,
    status,
    ...(updatedAt !== undefined ? { updatedAt } : {}),
    ...(detail ? { detail } : {}),
  });
  return next;
}

export function summarizeDeliveryDiagnostics(deliveries: NotificationDelivery[] = []) {
  const summary = {
    queued: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
    skipped: 0,
    read: 0,
    hasFailure: false,
    hasPending: false,
  };

  deliveries.forEach((delivery) => {
    summary[delivery.status] += 1;
  });
  summary.hasFailure = summary.failed > 0;
  summary.hasPending = summary.queued > 0;
  return summary;
}

/**
 * A channel is successful only when a transport has explicitly reported a
 * successful state. Merely planning or queueing a channel never counts as sent.
 */
export function isDeliverySuccessful(delivery: NotificationDelivery) {
  return ['sent', 'delivered', 'read'].includes(delivery.status);
}
