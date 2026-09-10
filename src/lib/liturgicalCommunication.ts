import type {
  ConnectedCommunicationApp,
  NotificationPreferences,
} from '../types';
import {
  buildCommunicationBatchPlan,
  type CommunicationBatchRecipient,
} from './communicationBatch';
import { buildCommunicationRoutingPlan } from './communicationRouting';
import { buildNotificationRecord } from './notificationRecord';

const connectedProvidersFor = (apps?: ConnectedCommunicationApp[]) =>
  (apps || [])
    .filter((app) => app.status === 'connected')
    .map((app) => app.provider);

type SharedInput = {
  userId: string;
  pollId: string;
  preferences?: NotificationPreferences;
  connectedCommunicationApps?: ConnectedCommunicationApp[];
  allowPwa?: boolean;
  allowEmail?: boolean;
};

export type LiturgicalCommunicationRecipient = CommunicationBatchRecipient;

export function buildAvailabilityRequestNotification(
  input: SharedInput & { pollTitle: string },
) {
  const routing = buildCommunicationRoutingPlan({
    kind: 'availability',
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
      title: 'New liturgical availability request',
      message: `${input.pollTitle}: please select every Mass where you are available to serve.`,
      type: 'system',
      link: `/polls?id=${input.pollId}`,
      sourceId: input.pollId,
      sourceType: 'availability',
      urgency: routing.urgency,
      channels: routing.channels,
      extra: { routingRationale: routing.rationale },
    }),
  };
}

export function buildAvailabilityCompletionNotification(
  input: SharedInput & { pollTitle: string },
) {
  const routing = buildCommunicationRoutingPlan({
    kind: 'availability',
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
      title: 'Liturgical availability complete',
      message: `All eligible ministry members have responded to “${input.pollTitle}”. You can close the request and begin assignment planning.`,
      type: 'system',
      link: `/polls?id=${input.pollId}&leader=1`,
      sourceId: input.pollId,
      sourceType: 'availability',
      urgency: routing.urgency,
      channels: routing.channels,
      extra: { routingRationale: routing.rationale },
    }),
  };
}

export function buildPublishedAssignmentNotification(
  input: SharedInput & { pollTitle: string },
) {
  const routing = buildCommunicationRoutingPlan({
    kind: 'assignment',
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
      title: 'Your liturgical schedule is ready',
      message: `The final roster for “${input.pollTitle}” has been published. Please review your assignments.`,
      type: 'system',
      link: '/duties?view=mine',
      sourceId: input.pollId,
      sourceType: 'assignment',
      urgency: routing.urgency,
      channels: routing.channels,
      extra: { routingRationale: routing.rationale },
    }),
  };
}

export function buildAssignmentChangeNotification(
  input: SharedInput & { pollTitle: string },
) {
  const routing = buildCommunicationRoutingPlan({
    kind: 'assignment_change',
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
      title: 'Your liturgical schedule was updated',
      message: `The published roster for “${input.pollTitle}” has changed. Please review your current assignments.`,
      type: 'system',
      link: '/duties?view=mine',
      sourceId: input.pollId,
      sourceType: 'assignment',
      urgency: routing.urgency,
      channels: routing.channels,
      extra: {
        routingRationale: routing.rationale,
        eventKind: 'assignment_change',
      },
    }),
  };
}

export function buildAvailabilityRequestBatchPlan({
  recipients,
  pollId,
  pollTitle,
  allowPwa = true,
  allowEmail = true,
}: {
  recipients: LiturgicalCommunicationRecipient[];
  pollId: string;
  pollTitle: string;
  allowPwa?: boolean;
  allowEmail?: boolean;
}) {
  return buildCommunicationBatchPlan(recipients, (recipient) => buildAvailabilityRequestNotification({
    userId: recipient.uid,
    pollId,
    pollTitle,
    preferences: recipient.preferences,
    connectedCommunicationApps: recipient.connectedCommunicationApps,
    allowPwa,
    allowEmail,
  }));
}

export function buildAvailabilityCompletionBatchPlan({
  recipients,
  pollId,
  pollTitle,
  allowPwa = true,
  allowEmail = true,
}: {
  recipients: LiturgicalCommunicationRecipient[];
  pollId: string;
  pollTitle: string;
  allowPwa?: boolean;
  allowEmail?: boolean;
}) {
  return buildCommunicationBatchPlan(recipients, (recipient) => buildAvailabilityCompletionNotification({
    userId: recipient.uid,
    pollId,
    pollTitle,
    preferences: recipient.preferences,
    connectedCommunicationApps: recipient.connectedCommunicationApps,
    allowPwa,
    allowEmail,
  }));
}

export function buildPublishedAssignmentBatchPlan({
  recipients,
  pollId,
  pollTitle,
  allowPwa = true,
  allowEmail = true,
}: {
  recipients: LiturgicalCommunicationRecipient[];
  pollId: string;
  pollTitle: string;
  allowPwa?: boolean;
  allowEmail?: boolean;
}) {
  return buildCommunicationBatchPlan(recipients, (recipient) => buildPublishedAssignmentNotification({
    userId: recipient.uid,
    pollId,
    pollTitle,
    preferences: recipient.preferences,
    connectedCommunicationApps: recipient.connectedCommunicationApps,
    allowPwa,
    allowEmail,
  }));
}

export function buildAssignmentChangeBatchPlan({
  recipients,
  pollId,
  pollTitle,
  allowPwa = true,
  allowEmail = true,
}: {
  recipients: LiturgicalCommunicationRecipient[];
  pollId: string;
  pollTitle: string;
  allowPwa?: boolean;
  allowEmail?: boolean;
}) {
  return buildCommunicationBatchPlan(recipients, (recipient) => buildAssignmentChangeNotification({
    userId: recipient.uid,
    pollId,
    pollTitle,
    preferences: recipient.preferences,
    connectedCommunicationApps: recipient.connectedCommunicationApps,
    allowPwa,
    allowEmail,
  }));
}
