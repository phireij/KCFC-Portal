import type { UserProfile } from '../src/types';
import type { LiturgicalAssignmentMap } from '../src/lib/liturgicalAssignmentDiff';
import { diffLiturgicalAssignments } from '../src/lib/liturgicalAssignmentDiff';
import {
  buildAssignmentChangeBatchPlan,
  buildAvailabilityCompletionBatchPlan,
  buildAvailabilityRequestBatchPlan,
  buildPublishedAssignmentBatchPlan,
  type LiturgicalCommunicationRecipient,
} from '../src/lib/liturgicalCommunication';

type PrivateMemberProfile = Pick<
  UserProfile,
  | 'uid'
  | 'email'
  | 'roles'
  | 'ministries'
  | 'isVerified'
  | 'isDisabled'
  | 'preferences'
  | 'fcmTokens'
  | 'connectedCommunicationApps'
>;

export type TrustedLiturgicalPollState = {
  id: string;
  title: string;
  createdBy?: string;
  assignments?: LiturgicalAssignmentMap;
  lastPublishedAssignments?: LiturgicalAssignmentMap;
  rosterRevision?: number;
};

export type TrustedLiturgicalCommunicationKind =
  | 'availability_request'
  | 'availability_complete'
  | 'assignment_publish';

const liturgicalMinistries = new Set(['lector_commentator', 'usher', 'altar_server']);

const isActiveMember = (profile: PrivateMemberProfile) =>
  profile.isVerified === true &&
  profile.isDisabled !== true &&
  String(profile.email || '').trim().toLowerCase() !== 'kcfc.jp@gmail.com';

const toRecipient = (profile: PrivateMemberProfile): LiturgicalCommunicationRecipient => ({
  uid: profile.uid,
  preferences: profile.preferences,
  connectedCommunicationApps: profile.connectedCommunicationApps,
  fcmTokens: Array.isArray(profile.fcmTokens) ? profile.fcmTokens : [],
});

const recipientProfilesForIds = (
  profiles: PrivateMemberProfile[],
  ids: Iterable<string>,
) => {
  const wanted = new Set(Array.from(ids).filter(Boolean));
  return profiles
    .filter((profile) => wanted.has(profile.uid) && isActiveMember(profile))
    .map(toRecipient);
};

export const eligibleLiturgicalMemberIds = (profiles: PrivateMemberProfile[]) =>
  profiles
    .filter((profile) =>
      isActiveMember(profile) &&
      (profile.ministries || []).some((ministry) => liturgicalMinistries.has(ministry)),
    )
    .map((profile) => profile.uid)
    .sort();

export const availabilityCompletionRecipientIds = (
  profiles: PrivateMemberProfile[],
  createdBy?: string,
) => {
  const ids = new Set<string>();
  if (createdBy) ids.add(createdBy);
  profiles.forEach((profile) => {
    if (!isActiveMember(profile)) return;
    if ((profile.roles || []).some((role) => ['admin', 'president'].includes(role))) ids.add(profile.uid);
  });
  return Array.from(ids).sort();
};

const assignedIds = (assignments: LiturgicalAssignmentMap = {}) => {
  const ids = new Set<string>();
  Object.values(assignments).forEach((dateAssignments) => {
    Object.keys(dateAssignments || {}).forEach((uid) => {
      if (uid) ids.add(uid);
    });
  });
  return Array.from(ids).sort();
};

export type TrustedLiturgicalCommunicationPlan = {
  mode: 'availability_request' | 'availability_complete' | 'initial' | 'revision' | 'no_change';
  nextRevision?: number;
  affectedUserIds: string[];
  notifications: ReturnType<typeof buildAvailabilityRequestBatchPlan>['notifications'];
  pushRecipientIds: string[];
  pushTokens: string[];
  emailRecipientIds: string[];
  connectorRecipientIds: ReturnType<typeof buildAvailabilityRequestBatchPlan>['connectorRecipientIds'];
};

export function buildTrustedLiturgicalCommunicationPlan({
  kind,
  poll,
  profiles,
}: {
  kind: TrustedLiturgicalCommunicationKind;
  poll: TrustedLiturgicalPollState;
  profiles: PrivateMemberProfile[];
}): TrustedLiturgicalCommunicationPlan {
  if (kind === 'availability_request') {
    const affectedUserIds = eligibleLiturgicalMemberIds(profiles);
    const plan = buildAvailabilityRequestBatchPlan({
      recipients: recipientProfilesForIds(profiles, affectedUserIds),
      pollId: poll.id,
      pollTitle: poll.title,
    });
    return {
      mode: 'availability_request',
      affectedUserIds,
      ...plan,
    };
  }

  if (kind === 'availability_complete') {
    const affectedUserIds = availabilityCompletionRecipientIds(profiles, poll.createdBy);
    const plan = buildAvailabilityCompletionBatchPlan({
      recipients: recipientProfilesForIds(profiles, affectedUserIds),
      pollId: poll.id,
      pollTitle: poll.title,
    });
    return {
      mode: 'availability_complete',
      affectedUserIds,
      ...plan,
    };
  }

  const current = poll.assignments || {};
  const previous = poll.lastPublishedAssignments;
  if (!previous) {
    const affectedUserIds = assignedIds(current);
    const plan = buildPublishedAssignmentBatchPlan({
      recipients: recipientProfilesForIds(profiles, affectedUserIds),
      pollId: poll.id,
      pollTitle: poll.title,
    });
    return {
      mode: 'initial',
      nextRevision: Math.max(1, poll.rosterRevision || 0),
      affectedUserIds,
      ...plan,
    };
  }

  const diff = diffLiturgicalAssignments(previous, current);
  const currentRevision = Math.max(1, poll.rosterRevision || 1);
  if (diff.affectedUserIds.length === 0) {
    const plan = buildAssignmentChangeBatchPlan({
      recipients: [],
      pollId: poll.id,
      pollTitle: poll.title,
    });
    return {
      mode: 'no_change',
      nextRevision: currentRevision,
      affectedUserIds: [],
      ...plan,
    };
  }

  const affectedUserIds = [...diff.affectedUserIds].sort();
  const plan = buildAssignmentChangeBatchPlan({
    recipients: recipientProfilesForIds(profiles, affectedUserIds),
    pollId: poll.id,
    pollTitle: poll.title,
  });
  return {
    mode: 'revision',
    nextRevision: currentRevision + 1,
    affectedUserIds,
    ...plan,
  };
}

export type PublicLiturgicalCommunicationSummary = {
  mode: TrustedLiturgicalCommunicationPlan['mode'];
  nextRevision?: number;
  affectedCount: number;
  notificationCount: number;
  pushRecipientCount: number;
  emailRecipientCount: number;
  connectorRecipientCounts: Record<string, number>;
};

export function publicLiturgicalCommunicationSummary(
  plan: TrustedLiturgicalCommunicationPlan,
): PublicLiturgicalCommunicationSummary {
  const connectorRecipientCounts = Object.fromEntries(
    Object.entries(plan.connectorRecipientIds).map(([provider, ids]) => [provider, ids?.length || 0]),
  );
  return {
    mode: plan.mode,
    ...(plan.nextRevision !== undefined ? { nextRevision: plan.nextRevision } : {}),
    affectedCount: plan.affectedUserIds.length,
    notificationCount: plan.notifications.length,
    pushRecipientCount: plan.pushRecipientIds.length,
    emailRecipientCount: plan.emailRecipientIds.length,
    connectorRecipientCounts,
  };
}
