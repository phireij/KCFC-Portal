import type { CommunicationChannel, NotificationDelivery } from '../types';

export type PlannedNotificationRecord = {
  userId: string;
  title: string;
  message: string;
  type: 'announcement' | 'duty' | 'system' | 'broadcast';
  status: 'unread';
  channels?: CommunicationChannel[];
  deliveries?: NotificationDelivery[];
  [key: string]: unknown;
};

/**
 * Produces an optional delivery ledger for a channel execution attempt.
 * It never marks a channel sent/delivered by assumption; callers update the status only
 * after the corresponding transport reports its result.
 */
export function buildQueuedDeliveryLedger(channels: CommunicationChannel[] = []): NotificationDelivery[] {
  return Array.from(new Set(channels))
    .filter((channel) => channel !== 'inbox')
    .map((channel) => ({
      channel,
      status: 'queued' as const,
    }));
}

/**
 * Adds database-bound metadata to an already planned notification record.
 * The caller supplies Firestore serverTimestamp() (or a synthetic timestamp in tests),
 * keeping the planning layer independent from Firebase.
 *
 * Any planned secondary channel is persisted as `queued` unless the caller already
 * supplied an explicit delivery ledger. This makes the Inbox diagnostics honest from
 * creation time: planned never means sent.
 */
export function materializeNotificationRecord<T extends PlannedNotificationRecord>(
  record: T,
  createdAt: unknown,
): T & { createdAt: unknown } {
  const deliveries = record.deliveries ?? buildQueuedDeliveryLedger(record.channels || []);
  return {
    ...record,
    ...(deliveries.length > 0 ? { deliveries } : {}),
    createdAt,
  };
}
