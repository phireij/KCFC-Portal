import type { CommunicationChannel, NotificationPreferences, NotificationUrgency } from '../types';

export type CommunicationEventKind =
  | 'announcement'
  | 'availability'
  | 'assignment'
  | 'assignment_change'
  | 'duty'
  | 'broadcast'
  | 'urgent_notice';

export type CommunicationRoutingInput = {
  kind: CommunicationEventKind;
  preferences?: NotificationPreferences;
  connectedProviders?: Array<'line' | 'telegram' | 'whatsapp' | 'viber'>;
  allowPwa?: boolean;
  allowEmail?: boolean;
  allowExternalConnectors?: boolean;
};

export type CommunicationRoutingPlan = {
  urgency: NotificationUrgency;
  channels: CommunicationChannel[];
  rationale: string[];
};

const preferenceAllows = (kind: CommunicationEventKind, preferences?: NotificationPreferences) => {
  if (!preferences) return true;
  if (kind === 'announcement') return preferences.announcements !== false;
  if (kind === 'availability') return preferences.availability !== false;
  if (kind === 'assignment' || kind === 'assignment_change') return preferences.assignments !== false;
  if (kind === 'duty') return preferences.duties !== false;
  if (kind === 'broadcast') return preferences.broadcasts !== false;
  if (kind === 'urgent_notice') return preferences.urgentNotices !== false;
  return true;
};

const urgencyFor = (kind: CommunicationEventKind): NotificationUrgency => {
  if (kind === 'urgent_notice') return 'urgent';
  if (kind === 'assignment_change') return 'important';
  if (kind === 'assignment') return 'important';
  return 'normal';
};

/**
 * Produces the delivery policy for one recipient without sending anything.
 *
 * Safety rules:
 * - KCFC Inbox is always retained as the durable record for operational communication.
 * - PWA push is the primary alert when the member has not disabled that event class and
 *   the composer/caller has not explicitly disabled PWA for this message.
 * - Email is the default partner when enabled by member preference and the caller allows it.
 * - Optional provider channels are considered only when the caller explicitly allows
 *   external connectors and the member has both opted in and connected that provider.
 * - This helper never sends, reads credentials, or bypasses provider feature flags.
 */
export function buildCommunicationRoutingPlan(input: CommunicationRoutingInput): CommunicationRoutingPlan {
  const {
    kind,
    preferences,
    connectedProviders = [],
    allowPwa = true,
    allowEmail = true,
    allowExternalConnectors = false,
  } = input;
  const channels: CommunicationChannel[] = ['inbox'];
  const rationale = ['KCFC Inbox retained as durable source of truth.'];
  const routineAllowed = preferenceAllows(kind, preferences);

  if (routineAllowed && allowPwa) {
    channels.push('pwa');
    rationale.push('PWA push selected as the primary alert channel.');
  } else if (!routineAllowed) {
    rationale.push('Secondary alert channels suppressed by the member preference; Inbox remains available.');
  } else {
    rationale.push('PWA push disabled for this message by the composer/caller; Inbox remains available.');
  }

  if (routineAllowed && allowEmail && preferences?.emailPartner !== false) {
    channels.push('email');
    rationale.push('Email included as the default partner channel.');
  } else if (!routineAllowed) {
    rationale.push('Email not selected because this event class is muted by the member.');
  } else if (!allowEmail) {
    rationale.push('Email disabled for this message by the composer/caller.');
  } else if (preferences?.emailPartner === false) {
    rationale.push('Email partner channel disabled by the member preference.');
  }

  const optional = preferences?.optionalChannels || {};
  const providers: Array<'line' | 'telegram' | 'whatsapp' | 'viber'> = ['line', 'telegram', 'whatsapp', 'viber'];

  if (!allowExternalConnectors) {
    if (connectedProviders.length > 0 || providers.some((provider) => optional[provider] === true)) {
      rationale.push('External connector delivery is disabled by the current feature gate.');
    }
  } else if (!routineAllowed) {
    rationale.push('External connector delivery suppressed because this event class is muted by the member.');
  } else {
    providers.forEach((provider) => {
      if (optional[provider] !== true) {
        if (connectedProviders.includes(provider)) rationale.push(`${provider} connected but not opted in for alerts.`);
        return;
      }
      if (!connectedProviders.includes(provider)) {
        rationale.push(`${provider} opted in but not currently connected.`);
        return;
      }
      channels.push(provider);
      rationale.push(`${provider} included because the member opted in and the provider is connected.`);
    });
  }

  return {
    urgency: urgencyFor(kind),
    channels: Array.from(new Set(channels)),
    rationale,
  };
}

export function isOperationalEvent(kind: CommunicationEventKind) {
  return ['availability', 'assignment', 'assignment_change', 'duty', 'urgent_notice'].includes(kind);
}
