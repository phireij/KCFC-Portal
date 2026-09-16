import type { Poll, UserProfile } from '../src/types';

const bootstrapEmail = 'kcfc.jp@gmail.com';
const committeeLeaderRoles = new Set([
  'lector_commentator_leader',
  'usher_leader',
  'altar_server_leader',
]);
const committeeMinistries = new Set([
  'lector_commentator',
  'usher',
  'altar_server',
  'ppt',
]);
const completionRoles = new Set(['admin', 'president']);

const normalizedEmail = (profile: UserProfile) => String(profile.email || '').trim().toLowerCase();

export const isActiveApprovedProfile = (profile: UserProfile) =>
  profile.isVerified === true
  && profile.isDisabled !== true
  && normalizedEmail(profile) !== bootstrapEmail;

export const legacyPollAudienceIds = (
  poll: Poll,
  profiles: UserProfile[],
) => profiles
  .filter(isActiveApprovedProfile)
  .filter((profile) => {
    if (poll.category === 'core_member') return profile.isCoreMember === true;
    if (poll.category === 'committee') {
      return (profile.roles || []).some((role) => committeeLeaderRoles.has(role))
        || (profile.ministries || []).some((ministry) => committeeMinistries.has(ministry));
    }
    return true;
  })
  .map((profile) => profile.uid)
  .filter((uid): uid is string => typeof uid === 'string' && Boolean(uid));

export const legacyPollCompletionEligibleIds = (
  poll: Poll,
  profiles: UserProfile[],
) => profiles
  .filter(isActiveApprovedProfile)
  .filter((profile) => {
    if (poll.category === 'core_member') return profile.isCoreMember === true;
    if (poll.category === 'committee') {
      return (profile.ministries || []).some((ministry) => committeeMinistries.has(ministry));
    }
    return true;
  })
  .map((profile) => profile.uid)
  .filter((uid): uid is string => typeof uid === 'string' && Boolean(uid));

export const legacyPollLeadershipRecipientIds = (
  poll: Poll,
  profiles: UserProfile[],
) => {
  const recipients = new Set<string>();
  if (poll.createdBy) recipients.add(poll.createdBy);
  profiles.forEach((profile) => {
    if (!profile.uid) return;
    if ((profile.roles || []).some((role) => completionRoles.has(role))) {
      recipients.add(profile.uid);
    }
  });
  return [...recipients];
};

export type PublicLegacyPollCommunicationSummary = {
  notificationCount: number;
  alreadyNotified?: boolean;
  complete?: boolean;
  remainingCount?: number;
};
