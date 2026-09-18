import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { registerAuthMemberProfileRoutes } from '../server/authMemberProfileRoutes';

const syntheticUid = 'synthetic-new-member-1';
const syntheticEmail = 'synthetic-new-member@example.invalid';
let storedProfile: Record<string, unknown> | null = null;
let transactionCalls = 0;

const auth = {
  async verifyIdToken(token: string) {
    assert.equal(token, 'synthetic-member-profile-token');
    return { uid: syntheticUid, email: syntheticEmail };
  },
  async getUser(uid: string) {
    assert.equal(uid, syntheticUid);
    return {
      uid,
      email: syntheticEmail,
      displayName: 'Synthetic New Member',
      photoURL: null,
      emailVerified: true,
    };
  },
};

const userRef = {
  async get() {
    return { exists: storedProfile !== null, data: () => storedProfile };
  },
};

const db = {
  collection(name: string) {
    assert.equal(name, 'users');
    return {
      doc(uid: string) {
        assert.equal(uid, syntheticUid);
        return userRef;
      },
    };
  },
  async runTransaction(run: (transaction: {
    get: (ref: unknown) => Promise<{ exists: boolean; data: () => Record<string, unknown> | null }>;
    set: (ref: unknown, value: Record<string, unknown>, options: { merge: boolean }) => void;
  }) => Promise<void>) {
    transactionCalls += 1;
    await run({
      async get(ref: unknown) {
        assert.equal(ref, userRef);
        return { exists: storedProfile !== null, data: () => storedProfile };
      },
      set(ref: unknown, value: Record<string, unknown>, options: { merge: boolean }) {
        assert.equal(ref, userRef);
        assert.deepEqual(options, { merge: false });
        storedProfile = value;
      },
    });
  },
};

const app = express();
app.use(express.json());
registerAuthMemberProfileRoutes(app, { auth, db } as never);
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve, reject) => {
  server.once('listening', resolve);
  server.once('error', reject);
});

try {
  const address = server.address() as AddressInfo;
  const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/ensure-member-profile`, {
    method: 'POST',
    headers: {
      authorization: 'Bearer synthetic-member-profile-token',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ displayName: 'Caller supplied fallback' }),
  });
  const payload = await response.json() as { success?: boolean; created?: boolean; reason?: string };
  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.created, true);
  assert.equal(payload.reason, 'created');
  assert.equal(transactionCalls, 1);
  assert.ok(storedProfile);
  assert.equal(storedProfile?.uid, syntheticUid);
  assert.equal(storedProfile?.email, syntheticEmail);
  assert.equal(storedProfile?.displayName, 'Synthetic New Member');
  assert.deepEqual(storedProfile?.roles, ['member']);
  assert.deepEqual(storedProfile?.ministries, []);
  assert.deepEqual(storedProfile?.lcRoles, []);
  assert.equal(storedProfile?.isCoreMember, false);
  assert.equal(storedProfile?.isVerified, false);
  assert.equal(storedProfile?.isEmailVerified, true);
  assert.equal(storedProfile?.isDisabled, false);

  const second = await fetch(`http://127.0.0.1:${address.port}/api/auth/ensure-member-profile`, {
    method: 'POST',
    headers: {
      authorization: 'Bearer synthetic-member-profile-token',
      'content-type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  const secondPayload = await second.json() as { created?: boolean; reason?: string };
  assert.equal(second.status, 200);
  assert.equal(secondPayload.created, false);
  assert.equal(secondPayload.reason, 'profile-exists');
  assert.equal(transactionCalls, 1, 'Existing member profile must not open another mutation transaction.');
} finally {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

const loginSource = readFileSync('src/pages/Login.tsx', 'utf8');
assert.match(loginSource, /await claimOrCreateAuthenticatedProfile\(credential\.user\.displayName \|\| undefined\);/);
assert.match(loginSource, /await claimOrCreateAuthenticatedProfile\(name\.trim\(\)\);/);
assert.match(loginSource, /await claimOrCreateAuthenticatedProfile\(result\.user\.displayName \|\| 'Member'\);/);
assert.equal(loginSource.includes('setDoc(userDocRef'), false, 'Login must not depend on direct client Firestore profile creation.');

console.log('Authenticated member profile initialization and orphan-login repair boundary: PASS');
