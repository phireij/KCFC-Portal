import type { UserProfile } from '../types';
import { buildCommunicationBatchPlan, type CommunicationBatchRecipient } from './communicationBatch';
import { buildBroadcastNotification } from './broadcastCommunication';

function personalize(template: string, profile: UserProfile) {
  const displayName = profile.displayName || 'Member';
  const nickname = profile.nickname || displayName;
  return template
    .replace(/\[name\]/gi, displayName)
    .replace(/\{name\}/gi, displayName)
    .replace(/\[nickname\]/gi, nickname)
    .replace(/\{nickname\}/gi, nickname);
}

export type LeadershipBroadcastCreatorPlanInput = {
  recipients: UserProfile[];
  broadcastId?: string;
  title: string;
  message: string;
  allowPwa?: boolean;
  allowEmail?: boolean;
  urgent?: boolean;
};

/**
 * A PWA request must be dispatched whenever routing selected at least one member,
 * even if there are no FCM tokens. iOS/Home-Screen members may be reachable only
 * through native Web Push subscriptions, which the server resolves by user ID.
 */
export function shouldDispatchPwaForPlan(plan: { pushRecipientIds: string[] }) {
  return plan.pushRecipientIds.length > 0;
}

/**
 * Creates a transport-neutral broadcast plan for the leadership composer.
 *
 * Safety/compatibility rules:
 * - disabled profiles are excluded;
 * - duplicate UIDs/tokens are collapsed by the shared batch planner;
 * - every included recipient receives a durable Inbox plan when the plan is persisted;
 * - PWA and email recipient sets are governed independently by member preferences;
 * - callers may use the email recipient IDs only as an execution filter without
 *   persisting the generated Inbox records (used by the existing Gmail path);
 * - external connectors remain disabled by buildBroadcastNotification.
 */
export function buildLeadershipBroadcastCreatorPlan({
  recipients,
  broadcastId,
  title,
  message,
  allowPwa = true,
  allowEmail = false,
  urgent = false,
}: LeadershipBroadcastCreatorPlanInput) {
  const profilesByUid = new Map<string, UserProfile>();
  recipients.forEach((profile) => {
    if (!profile.uid || profile.isDisabled) return;
    profilesByUid.set(profile.uid, profile);
  });

  const communicationRecipients: CommunicationBatchRecipient[] = Array.from(profilesByUid.values()).map((profile) => ({
    uid: profile.uid,
    preferences: profile.preferences,
    connectedCommunicationApps: profile.connectedCommunicationApps,
    fcmTokens: profile.fcmTokens || [],
  }));

  return buildCommunicationBatchPlan(communicationRecipients, (recipient) => {
    const profile = profilesByUid.get(recipient.uid)!;
    return buildBroadcastNotification({
      userId: recipient.uid,
      broadcastId,
      title: `Broadcast: ${title}`,
      message: personalize(message, profile),
      link: '/inbox',
      preferences: recipient.preferences,
      connectedCommunicationApps: recipient.connectedCommunicationApps,
      allowPwa,
      allowEmail,
      urgent,
    });
  });
}
