import type { UserProfile } from '../types';
import type { CommunicationBatchRecipient } from './communicationBatch';

export function toCommunicationRecipient(profile: UserProfile): CommunicationBatchRecipient {
  return {
    uid: profile.uid,
    preferences: profile.preferences,
    connectedCommunicationApps: profile.connectedCommunicationApps,
    fcmTokens: profile.fcmTokens || [],
  };
}

export function recipientsForUserIds(
  profiles: UserProfile[],
  userIds: Iterable<string>,
): CommunicationBatchRecipient[] {
  const wanted = new Set(Array.from(userIds).filter(Boolean));
  return profiles
    .filter((profile) => wanted.has(profile.uid) && !profile.isDisabled)
    .map(toCommunicationRecipient);
}

export function leadershipCommunicationRecipients(
  profiles: UserProfile[],
  extraUserIds: Iterable<string> = [],
): CommunicationBatchRecipient[] {
  const recipientIds = new Set(Array.from(extraUserIds).filter(Boolean));
  profiles.forEach((profile) => {
    if (profile.isDisabled) return;
    if ((profile.roles || []).some((role) => ['admin', 'president'].includes(role))) {
      recipientIds.add(profile.uid);
    }
  });
  return recipientsForUserIds(profiles, recipientIds);
}
