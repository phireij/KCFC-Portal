import type {
  CommunicationChannel,
  ConnectedCommunicationApp,
  NotificationPreferences,
} from '../types';

export type CommunicationBatchRecipient = {
  uid: string;
  preferences?: NotificationPreferences;
  connectedCommunicationApps?: ConnectedCommunicationApp[];
  fcmTokens?: string[];
};

type CommunicationPlanLike = {
  routing: {
    channels: CommunicationChannel[];
  };
  record: {
    userId: string;
    channels?: CommunicationChannel[];
    [key: string]: unknown;
  };
};

export type CommunicationBatchPlan<TPlan extends CommunicationPlanLike> = {
  notifications: TPlan[];
  pushRecipientIds: string[];
  pushTokens: string[];
};

export function buildCommunicationBatchPlan<TPlan extends CommunicationPlanLike>(
  recipients: CommunicationBatchRecipient[],
  build: (recipient: CommunicationBatchRecipient) => TPlan,
): CommunicationBatchPlan<TPlan> {
  const byUid = new Map<string, CommunicationBatchRecipient>();
  recipients.forEach((recipient) => {
    if (recipient.uid) byUid.set(recipient.uid, recipient);
  });

  const uniqueRecipients = Array.from(byUid.values());
  const notifications = uniqueRecipients.map(build);
  const pushRecipientIds: string[] = [];
  const pushTokenSet = new Set<string>();

  notifications.forEach((plan, index) => {
    if (!plan.routing.channels.includes('pwa')) return;
    const recipient = uniqueRecipients[index];
    pushRecipientIds.push(recipient.uid);
    (recipient.fcmTokens || []).filter(Boolean).forEach((token) => pushTokenSet.add(token));
  });

  return {
    notifications,
    pushRecipientIds,
    pushTokens: Array.from(pushTokenSet),
  };
}
