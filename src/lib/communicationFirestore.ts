import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  type Firestore,
  type WriteBatch,
} from 'firebase/firestore';
import type { CommunicationChannel } from '../types';
import type { CommunicationBatchPlan } from './communicationBatch';
import type { PlannedNotificationRecord } from './notificationPersistence';
import { materializeNotificationRecord } from './notificationPersistence';
import { initializeDeliveryDiagnostics, recordDeliveryOutcome, type DeliveryTerminalStatus } from './deliveryDiagnostics';

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

/**
 * Attaches actual secondary-transport evidence to already-created Inbox records.
 *
 * Safety rules:
 * - only exact notification IDs returned by the creator path should be supplied;
 * - every record is re-read and its userId must match before mutation;
 * - provider acceptance is recorded as `sent`, never `delivered`;
 * - existing delivery entries for other channels are preserved.
 */
export async function persistCommunicationDeliveryOutcome({
  firestore,
  notificationIds,
  userId,
  channel,
  status,
  detail,
}: {
  firestore: Firestore;
  notificationIds: string[];
  userId: string;
  channel: Exclude<CommunicationChannel, 'inbox'>;
  status: DeliveryTerminalStatus;
  detail?: string;
}) {
  let updated = 0;
  for (const notificationId of Array.from(new Set(notificationIds.filter(Boolean)))) {
    const notificationRef = doc(firestore, 'notifications', notificationId);
    const snapshot = await getDoc(notificationRef);
    if (!snapshot.exists()) continue;
    const data = snapshot.data();
    if (data.userId !== userId) continue;

    const deliveries = recordDeliveryOutcome({
      deliveries: Array.isArray(data.deliveries)
        ? data.deliveries
        : initializeDeliveryDiagnostics(Array.isArray(data.channels) ? data.channels : []),
      channel,
      status,
      updatedAt: new Date(),
      detail,
    });
    await updateDoc(notificationRef, { deliveries });
    updated += 1;
  }
  return updated;
}
