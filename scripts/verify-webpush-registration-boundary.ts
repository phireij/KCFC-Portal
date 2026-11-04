import fs from 'node:fs';
import assert from 'node:assert/strict';

const server = fs.readFileSync('server.ts', 'utf8');
const client = fs.readFileSync('src/lib/fcmClient.ts', 'utf8');

const serverRequired = [
  'const MAX_WEB_PUSH_SUBSCRIPTIONS_PER_USER = 8;',
  'const MAX_WEB_PUSH_ENDPOINT_LENGTH = 2048;',
  'const MAX_WEB_PUSH_KEY_LENGTH = 512;',
  'function normalizeWebPushSubscription(input: any)',
  'if (endpointUrl.protocol !== "https:") return null;',
  'const normalizedSubscription = normalizeWebPushSubscription(subscription);',
  'res.status(400).json({ error: "Invalid Web Push subscription data" });',
  'await registerWebPushSubscription(dbAdmin, userId, normalizedSubscription, MAX_WEB_PUSH_SUBSCRIPTIONS_PER_USER);',
];

for (const marker of serverRequired) {
  if (!server.includes(marker)) {
    throw new Error(`Web Push registration boundary missing server marker: ${marker}`);
  }
}

const clientRequired = [
  'fetch("/api/webpush/register"',
  '"Authorization": `Bearer ${idToken}`',
  'throw new Error(`Backend Web Push registration failed with status ${regResponse.status}.`);',
];
for (const marker of clientRequired) {
  if (!client.includes(marker)) {
    throw new Error(`Web Push registration boundary missing client marker: ${marker}`);
  }
}

const forbiddenServer = [
  'if (!subscription || !subscription.endpoint)',
  'sub.endpoint !== subscription.endpoint',
  '...subscription,\n        registeredAt',
];
for (const marker of forbiddenServer) {
  if (server.includes(marker)) {
    throw new Error(`Web Push registration boundary regression: ${marker}`);
  }
}

const forbiddenClient = [
  'webPushSubscriptions: arrayUnion(subscriptionJson)',
  'Falling back to direct Firestore self-update',
  'Successfully registered PushSubscription directly in Firestore',
];
for (const marker of forbiddenClient) {
  if (client.includes(marker)) {
    throw new Error(`Web Push client registration boundary regression: ${marker}`);
  }
}

console.log('Web Push registration boundary: PASS (server shape/HTTPS/size validation, endpoint dedupe, max-8 retention, authenticated backend-only client registration).');

// Execute the real persistence helpers and extracted routes with an optimistic
// in-memory transaction store. Do not import server.ts or start Firebase/providers.
const { runInNewContext } = await import('node:vm');
const { transpileModule, ModuleKind } = await import('typescript');
const { registerWebPushSubscription, pruneExpiredWebPushSubscriptions } = await import('../server/webPushSubscriptionStore');
type Store = Parameters<typeof registerWebPushSubscription>[0];
type Data = Record<string, any>;
const clone = <T>(value: T): T => structuredClone(value);
const device = (id: string) => ({ endpoint: `https://push.example.invalid/${id}`, expirationTime: null, keys: { p256dh: `key-${id}`, auth: `auth-${id}` } });

class MemoryStore {
  data: Data | undefined;
  version = 0;
  writes = 0;
  transactions = 0;
  retries = 0;
  beforeCommit: (() => Promise<void>) | undefined;
  failTransactions = false;
  constructor(data?: Data) { this.data = clone(data); }
  db = {
    collection: (name: string) => {
      assert.equal(name, 'users');
      return { doc: (uid: string) => { assert.equal(uid, 'synthetic-owner'); return { uid }; } };
    },
    runTransaction: async (callback: (transaction: any) => Promise<unknown>) => {
      this.transactions++;
      if (this.failTransactions) throw new Error('Synthetic transaction failure');
      for (let attempt = 0; attempt < 5; attempt++) {
        const version = this.version;
        const snapshot = clone(this.data);
        let pending: Data | undefined;
        let read = false;
        const result = await callback({
          get: async (ref: any) => {
            assert.equal(ref.uid, 'synthetic-owner'); assert.equal(read, false); read = true;
            return { exists: snapshot !== undefined, data: () => clone(snapshot) };
          },
          set: (ref: any, fields: Data, options: Data) => {
            assert.equal(ref.uid, 'synthetic-owner'); assert.equal(read, true); assert.deepEqual(options, { merge: true });
            pending = { ...snapshot, ...clone(fields) };
          },
          update: (ref: any, fields: Data) => {
            assert.equal(ref.uid, 'synthetic-owner'); assert.equal(read, true); assert.notEqual(snapshot, undefined);
            pending = { ...snapshot, ...clone(fields) };
          },
        });
        const interleave = this.beforeCommit; this.beforeCommit = undefined;
        if (interleave) await interleave();
        if (version !== this.version) { this.retries++; continue; }
        if (pending !== undefined) { this.data = pending; this.version++; this.writes++; }
        return result;
      }
      throw new Error('Synthetic retry limit exceeded');
    },
  } as unknown as Store;
}

const register = (store: MemoryStore, id: string) => registerWebPushSubscription(store.db, 'synthetic-owner', device(id), 8);
const endpoints = (store: MemoryStore) => store.data?.webPushSubscriptions.map((sub: any) => sub.endpoint);

// Two registrations read the same version. A retries after B commits, preserving B.
const concurrent = new MemoryStore({ isVerified: true, unrelated: 'preserved', webPushSubscriptions: [device('old')] });
concurrent.beforeCommit = () => register(concurrent, 'b');
await register(concurrent, 'a');
assert.equal(concurrent.retries, 1);
assert.deepEqual(endpoints(concurrent), ['old', 'b', 'a'].map(id => device(id).endpoint));
assert.equal(concurrent.data?.unrelated, 'preserved');
assert.equal(concurrent.data?.isVerified, true);

// Existing replacement and max-eight retention, including a retry at capacity.
const bounded = new MemoryStore({ webPushSubscriptions: Array.from({ length: 8 }, (_, i) => device(String(i))) });
bounded.beforeCommit = () => register(bounded, '8');
await register(bounded, '9');
assert.deepEqual(endpoints(bounded), Array.from({ length: 8 }, (_, i) => device(String(i + 2)).endpoint));
await register(bounded, '4');
assert.equal(bounded.data?.webPushSubscriptions.length, 8);
assert.equal(endpoints(bounded).filter((endpoint: string) => endpoint === device('4').endpoint).length, 1);
assert.equal(endpoints(bounded).at(-1), device('4').endpoint);
const single = new MemoryStore({ webPushSubscriptions: [device('old')] });
await registerWebPushSubscription(single.db, 'synthetic-owner', device('only'), 1);
assert.deepEqual(endpoints(single), [device('only').endpoint]);
for (const limit of [0, -1, 1.5, NaN]) {
  await assert.rejects(registerWebPushSubscription(single.db, 'synthetic-owner', device('invalid'), limit), RangeError);
}
assert.equal(single.writes, 1);

// A refresh is distinct even with unchanged endpoint and keys. Old delivery
// snapshots must not remove it, including when the cleanup transaction retries.
const refreshed = new MemoryStore();
const RealDate = Date;
let oldSnapshot: Data[];
try {
  globalThis.Date = class extends RealDate { constructor() { super('2026-11-03T23:00:00.000Z'); } } as DateConstructor;
  await register(refreshed, 'same');
  oldSnapshot = clone(refreshed.data!.webPushSubscriptions);
  refreshed.beforeCommit = () => register(refreshed, 'same');
  await pruneExpiredWebPushSubscriptions(refreshed.db, 'synthetic-owner', oldSnapshot);
} finally { globalThis.Date = RealDate; }
assert.equal(refreshed.retries, 1);
assert.equal(refreshed.data?.webPushSubscriptions.length, 1);
assert.equal(refreshed.data?.webPushSubscriptions[0].registeredAt, oldSnapshot[0].registeredAt);
assert.notEqual(refreshed.data?.webPushSubscriptions[0].registrationId, oldSnapshot[0].registrationId);
assert.equal(refreshed.writes, 2, 'A stale prune must make no extra write after a refresh.');

// Legacy snapshots without registrationId still prune, but newly added devices
// and other profile fields survive a conflict/retry.
const legacy = new MemoryStore({ webPushSubscriptions: [device('expired'), device('keep')], unrelated: 'preserved' });
legacy.beforeCommit = () => register(legacy, 'new');
await pruneExpiredWebPushSubscriptions(legacy.db, 'synthetic-owner', [device('expired')]);
assert.equal(legacy.retries, 1);
assert.deepEqual(endpoints(legacy), ['keep', 'new'].map(id => device(id).endpoint));
assert.equal(legacy.data?.unrelated, 'preserved');

// Two cleanup operations cannot resurrect each other's removed subscriptions.
const concurrentPrune = new MemoryStore({ webPushSubscriptions: ['a', 'b', 'keep'].map(device) });
concurrentPrune.beforeCommit = () => pruneExpiredWebPushSubscriptions(concurrentPrune.db, 'synthetic-owner', [device('b')]);
await pruneExpiredWebPushSubscriptions(concurrentPrune.db, 'synthetic-owner', [device('a')]);
assert.deepEqual(endpoints(concurrentPrune), [device('keep').endpoint]);
assert.equal(concurrentPrune.retries, 1);

// Empty, absent, malformed and already-pruned records do not create or rewrite profiles.
for (const data of [undefined, { webPushSubscriptions: null }, { webPushSubscriptions: 'invalid' }, { webPushSubscriptions: [] }]) {
  const store = new MemoryStore(data);
  await pruneExpiredWebPushSubscriptions(store.db, 'synthetic-owner', []);
  assert.equal(store.transactions, 0);
  await pruneExpiredWebPushSubscriptions(store.db, 'synthetic-owner', [device('expired')]);
  assert.equal(store.writes, 0); assert.deepEqual(store.data, data);
}

const compile = (text: string) => transpileModule(text, { compilerOptions: { module: ModuleKind.None } }).outputText;
function extractRoute(path: string) {
  const marker = `app.post("${path}"`;
  const start = server.indexOf(marker); assert.notEqual(start, -1);
  const rest = server.slice(start + marker.length);
  const end = rest.search(/\n\s*app\.(?:get|post|put|patch|delete)\(/);
  return server.slice(start, end === -1 ? server.length : start + marker.length + end);
}
async function invokeRoute(path: string, context: Data, request: Data) {
  let handler: any;
  runInNewContext(compile(extractRoute(path)), { ...context, app: { post(actual: string, callback: any) { assert.equal(actual, path); handler = callback; } } });
  let status = 200; let payload: any;
  await handler(request, { status(code: number) { status = code; return this; }, json(value: any) { payload = value; } });
  return { status, payload };
}
const quietConsole = { error() {}, warn() {} };
const auth = { async verifyIdToken(token: string) { assert.equal(token, 'synthetic'); return { uid: 'synthetic-owner' }; } };
const normalizationContext: Data = { URL };
runInNewContext(compile(server.slice(server.indexOf('const MAX_WEB_PUSH_SUBSCRIPTIONS_PER_USER'), server.indexOf('// Helpers for Firestore REST'))), normalizationContext);
const routeStore = new MemoryStore({ webPushSubscriptions: [device('old')] });
const registrationContext = { authAdmin: auth, dbAdmin: routeStore.db, registerWebPushSubscription, normalizeWebPushSubscription: normalizationContext.normalizeWebPushSubscription, MAX_WEB_PUSH_SUBSCRIPTIONS_PER_USER: 8, logMessage() {}, console: quietConsole };
routeStore.beforeCommit = () => register(routeStore, 'b');
const registration = await invokeRoute('/api/webpush/register', registrationContext, { headers: { authorization: 'Bearer synthetic' }, body: { subscription: device('a') } });
assert.equal(registration.status, 200); assert.equal(registration.payload.success, true);
assert.deepEqual(endpoints(routeStore), ['old', 'b', 'a'].map(id => device(id).endpoint));
for (const [headers, subscription, expected] of [
  [{}, device('valid'), 401],
  [{ authorization: 'Bearer synthetic' }, { ...device('bad'), endpoint: 'http://push.example.invalid/bad' }, 400],
  [{ authorization: 'Bearer synthetic' }, { ...device('bad'), keys: {} }, 400],
] as const) {
  const writes = routeStore.writes;
  const result = await invokeRoute('/api/webpush/register', registrationContext, { headers, body: { subscription } });
  assert.equal(result.status, expected); assert.equal(routeStore.writes, writes);
}
routeStore.failTransactions = true;
const failedRegistration = await invokeRoute('/api/webpush/register', registrationContext, { headers: { authorization: 'Bearer synthetic' }, body: { subscription: device('failed') } });
assert.equal(failedRegistration.status, 500); assert.notEqual(failedRegistration.payload.success, true);

// Actual self-test route: a fresh registration commits while sending to the old
// snapshot. Only the expired registration is pruned; the new one remains stored.
const selfTest = new MemoryStore({ isVerified: true, isDisabled: false, fcmTokens: [], webPushSubscriptions: [device('expired')] });
const notifications: Data[] = [];
const selfTestDb = { ...selfTest.db, collection(name: string) {
  if (name === 'notifications') return { async add(record: Data) { notifications.push(record); } };
  return selfTest.db.collection(name);
} };
let sends = 0;
const result = await invokeRoute('/api/users/send-test-push', {
  authAdmin: auth, dbAdmin: selfTestDb, pruneExpiredWebPushSubscriptions,
  async fetchUserDocWithFallback(uid: string) { assert.equal(uid, 'synthetic-owner'); return clone(selfTest.data); },
  isDeliverableFcmToken: () => false,
  async sendWebPushNotification() { sends++; await register(selfTest, 'new'); return { success: false, expired: true }; },
  logMessage() {}, console: quietConsole,
}, { headers: { authorization: 'Bearer synthetic' } });
assert.equal(result.status, 200); assert.equal(result.payload.inboxFallback, true);
assert.equal(sends, 1); assert.deepEqual(endpoints(selfTest), [device('new').endpoint]);
assert.equal(notifications.length, 1); assert.equal(notifications[0].userId, 'synthetic-owner');

// Execute both existing broadcast cleanup blocks too, without exercising any
// announcement/broadcast authorization or sending to a real provider/member.
for (const [marker, endMarker] of [
  ['// --- Standard Web Push Delivery for Announcements (iOS Safari Support) ---', '\n      res.json({'],
  ['// --- Standard Web Push Delivery ---', '\n      const deliveryResultsByUser ='],
]) {
  const start = server.indexOf(marker); assert.notEqual(start, -1);
  const end = server.indexOf(endMarker, start); assert.notEqual(end, -1);
  const store = new MemoryStore({ webPushSubscriptions: [device('expired')] });
  const recipient = { id: 'synthetic-owner', ...clone(store.data) };
  let blockSends = 0;
  await runInNewContext(compile(`(async () => { ${server.slice(start, end)} })()`), {
    dbAdmin: store.db, pruneExpiredWebPushSubscriptions, targetUsers: [recipient], pwaAttempts: [],
    async fetchAllUsersWithFallback() { return [recipient]; },
    async sendWebPushNotification() { blockSends++; await register(store, 'new'); return { success: false, expired: true }; },
    token: 'synthetic', title: 'Synthetic test', body: 'Synthetic test', clickAction: '/inbox', logMessage() {},
    console: { error(...args: unknown[]) { throw new Error(`Unexpected synthetic broadcast error: ${String(args[0])}`); } },
  });
  assert.equal(blockSends, 1); assert.deepEqual(endpoints(store), [device('new').endpoint]);
}

// All existing announcement/custom/self-test prune paths must use the safe helper.
assert.equal((server.match(/await pruneExpiredWebPushSubscriptions\(dbAdmin, (?:u.id|callerUid), expiredSubscriptions\);/g) || []).length, 3);
assert.doesNotMatch(server, /webPushSubscriptions:\s*updatedSubs/);
console.log('Web Push transaction regressions: PASS (concurrent registration, same-millisecond refresh, max-eight retention, pruning retries, legacy/no-op safety, actual registration/self-test routes and both broadcast cleanup blocks).');
