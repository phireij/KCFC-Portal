import type {
  CommunicationChannel,
  CommunicationConnectorProvider,
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
  emailRecipientIds: string[];
  connectorRecipientIds: Partial<Record<CommunicationConnectorProvider, string[]>>;
};

const connectorChannels: CommunicationConnectorProvider[] = ['line', 'telegram', 'whatsapp', 'viber'];

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
  const emailRecipientIds: string[] = [];
  const connectorRecipientIds: Partial<Record<CommunicationConnectorProvider, string[]>> = {};

  notifications.forEach((plan, index) => {
    const recipient = uniqueRecipients[index];
    const channels = plan.routing.channels;

    if (channels.includes('pwa')) {
      pushRecipientIds.push(recipient.uid);
      (recipient.fcmTokens || []).filter(Boolean).forEach((token) => pushTokenSet.add(token));
    }

    if (channels.includes('email')) emailRecipientIds.push(recipient.uid);

    connectorChannels.forEach((provider) => {
      if (!channels.includes(provider)) return;
      const current = connectorRecipientIds[provider] || [];
      current.push(recipient.uid);
      connectorRecipientIds[provider] = current;
    });
  });

  return {
    notifications,
    pushRecipientIds,
    pushTokens: Array.from(pushTokenSet),
    emailRecipientIds,
    connectorRecipientIds,
  };
}
