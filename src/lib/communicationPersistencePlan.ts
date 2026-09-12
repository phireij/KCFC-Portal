import type { CommunicationChannel, CommunicationConnectorProvider } from '../types';
import type { CommunicationBatchPlan } from './communicationBatch';
import { materializeNotificationRecord, type PlannedNotificationRecord } from './notificationPersistence';

type BatchPlanLike = CommunicationBatchPlan<{
  routing: { channels: CommunicationChannel[] };
  record: PlannedNotificationRecord;
}>;

export type MaterializedCommunicationBatch = {
  notificationRecords: Array<PlannedNotificationRecord & { createdAt: unknown }>;
  pushRecipientIds: string[];
  pushTokens: string[];
  emailRecipientIds: string[];
  connectorRecipientIds: Partial<Record<CommunicationConnectorProvider, string[]>>;
};

/**
 * Converts a pure routing batch into records ready for a database boundary.
 * It still performs no I/O. The caller supplies Firestore serverTimestamp() or
 * a synthetic timestamp and decides whether/when each transport is executed.
 */
export function materializeCommunicationBatch(
  plan: BatchPlanLike,
  createdAt: unknown,
): MaterializedCommunicationBatch {
  return {
    notificationRecords: plan.notifications.map(({ record }) => materializeNotificationRecord(record, createdAt)),
    pushRecipientIds: [...plan.pushRecipientIds],
    pushTokens: [...plan.pushTokens],
    emailRecipientIds: [...plan.emailRecipientIds],
    connectorRecipientIds: Object.fromEntries(
      Object.entries(plan.connectorRecipientIds).map(([provider, recipientIds]) => [
        provider,
        [...(recipientIds || [])],
      ]),
    ) as Partial<Record<CommunicationConnectorProvider, string[]>>,
  };
}
