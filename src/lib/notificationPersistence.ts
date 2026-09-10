import type { CommunicationChannel, NotificationDelivery } from '../types';

export type PlannedNotificationRecord = {
  userId: string;
  title: string;
  message: string;
  type: 'announcement' | 'duty' | 'system' | 'broadcast';
  status: 'unread';
  channels?: CommunicationChannel[];
  [key: string]: unknown;
};

/**
 * Adds database-bound metadata to an already planned notification record.
 * The caller supplies Firestore serverTimestamp() (or a synthetic timestamp in tests),
 * keeping the planning layer independent from Firebase.
 */
export function materializeNotificationRecord<T extends PlannedNotificationRecord>(
  record: T,
  createdAt: unknown,
): T & { createdAt: unknown } {
  return {
    ...record,
    createdAt,
  };
}

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
