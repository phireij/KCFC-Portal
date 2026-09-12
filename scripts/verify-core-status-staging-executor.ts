import assert from 'node:assert/strict';
import type { UserProfile } from '../src/types';
import { buildCoreStatusMutationPlan } from '../src/lib/coreStatusMutationPlan';
import {
  executeCoreStatusTransitionInStaging,
  type CoreStatusAuditRecord,
  type CoreStatusTransactionAdapter,
} from '../server/coreStatusStagingExecutor';

function member(updatedAt = '2026-09-10T12:00:00.000Z'): UserProfile {
  return {
    uid: 'member-1',
    email: 'member@example.com',
    displayName: 'Staging Member',
    isVerified: true,
    isCoreMember: true,
    roles: ['member', 'treasurer'],
    ministries: ['lector_commentator', 'kitchen'],
    updatedAt,
  } as UserProfile;
}

function adapterFor(initial: UserProfile) {
  let stored = structuredClone(initial);
  const audits: CoreStatusAuditRecord[] = [];
  const adapter: CoreStatusTransactionAdapter = {
    async runTransaction(work) {
      const working = structuredClone(stored);
      const pendingAudits: CoreStatusAuditRecord[] = [];
      const result = await work({
        async getMember(uid) {
          return working.uid === uid ? structuredClone(working) : null;
        },
        async updateMember(uid, update) {
          assert.equal(uid, working.uid);
          Object.assign(working, update);
        },
        async appendAudit(record) {
          pendingAudits.push(structuredClone(record));
        },
      });
      stored = working;
      audits.push(...pendingAudits);
      return result;
    },
  };
  return { adapter, getStored: () => stored, audits };
}

const source = member();
const plan = buildCoreStatusMutationPlan({
  member: source,
  toCore: false,
  actorUid: 'leader-1',
  reason: 'Staging verification of governed Core-status downgrade.',
});

for (const [label, context] of [
  ['production', { environment: 'production' as const, executorEnabled: true, actorUid: 'leader-1', actorRoles: ['admin' as const] }],
  ['disabled', { environment: 'staging' as const, executorEnabled: false, actorUid: 'leader-1', actorRoles: ['admin' as const] }],
  ['unauthorized', { environment: 'staging' as const, executorEnabled: true, actorUid: 'leader-1', actorRoles: ['member' as const] }],
  ['actor mismatch', { environment: 'staging' as const, executorEnabled: true, actorUid: 'other-leader', actorRoles: ['admin' as const] }],
] as const) {
  const store = adapterFor(source);
  await assert.rejects(
    executeCoreStatusTransitionInStaging({
      plan,
      adapter: store.adapter,
      context: { ...context, now: () => '2026-09-10T13:15:00.000Z' },
    }),
    undefined,
    `${label} execution must be rejected`,
  );
  assert.equal(store.getStored().isCoreMember, true, `${label} rejection must not mutate the member`);
  assert.equal(store.audits.length, 0, `${label} rejection must not append audit evidence`);
}

const staleStore = adapterFor(member('2026-09-10T12:30:00.000Z'));
await assert.rejects(
  executeCoreStatusTransitionInStaging({
    plan,
    adapter: staleStore.adapter,
    context: {
      environment: 'staging',
      executorEnabled: true,
      actorUid: 'leader-1',
      actorRoles: ['president'],
      now: () => '2026-09-10T13:15:00.000Z',
    },
  }),
  /stale/i,
);
assert.equal(staleStore.getStored().isCoreMember, true);
assert.equal(staleStore.audits.length, 0);

const successStore = adapterFor(source);
const result = await executeCoreStatusTransitionInStaging({
  plan,
  adapter: successStore.adapter,
  context: {
    environment: 'staging',
    executorEnabled: true,
    actorUid: 'leader-1',
    actorRoles: ['admin'],
    now: () => '2026-09-10T13:15:00.000Z',
  },
});

assert.equal(result.targetUid, source.uid);
assert.equal(successStore.getStored().isCoreMember, false);
assert.deepEqual(successStore.getStored().roles, ['member']);
assert.deepEqual(successStore.getStored().ministries, ['lector_commentator']);
assert.equal(successStore.audits.length, 1);
assert.equal(successStore.audits[0].actorUid, 'leader-1');
assert.equal(successStore.audits[0].targetUid, source.uid);
assert.equal(successStore.audits[0].source, 'staging_core_status_executor');
assert.deepEqual(successStore.audits[0].before, plan.from);
assert.deepEqual(successStore.audits[0].after, plan.to);

console.log('Staging-only Core status executor guards and atomic adapter contract verified.');
