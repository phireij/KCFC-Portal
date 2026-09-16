import type { UserProfile } from '../types';
import type { LiturgicalAssignmentMap } from './liturgicalAssignmentDiff';
import { diffLiturgicalAssignments } from './liturgicalAssignmentDiff';
import {
  buildAssignmentChangeCreatorPlan,
  buildPublishedRosterCreatorPlan,
} from './liturgicalCreatorPlan';

export type LiturgicalPublicationState = {
  assignments?: LiturgicalAssignmentMap;
  lastPublishedAssignments?: LiturgicalAssignmentMap;
  rosterRevision?: number;
};

export type LiturgicalPublicationPlan = {
  mode: 'initial' | 'revision' | 'no_change';
  nextRevision: number;
  affectedUserIds: string[];
  communicationPlan: ReturnType<typeof buildPublishedRosterCreatorPlan> | ReturnType<typeof buildAssignmentChangeCreatorPlan>;
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

/**
 * Plans a deliberate roster publication without performing I/O.
 *
 * First publication notifies all currently assigned members. A later publication
 * compares the last published snapshot with the new draft and targets only members
 * whose assignment set changed, including members removed from the roster.
 */
export function buildLiturgicalPublicationPlan({
  members,
  pollId,
  pollTitle,
  state,
}: {
  members: UserProfile[];
  pollId: string;
  pollTitle: string;
  state: LiturgicalPublicationState;
}): LiturgicalPublicationPlan {
  const current = state.assignments || {};
  const previous = state.lastPublishedAssignments;

  if (!previous) {
    const affectedUserIds = assignedIds(current);
    return {
      mode: 'initial',
      nextRevision: Math.max(1, state.rosterRevision || 0),
      affectedUserIds,
      communicationPlan: buildPublishedRosterCreatorPlan({
        members,
        assignedUserIds: affectedUserIds,
        pollId,
        pollTitle,
      }),
    };
  }

  const diff = diffLiturgicalAssignments(previous, current);
  const currentRevision = Math.max(1, state.rosterRevision || 1);
  if (diff.affectedUserIds.length === 0) {
    return {
      mode: 'no_change',
      nextRevision: currentRevision,
      affectedUserIds: [],
      communicationPlan: buildAssignmentChangeCreatorPlan({
        members,
        affectedUserIds: [],
        pollId,
        pollTitle,
      }),
    };
  }

  return {
    mode: 'revision',
    nextRevision: currentRevision + 1,
    affectedUserIds: diff.affectedUserIds,
    communicationPlan: buildAssignmentChangeCreatorPlan({
      members,
      affectedUserIds: diff.affectedUserIds,
      pollId,
      pollTitle,
    }),
  };
}
