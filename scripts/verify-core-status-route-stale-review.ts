import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { registerCoreStatusTransitionRoutes } from '../server/coreStatusTransitionRoutes';

type SyntheticMember = {
  uid: string;
  email: string;
  displayName: string;
  isVerified: boolean;
  isDisabled?: boolean;
  isCoreMember: boolean;
  roles: string[];
  ministries: string[];
  updatedAt: string;
};

const actor = {
  uid: 'synthetic-admin-1',
  email: 'synthetic-admin@example.invalid',
  displayName: 'Synthetic Admin',
  isVerified: true,
  isCoreMember: true,
  roles: ['member', 'admin'],
  ministries: [],
  updatedAt: '2026-09-17T00:00:00.000Z',
} satisfies SyntheticMember;

const target = {
  uid: 'synthetic-member-1',
  email: 'synthetic-member@example.invalid',
  displayName: 'Synthetic Member',
  isVerified: true,
  isCoreMember: false,
  roles: ['member'],
  ministries: ['choir_a'],
  updatedAt: '2026-09-17T00:05:00.000Z',
} satisfies SyntheticMember;

function syntheticDependencies(executorEnabled: boolean, transactionTarget?: SyntheticMember) {
  let authVerifyCalls = 0;
  let actorReads = 0;
  let targetReads = 0;
  let transactionCalls = 0;
  let transactionReads = 0;
  let mutationCalls = 0;

  const auth = {
    async verifyIdToken(token: string) {
      authVerifyCalls += 1;
      assert.equal(token, 'synthetic-route-test-token');
      return { uid: actor.uid };
    },
  };

  const db = {
    collection(name: string) {
      assert.equal(name, 'users');
      return {
        doc(uid: string) {
          return {
            async get() {
              if (uid === actor.uid) {
                actorReads += 1;
                return { exists: true, id: actor.uid, data: () => structuredClone(actor) };
              }
              if (uid === target.uid) {
                targetReads += 1;
                return { exists: true, id: target.uid, data: () => structuredClone(target) };
              }
              return { exists: false, id: uid, data: () => undefined };
            },
          };
        },
      };
    },
    async runTransaction(work: (transaction: unknown) => Promise<unknown>) {
      transactionCalls += 1;
      assert.ok(transactionTarget, 'A route-level stale review must reject before the transaction.');
      return work({
        async get() {
          transactionReads += 1;
          return { exists: true, id: target.uid, data: () => structuredClone(transactionTarget) };
        },
        update() { mutationCalls += 1; throw new Error('Unexpected member write'); },
        set() { mutationCalls += 1; throw new Error('Unexpected directory write'); },
        delete() { mutationCalls += 1; throw new Error('Unexpected directory deletion'); },
        create() { mutationCalls += 1; throw new Error('Unexpected audit append'); },
      });
    },
  };

  return {
    dependencies: {
      auth,
      db,
      runtimeEnvironment: 'staging',
      executorEnabled,
    },
    counters: {
      authVerifyCalls: () => authVerifyCalls,
      actorReads: () => actorReads,
      targetReads: () => targetReads,
      transactionCalls: () => transactionCalls,
      transactionReads: () => transactionReads,
      mutationCalls: () => mutationCalls,
    },
  };
}

async function withServer(
  executorEnabled: boolean,
  run: (baseUrl: string, counters: ReturnType<typeof syntheticDependencies>['counters']) => Promise<void>,
  transactionTarget?: SyntheticMember,
) {
  const app = express();
  app.use(express.json());
  const { dependencies, counters } = syntheticDependencies(executorEnabled, transactionTarget);
  registerCoreStatusTransitionRoutes(app, dependencies as never);

  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    const address = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${address.port}`, counters);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

await withServer(false, async (baseUrl, counters) => {
  const response = await fetch(`${baseUrl}/api/admin/core-status/transition`, {
    method: 'POST',
    headers: {
      authorization: 'Bearer synthetic-route-test-token',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      targetUserId: target.uid,
      toCore: true,
      expectedUpdatedAt: '2026-09-16T23:59:00.000Z',
      reason: 'Synthetic disabled-executor route verification.',
    }),
  });
  const payload = await response.json() as { error?: string };

  assert.equal(response.status, 503);
  assert.equal(payload.error, 'Core Member status changes are not enabled for this staging deployment.');
  assert.equal(counters.authVerifyCalls(), 0, 'Disabled executor must reject before Firebase Auth verification.');
  assert.equal(counters.actorReads(), 0, 'Disabled executor must reject before actor profile reads.');
  assert.equal(counters.targetReads(), 0, 'Disabled executor must reject before target profile reads.');
  assert.equal(counters.transactionCalls(), 0, 'Disabled executor must never begin a Firestore transaction.');
});

await withServer(true, async (baseUrl, counters) => {
  const response = await fetch(`${baseUrl}/api/admin/core-status/transition`, {
    method: 'POST',
    headers: {
      authorization: 'Bearer synthetic-route-test-token',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      targetUserId: target.uid,
      toCore: true,
      expectedUpdatedAt: '2026-09-17T00:04:00.000Z',
      reason: 'Synthetic stale-review route verification.',
    }),
  });
  const payload = await response.json() as { error?: string };

  assert.equal(response.status, 409, 'A stale reviewed revision must receive HTTP 409.');
  assert.equal(
    payload.error,
    'This member changed after the status review. Refresh the member and review the transition again.',
  );
  assert.equal(counters.authVerifyCalls(), 1, 'Enabled stale-route test must verify the synthetic actor once.');
  assert.equal(counters.actorReads(), 1, 'Enabled stale-route test must read the synthetic actor once.');
  assert.equal(counters.targetReads(), 1, 'Enabled stale-route test must read the current synthetic target once.');
  assert.equal(
    counters.transactionCalls(),
    0,
    'Route-level stale revision rejection must happen before any Firestore transaction or mutation boundary.',
  );
});

// Real route -> Firestore adapter -> executor; only Auth/Firestore are synthetic.
// Each reread differs from the earlier route read. No Firebase calls occur.
for (const [name, changed] of Object.entries({
  updatedAt: { ...target, updatedAt: '2026-09-17T00:06:00.000Z' },
  roles: { ...target, roles: ['member', 'secretary'] },
  ministries: { ...target, ministries: ['choir_b'] },
  coreStatus: { ...target, isCoreMember: true },
})) {
  const before = structuredClone(changed);
  await withServer(true, async (baseUrl, counters) => {
    const response = await fetch(`${baseUrl}/api/admin/core-status/transition`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer synthetic-route-test-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        targetUserId: target.uid,
        toCore: true,
        expectedUpdatedAt: target.updatedAt,
        reason: 'Synthetic transaction-reread race verification.',
      }),
    });
    assert.equal(response.status, 409, `${name}: transaction-reread race must return HTTP 409.`);
    assert.deepEqual(await response.json(), {
      error: 'This member changed after the status review. Refresh the member and review the transition again.',
    }, 'Only the stable sanitized stale-review error may reach the client.');
    assert.equal(counters.authVerifyCalls(), 1);
    assert.equal(counters.actorReads(), 1);
    assert.equal(counters.targetReads(), 1);
    assert.equal(counters.transactionCalls(), 1);
    assert.equal(counters.transactionReads(), 1);
    assert.equal(counters.mutationCalls(), 0, 'No member/directory/audit write may be attempted.');
    assert.deepEqual(changed, before, 'The synthetic current snapshot must remain unchanged.');
    console.log(`${name}: HTTP409, exact sanitized response, zero writes: PASS`);
  }, changed);
}

console.log('Core-status route disabled503, pre-transaction stale409 and four transaction-race409 cases: PASS');
