import type { MinistryType, UserProfile, UserRole } from '../types';
import { planCoreStatusTransition } from './memberGovernance';

export type CoreStatusProfileSnapshot = {
  isCoreMember: boolean;
  roles: UserRole[];
  ministries: MinistryType[];
};

export type CoreStatusMutationPlan = {
  targetUid: string;
  actorUid: string;
  reason: string;
  from: CoreStatusProfileSnapshot;
  to: CoreStatusProfileSnapshot;
  update: CoreStatusProfileSnapshot;
  requiresCleanup: boolean;
  removedRoles: UserRole[];
  removedMinistries: MinistryType[];
  precondition: {
    expectedUpdatedAt: string | null;
  };
  audit: {
    action: 'core_status_change';
    targetUid: string;
    actorUid: string;
    reason: string;
    fromCore: boolean;
    toCore: boolean;
    before: CoreStatusProfileSnapshot;
    after: CoreStatusProfileSnapshot;
  };
};

function normalizeUpdatedAt(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null) {
    const candidate = value as { toDate?: () => Date; seconds?: number; nanoseconds?: number };
    if (typeof candidate.toDate === 'function') return candidate.toDate().toISOString();
    if (typeof candidate.seconds === 'number') {
      const milliseconds = (candidate.seconds * 1000) + Math.floor((candidate.nanoseconds || 0) / 1_000_000);
      return new Date(milliseconds).toISOString();
    }
  }
  return null;
}

function snapshot(member: UserProfile): CoreStatusProfileSnapshot {
  return {
    isCoreMember: Boolean(member.isCoreMember),
    roles: Array.from(new Set<UserRole>(member.roles || ['member'])),
    ministries: Array.from(new Set<MinistryType>(member.ministries || [])),
  };
}

export function buildCoreStatusMutationPlan(input: {
  member: UserProfile;
  toCore: boolean;
  actorUid: string;
  reason: string;
}): CoreStatusMutationPlan {
  const actorUid = input.actorUid.trim();
  const reason = input.reason.trim();
  if (!actorUid) throw new Error('Core-status mutation planning requires an authenticated actor UID.');
  if (!reason) throw new Error('Core-status mutation planning requires a review reason.');

  const transition = planCoreStatusTransition(input.member, input.toCore);
  const before = snapshot(input.member);
  const after: CoreStatusProfileSnapshot = {
    isCoreMember: input.toCore,
    roles: transition.preservedRoles,
    ministries: transition.preservedMinistries,
  };

  return {
    targetUid: input.member.uid,
    actorUid,
    reason,
    from: before,
    to: after,
    update: after,
    requiresCleanup: transition.requiresCleanup,
    removedRoles: transition.rolesToRemove,
    removedMinistries: transition.ministriesToRemove,
    precondition: {
      expectedUpdatedAt: normalizeUpdatedAt(input.member.updatedAt),
    },
    audit: {
      action: 'core_status_change',
      targetUid: input.member.uid,
      actorUid,
      reason,
      fromCore: before.isCoreMember,
      toCore: after.isCoreMember,
      before,
      after,
    },
  };
}

export function coreStatusPlanStillMatches(member: UserProfile, plan: CoreStatusMutationPlan): boolean {
  if (member.uid !== plan.targetUid) return false;
  const current = snapshot(member);
  const expected = plan.from;
  return current.isCoreMember === expected.isCoreMember
    && current.roles.slice().sort().join('|') === expected.roles.slice().sort().join('|')
    && current.ministries.slice().sort().join('|') === expected.ministries.slice().sort().join('|')
    && normalizeUpdatedAt(member.updatedAt) === plan.precondition.expectedUpdatedAt;
}
