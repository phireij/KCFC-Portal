import type { UserProfile } from '../types';
import {
  buildAssignmentChangeBatchPlan,
  buildAvailabilityCompletionBatchPlan,
  buildAvailabilityRequestBatchPlan,
  buildPublishedAssignmentBatchPlan,
} from './liturgicalCommunication';
import {
  leadershipCommunicationRecipients,
  recipientsForUserIds,
} from './communicationRecipient';

export function buildAvailabilityRequestCreatorPlan({
  eligibleMembers,
  pollId,
  pollTitle,
}: {
  eligibleMembers: UserProfile[];
  pollId: string;
  pollTitle: string;
}) {
  return buildAvailabilityRequestBatchPlan({
    recipients: eligibleMembers
      .filter((member) => !member.isDisabled)
      .map((member) => ({
        uid: member.uid,
        preferences: member.preferences,
        connectedCommunicationApps: member.connectedCommunicationApps,
        fcmTokens: member.fcmTokens || [],
      })),
    pollId,
    pollTitle,
  });
}

export function buildAvailabilityCompletionCreatorPlan({
  members,
  pollId,
  pollTitle,
  createdBy,
}: {
  members: UserProfile[];
  pollId: string;
  pollTitle: string;
  createdBy?: string;
}) {
  return buildAvailabilityCompletionBatchPlan({
    recipients: leadershipCommunicationRecipients(members, createdBy ? [createdBy] : []),
    pollId,
    pollTitle,
  });
}

export function buildPublishedRosterCreatorPlan({
  members,
  assignedUserIds,
  pollId,
  pollTitle,
}: {
  members: UserProfile[];
  assignedUserIds: Iterable<string>;
  pollId: string;
  pollTitle: string;
}) {
  return buildPublishedAssignmentBatchPlan({
    recipients: recipientsForUserIds(members, assignedUserIds),
    pollId,
    pollTitle,
  });
}

export function buildAssignmentChangeCreatorPlan({
  members,
  affectedUserIds,
  pollId,
  pollTitle,
}: {
  members: UserProfile[];
  affectedUserIds: Iterable<string>;
  pollId: string;
  pollTitle: string;
}) {
  return buildAssignmentChangeBatchPlan({
    recipients: recipientsForUserIds(members, affectedUserIds),
    pollId,
    pollTitle,
  });
}
