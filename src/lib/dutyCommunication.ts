import type { ConnectedCommunicationApp, NotificationPreferences } from '../types';
import { buildCommunicationRoutingPlan } from './communicationRouting';
import { buildNotificationRecord } from './notificationRecord';

const connectedProvidersFor = (apps?: ConnectedCommunicationApp[]) =>
  (apps || [])
    .filter((app) => app.status === 'connected')
    .map((app) => app.provider);

export function buildDutyAssignmentNotification(input: {
  userId: string;
  dutyId?: string;
  title: string;
  message: string;
  link?: string;
  preferences?: NotificationPreferences;
  connectedCommunicationApps?: ConnectedCommunicationApp[];
  allowPwa?: boolean;
  allowEmail?: boolean;
}) {
  const routing = buildCommunicationRoutingPlan({
    kind: 'duty',
    preferences: input.preferences,
    connectedProviders: connectedProvidersFor(input.connectedCommunicationApps),
    allowPwa: input.allowPwa ?? true,
    allowEmail: input.allowEmail ?? true,
    allowExternalConnectors: false,
  });

  return {
    routing,
    record: buildNotificationRecord({
      userId: input.userId,
      title: input.title,
      message: input.message,
      type: 'duty',
      link: input.link,
      sourceId: input.dutyId,
      sourceType: 'duty',
      urgency: routing.urgency,
      channels: routing.channels,
      extra: { routingRationale: routing.rationale },
    }),
  };
}
