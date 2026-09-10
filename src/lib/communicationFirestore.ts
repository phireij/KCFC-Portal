import {
  collection,
  doc,
  serverTimestamp,
  type Firestore,
  type WriteBatch,
} from 'firebase/firestore';
import type { CommunicationBatchPlan } from './communicationBatch';
import type { PlannedNotificationRecord } from './notificationPersistence';
import { materializeNotificationRecord } from './notificationPersistence';

type NotificationPlanLike = {
  routing: { channels: any[] };
  record: PlannedNotificationRecord;
};

/**
 * Appends planned KCFC Inbox records to an existing Firestore WriteBatch.
 *
 * This adapter intentionally does not execute the batch and does not send PWA,
 * email or external-provider messages. The caller retains transaction/commit
 * ownership so existing creator atomicity is preserved.
 */
export function appendCommunicationNotificationsToBatch(
  batch: WriteBatch,
  firestore: Firestore,
  plan: CommunicationBatchPlan<NotificationPlanLike>,
) {
  const notificationIds: string[] = [];

  plan.notifications.forEach(({ record }) => {
    const notificationRef = doc(collection(firestore, 'notifications'));
    notificationIds.push(notificationRef.id);
    batch.set(
      notificationRef,
      materializeNotificationRecord(record, serverTimestamp()),
    );
  });

  return {
    notificationIds,
    pushRecipientIds: [...plan.pushRecipientIds],
    pushTokens: [...plan.pushTokens],
    emailRecipientIds: [...plan.emailRecipientIds],
    connectorRecipientIds: { ...plan.connectorRecipientIds },
  };
}
