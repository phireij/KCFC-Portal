import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('server.ts', 'utf8');
const routeMarker = 'app.post("/api/users/send-test-push"';
const routeStart = source.indexOf(routeMarker);
assert.notEqual(routeStart, -1, 'Self-test push route must exist.');

const remainder = source.slice(routeStart + routeMarker.length);
const nextRouteOffset = remainder.search(/\n\s*app\.(?:get|post|put|patch|delete)\(/);
const route = source.slice(routeStart, nextRouteOffset === -1 ? source.length : routeStart + routeMarker.length + nextRouteOffset);

assert.match(route, /authAdmin\.verifyIdToken\(token\)/, 'Self-test push must verify the caller Firebase ID token.');
assert.match(route, /const callerUid = decodedToken\.uid/, 'Self-test push must derive the recipient identity from the verified token.');
assert.match(route, /fetchUserDocWithFallback\(callerUid, token\)/, 'Self-test push must load only the verified caller profile.');
assert.match(route, /userId:\s*callerUid/, 'Any Firestore fallback notification must remain bound to the verified caller UID.');
assert.doesNotMatch(route, /fetchAllUsersWithFallback\(/, 'Self-test push must never enumerate the member directory.');
assert.doesNotMatch(route, /req\.body\s*\.(?:target|targetUid|userId|uid|recipient)/, 'Self-test push must not accept a caller-selected recipient.');
assert.doesNotMatch(route, /const\s*\{[^}]*\b(?:target|targetUid|targetToken|userId|uid|recipient)\b[^}]*\}\s*=\s*req\.body/, 'Self-test push must not destructure a caller-selected recipient or push token.');
assert.doesNotMatch(route, /\btargetToken\b/, 'Self-test push must never accept a caller-supplied push token.');
assert.match(route, /const savedTokens = callerProfile\.fcmTokens \|\| \[\]/, 'Self-test FCM tokens must come from the authenticated caller profile.');

assert.match(route, /success:\s*false,[\s\S]*transportAccepted:\s*false,[\s\S]*inboxFallback:\s*true/, 'Inbox fallback must not be reported as native push success.');
assert.match(route, /Native push transport was not confirmed\. A fallback notification was stored in the KCFC Inbox instead\./, 'Fallback response must clearly distinguish Inbox persistence from native push acceptance.');
assert.doesNotMatch(route, /successCount:\s*realTokens\.length/, 'Fallback must not fabricate FCM transport success counts.');

console.log('Self-test push recipient-boundary verification passed.');

// Execute the actual route without starting the application or loading Firebase.
// Every provider dependency is synthetic; only loopback HTTP is used.
const { default: express } = await import('express');
const { runInNewContext } = await import('node:vm');
const { transpileModule, ModuleKind } = await import('typescript');
const compile = (text: string) => transpileModule(text, { compilerOptions: { module: ModuleKind.None } }).outputText;
for (const [label, profile, expected] of [
  ['deleted profile', null, 404],
  ['pending member', { isVerified: false }, 403],
  ['disabled member', { isVerified: true, isDisabled: true }, 403],
  ['malformed disabled string', { isVerified: true, isDisabled: 'true' }, 403],
  ['malformed disabled number', { isVerified: true, isDisabled: 1 }, 403],
  ['malformed disabled null', { isVerified: true, isDisabled: null }, 403],
  ['missing approval flag', {}, 403],
  ['string approval flag', { isVerified: 'true' }, 403],
  ['active ordinary member', { isVerified: true, isDisabled: false, isCoreMember: false, roles: ['member'], isEmailVerified: false }, 200],
  ['legacy active member', { isVerified: true }, 200],
] as const) {
  let credentialReads = 0;
  const caller = profile && Object.defineProperties({ ...profile }, {
    fcmTokens: { get() { credentialReads++; return []; } },
    webPushSubscriptions: { get() { credentialReads++; return []; } },
  });
  const app = express(); app.use(express.json());
  runInNewContext(compile(route), {
    app: { post(path: string, handler: (req: any, res: any) => Promise<void>) {
      app.post(path, (req, res) => Promise.resolve(handler(req, res)));
    } },
    authAdmin: { async verifyIdToken(token: string) { assert.equal(token, 'synthetic'); return { uid: 'owner-test' }; } },
    async fetchUserDocWithFallback(uid: string) { assert.equal(uid, 'owner-test'); return caller; },
    isDeliverableFcmToken: () => false,
    console: { error() { throw new Error('Unexpected route error'); } },
    // No send or database-write APIs are supplied: reaching one fails the case.
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  try {
    const { port } = server.address() as import('node:net').AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/api/users/send-test-push`, {
      method: 'POST', headers: { authorization: 'Bearer synthetic', 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'not-the-owner', targetToken: 'must-be-ignored' }),
    });
    assert.equal(response.status, expected, label);
    const payload = await response.json() as { error?: string; success?: boolean };
    if (expected === 403) assert.equal(payload.error, 'Active verified membership is required to test notifications.');
    if (expected !== 200) assert.equal(credentialReads, 0, `${label}: reject before reading saved credentials`);
    else { assert.equal(credentialReads, 2); assert.equal(payload.success, false); }
  } finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
}

// Both loader paths must retain membership flags; otherwise the route would
// incorrectly reject active users or fail to see disabled membership.
const loader = source.slice(source.indexOf('async function fetchUserDocWithFallback('), source.indexOf('\nasync function startServer()'));
for (const useRest of [false, true]) for (const disabledValue of [true, false, undefined, 'true', 1, null]) {
  const flags = { isVerified: true, isDisabled: disabledValue };
  const context: Record<string, any> = {
    dbAdmin: { collection: () => ({ doc: () => ({ get: async () => {
      if (useRest) throw new Error('Synthetic Admin read failure');
      return { exists: true, id: 'owner-test', data: () => flags };
    } }) }) },
    firebaseConfig: {}, targetProjectId: 'synthetic-only', logMessage() {},
    fetch: async () => ({ status: 200, ok: true, json: async () => ({}) }),
    simplifyRESTDoc: () => flags,
    console: { error() {} },
  };
  runInNewContext(compile(loader), context);
  const result = await context.fetchUserDocWithFallback('owner-test', 'synthetic');
  assert.equal(result.isVerified, true, `Loader approval flag, REST=${useRest}`);
  assert.equal(result.isDisabled, disabledValue !== undefined && disabledValue !== false, `Loader disabled flag, REST=${useRest}`);
}
console.log('Self-test active-member gate and Admin/REST flag preservation: PASS');

// Combined feedback scenarios use an approved ordinary-member fixture.

const { describeSelfTestPushResult } = await import('../src/lib/selfTestPushResult');
for (const accepted of [false, true]) {
  const records: Record<string, any>[] = [];
  let sends = 0;
  const app = express(); app.use(express.json());
  runInNewContext(transpileModule(route, { compilerOptions: { module: ModuleKind.None } }).outputText, {
    app: { post(path: string, handler: (req: any, res: any) => Promise<void>) { app.post(path, (req, res) => Promise.resolve(handler(req, res))); } },
    authAdmin: { async verifyIdToken() { return { uid: 'synthetic-owner' }; } },
    async fetchUserDocWithFallback(uid: string) { assert.equal(uid, 'synthetic-owner'); return { isVerified: true, isDisabled: false, roles: ['member'], isCoreMember: false, fcmTokens: [], webPushSubscriptions: [{ endpoint: 'synthetic-only' }] }; },
    isDeliverableFcmToken: () => false,
    async sendWebPushNotification() { sends++; return { success: accepted, expired: false }; },
    dbAdmin: { collection(name: string) { assert.equal(name, 'notifications'); return { async add(record: Record<string, any>) { records.push(record); } }; } },
    logMessage() {}, console: { error() {}, warn() {} },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  try {
    const { port } = server.address() as import('node:net').AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/api/users/send-test-push`, { method: 'POST', headers: { authorization: 'Bearer synthetic' } });
    const result = await response.json() as Record<string, any>;
    assert.equal(response.status, 200);
    assert.equal(sends, 1);
    assert.equal(result.success, accepted);
    const display = describeSelfTestPushResult(response.ok, result);
    if (!accepted) {
      assert.equal(result.transportAccepted, false); assert.equal(result.inboxFallback, true);
      assert.equal(result.webPushSuccessCount, 0);
      assert.equal(records.length, 1); assert.equal(records[0].userId, 'synthetic-owner');
      assert.equal(records[0].title, 'KCFC push test could not confirm delivery');
      assert.equal(records[0].message, 'Push delivery was not confirmed. This Inbox-only fallback does not prove that a smartphone notification was delivered.');
      assert.equal(display.tone, 'error'); assert.match(display.text, /Inbox-only/);
    } else {
      assert.equal(records.length, 0, 'Successful self-test must not invent a durable Inbox event.');
      assert.equal(display.tone, 'ok'); assert.match(display.text, /Confirm the notification actually appears/);
    }
  } finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
}
for (const result of [
  { success: true, inboxFallback: true },
  { success: true, transportAccepted: false },
  { success: true, isSandboxSimulated: true },
  { success: true, transportAccepted: 'false' },
  { success: true, inboxFallback: 'true' },
  { success: true, isSandboxSimulated: 'true' },
  { success: true, transportAccepted: null },
  { success: 'true' }, null,
]) assert.equal(describeSelfTestPushResult(true, result).tone, 'error');
assert.equal(describeSelfTestPushResult(false, { success: true }).tone, 'error');
const ui = readFileSync('src/components/NotificationHealth.tsx', 'utf8');
assert.match(ui, /setTestResult\(describeSelfTestPushResult\(response.ok, result\)\)/, 'Component must use the tested response presentation contract.');
assert.doesNotMatch(ui, /Test alert was accepted by the current browser environment/);
console.log('Actual self-test fallback payload, Inbox copy, successful non-persistence and UI result contract: PASS');
