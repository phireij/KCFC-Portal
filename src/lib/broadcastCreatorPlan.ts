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
  urgent?: boolean;
};

/**
 * Creates a transport-neutral broadcast plan for the leadership composer.
 *
 * Safety/compatibility rules:
 * - disabled profiles are excluded;
 * - duplicate UIDs/tokens are collapsed by the shared batch planner;
 * - every included recipient receives a durable Inbox plan even when the member
 *   has muted broadcast alerts;
 * - PWA delivery is governed per-recipient by communication preferences;
 * - email is deliberately disabled here because BroadcastTool still executes its
 *   existing personalized Gmail path separately;
 * - external connectors remain disabled by buildBroadcastNotification.
 */
export function buildLeadershipBroadcastCreatorPlan({
  recipients,
  broadcastId,
  title,
  message,
  allowPwa = true,
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
      allowEmail: false,
      urgent,
    });
  });
}
