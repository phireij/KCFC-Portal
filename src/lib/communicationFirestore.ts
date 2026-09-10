import {
  collection,
  doc,
  serverTimestamp,
  type Firestore,
  type WriteBatch,
} from 'firebase/firestore';
import type { CommunicationChannel } from '../types';
import type { CommunicationBatchPlan } from './communicationBatch';
import type { PlannedNotificationRecord } from './notificationPersistence';
import { materializeNotificationRecord } from './notificationPersistence';

type NotificationPlanLike = {
  routing: { channels: CommunicationChannel[] };
  record: PlannedNotificationRecord;
};

/**
 * Appends planned KCFC Inbox records to an existing Firestore WriteBatch.
 *
 * This adapter intentionally does not execute the batch and does not send PWA,
 * email or external-provider messages. The caller retains transaction/commit
 * ownership so existing creator atomicity is preserved.
 *
 * The returned recipient->notification map lets a transport caller attach later
 * delivery evidence to the exact Inbox record without guessing from timestamps,
 * titles or recipient order.
 */
export function appendCommunicationNotificationsToBatch(
  batch: WriteBatch,
  firestore: Firestore,
  plan: CommunicationBatchPlan<NotificationPlanLike>,
) {
  const notificationIds: string[] = [];
  const notificationIdsByUser: Record<string, string[]> = {};

  plan.notifications.forEach(({ record }) => {
    const notificationRef = doc(collection(firestore, 'notifications'));
    notificationIds.push(notificationRef.id);
    notificationIdsByUser[record.userId] = [
      ...(notificationIdsByUser[record.userId] || []),
      notificationRef.id,
    ];
    batch.set(
      notificationRef,
      materializeNotificationRecord(record, serverTimestamp()),
    );
  });

  return {
    notificationIds,
    notificationIdsByUser,
    pushRecipientIds: [...plan.pushRecipientIds],
    pushTokens: [...plan.pushTokens],
    emailRecipientIds: [...plan.emailRecipientIds],
    connectorRecipientIds: { ...plan.connectorRecipientIds },
  };
}
