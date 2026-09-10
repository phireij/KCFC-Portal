import type { UserProfile, UserRole } from '../src/types';
import {
  coreStatusPlanStillMatches,
  type CoreStatusMutationPlan,
  type CoreStatusProfileSnapshot,
} from '../src/lib/coreStatusMutationPlan';

export type CoreStatusExecutionEnvironment = 'development' | 'staging' | 'production';

export type CoreStatusExecutionContext = {
  environment: CoreStatusExecutionEnvironment;
  executorEnabled: boolean;
  actorUid: string;
  actorRoles: UserRole[];
  now: () => string;
};

export type CoreStatusAuditRecord = {
  eventId: string;
  action: 'core_status_change';
  source: 'staging_core_status_executor';
  targetUid: string;
  actorUid: string;
  reason: string;
  before: CoreStatusProfileSnapshot;
  after: CoreStatusProfileSnapshot;
  expectedUpdatedAt: string | null;
  committedAt: string;
};

export type CoreStatusTransaction = {
  getMember(uid: string): Promise<UserProfile | null>;
  updateMember(uid: string, update: CoreStatusProfileSnapshot & { updatedAt: string }): Promise<void>;
  appendAudit(record: CoreStatusAuditRecord): Promise<void>;
};

export type CoreStatusTransactionAdapter = {
  runTransaction<T>(work: (transaction: CoreStatusTransaction) => Promise<T>): Promise<T>;
};

export type CoreStatusExecutionResult = {
  targetUid: string;
  actorUid: string;
  committedAt: string;
  auditEventId: string;
};

function assertExecutionAllowed(context: CoreStatusExecutionContext, plan: CoreStatusMutationPlan) {
  if (context.environment !== 'staging') {
    throw new Error('Core-status executor is hard-blocked outside staging.');
  }
  if (!context.executorEnabled) {
    throw new Error('Core-status staging executor feature gate is disabled.');
  }

  const actorUid = context.actorUid.trim();
  if (!actorUid || actorUid !== plan.actorUid) {
    throw new Error('Core-status executor actor does not match the reviewed mutation plan.');
  }

  const authorized = context.actorRoles.some((role) => role === 'admin' || role === 'president');
  if (!authorized) {
    throw new Error('Core-status executor requires an authorized KCFC administrator or President.');
  }

  if (plan.from.isCoreMember === plan.to.isCoreMember) {
    throw new Error('Core-status executor refuses no-op mutation plans.');
  }
}

export async function executeCoreStatusTransitionInStaging(input: {
  plan: CoreStatusMutationPlan;
  context: CoreStatusExecutionContext;
  adapter: CoreStatusTransactionAdapter;
}): Promise<CoreStatusExecutionResult> {
  const { plan, context, adapter } = input;
  assertExecutionAllowed(context, plan);

  return adapter.runTransaction(async (transaction) => {
    const current = await transaction.getMember(plan.targetUid);
    if (!current) throw new Error('Core-status target member does not exist.');
    if (!coreStatusPlanStillMatches(current, plan)) {
      throw new Error('Core-status mutation plan is stale; refresh the member and review the transition again.');
    }

    const committedAt = context.now();
    if (!committedAt) throw new Error('Core-status executor requires a commit timestamp.');

    const auditEventId = `core-status:${plan.targetUid}:${committedAt}`;
    await transaction.updateMember(plan.targetUid, {
      ...plan.update,
      updatedAt: committedAt,
    });
    await transaction.appendAudit({
      eventId: auditEventId,
      action: 'core_status_change',
      source: 'staging_core_status_executor',
      targetUid: plan.targetUid,
      actorUid: plan.actorUid,
      reason: plan.reason,
      before: plan.from,
      after: plan.to,
      expectedUpdatedAt: plan.precondition.expectedUpdatedAt,
      committedAt,
    });

    return {
      targetUid: plan.targetUid,
      actorUid: plan.actorUid,
      committedAt,
      auditEventId,
    };
  });
}
