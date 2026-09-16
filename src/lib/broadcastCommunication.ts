import type { ConnectedCommunicationApp, NotificationPreferences, NotificationUrgency } from '../types';
import { buildCommunicationBatchPlan, type CommunicationBatchRecipient } from './communicationBatch';
import { buildCommunicationRoutingPlan } from './communicationRouting';
import { buildNotificationRecord } from './notificationRecord';

const connectedProvidersFor = (apps?: ConnectedCommunicationApp[]) =>
  (apps || [])
    .filter((app) => app.status === 'connected')
    .map((app) => app.provider);

export function buildBroadcastNotification(input: {
  userId: string;
  broadcastId?: string;
  title: string;
  message: string;
  link?: string;
  preferences?: NotificationPreferences;
  connectedCommunicationApps?: ConnectedCommunicationApp[];
  allowPwa?: boolean;
  allowEmail?: boolean;
  urgent?: boolean;
}) {
  const kind = input.urgent ? 'urgent_notice' : 'broadcast';
  const routing = buildCommunicationRoutingPlan({
    kind,
    preferences: input.preferences,
    connectedProviders: connectedProvidersFor(input.connectedCommunicationApps),
    allowPwa: input.allowPwa ?? true,
    allowEmail: input.allowEmail ?? true,
    allowExternalConnectors: false,
  });

  const urgency: NotificationUrgency = input.urgent ? 'urgent' : routing.urgency;

  return {
    routing: { ...routing, urgency },
    record: buildNotificationRecord({
      userId: input.userId,
      title: input.title,
      message: input.message,
      type: 'broadcast',
      link: input.link,
      sourceId: input.broadcastId,
      sourceType: 'broadcast',
      urgency,
      channels: routing.channels,
      extra: { routingRationale: routing.rationale },
    }),
  };
}

export function buildBroadcastBatchPlan({
  recipients,
  broadcastId,
  title,
  message,
  link,
  allowPwa = true,
  allowEmail = true,
  urgent = false,
}: {
  recipients: CommunicationBatchRecipient[];
  broadcastId?: string;
  title: string;
  message: string;
  link?: string;
  allowPwa?: boolean;
  allowEmail?: boolean;
  urgent?: boolean;
}) {
  return buildCommunicationBatchPlan(recipients, (recipient) => buildBroadcastNotification({
    userId: recipient.uid,
    broadcastId,
    title,
    message,
    link,
    preferences: recipient.preferences,
    connectedCommunicationApps: recipient.connectedCommunicationApps,
    allowPwa,
    allowEmail,
    urgent,
  }));
}
