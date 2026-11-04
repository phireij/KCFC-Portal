import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const server = fs.readFileSync('server.ts', 'utf8');
const preflight = fs.readFileSync('scripts/staging-preflight.mjs', 'utf8');

const serverRequired = [
  'const runtimeAppUrl = String(process.env.APP_URL || "").trim();',
  'if (runtimeEnvironment === "staging") {',
  'KCFC staging safety guard: APP_URL is required for staging.',
  'KCFC staging safety guard: staging APP_URL must be a valid absolute HTTPS URL.',
  'KCFC staging safety guard: staging APP_URL must not target the production KCFC Portal hostname.',
  "new Set(['portal.kcfcjp.com', 'www.portal.kcfcjp.com'])",
];
for (const marker of serverRequired) {
  if (!server.includes(marker)) throw new Error(`Server staging APP_URL marker missing: ${marker}`);
}

const preflightRequired = [
  "const appUrlRaw = required('APP_URL');",
  "appUrl.protocol !== 'https:'",
  "new Set(['portal.kcfcjp.com', 'www.portal.kcfcjp.com'])",
  'APP_URL must not target the production KCFC Portal hostname',
];
for (const marker of preflightRequired) {
  if (!preflight.includes(marker)) throw new Error(`Preflight staging APP_URL marker missing: ${marker}`);
}

const productionFallback = 'process.env.APP_URL || "https://portal.kcfcjp.com"';
if (!server.includes(productionFallback)) {
  throw new Error('Expected legacy production APP_URL fallback marker is missing; re-review this boundary.');
}

// Exercise only the real startup URL guard. Do not import server.ts, initialize
// Firebase, start a server, resolve hosts, or send any requests.
const guardStart = server.indexOf('const runtimeEnvironment = ');
const guardEnd = server.indexOf('const hasServerEnvConfig = ', guardStart);
assert.ok(guardStart >= 0 && guardEnd > guardStart, 'Startup URL guard extraction boundaries must exist.');
const guard = ts.transpileModule(server.slice(guardStart, guardEnd), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

const syntheticEnv = {
  APP_URL: 'https://kcfc-staging-ci.example.invalid',
  VITE_KCFC_RUNTIME_ENV: 'staging',
  KCFC_RUNTIME_ENV: 'staging',
  VITE_FIREBASE_API_KEY: 'synthetic-client-key',
  FIREBASE_API_KEY: 'synthetic-server-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'kcfc-staging-ci.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'kcfc-staging-ci',
  FIREBASE_PROJECT_ID: 'kcfc-staging-ci',
  VITE_FIREBASE_APP_ID: 'synthetic-app-id',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '1234567890',
  VITE_FIREBASE_DATABASE_ID: 'kcfc-staging-ci-db',
  FIREBASE_DATABASE_ID: 'kcfc-staging-ci-db',
  VITE_FCM_VAPID_KEY: 'synthetic-fcm-public-vapid',
  WEB_PUSH_VAPID_PUBLIC_KEY: 'synthetic-native-public-vapid',
  WEB_PUSH_VAPID_PRIVATE_KEY: 'synthetic-private-vapid',
  KCFC_CORE_STATUS_STAGING_EXECUTOR_ENABLED: 'false',
};
const tempDir = mkdtempSync(join(tmpdir(), 'kcfc-app-url-boundary-'));
const healthPath = join(tempDir, 'health.json');
writeFileSync(healthPath, JSON.stringify({
  status: 'ok',
  time: '2026-11-04T00:00:00.000Z',
  runtime: 'staging',
  firebaseProjectId: syntheticEnv.FIREBASE_PROJECT_ID,
  firestoreDatabaseId: syntheticEnv.FIREBASE_DATABASE_ID,
}));

const cases: Array<{ url: string; failure?: RegExp }> = [
  { url: 'https://kcfc-staging-ci.example.invalid' },
  { url: 'https://kcfc-staging-ci.example.invalid.' },
  { url: 'https://portal.kcfcjp.com.example.invalid' },
  { url: 'https://example.invalid/path/portal.kcfcjp.com.' },
  { url: 'http://kcfc-staging-ci.example.invalid', failure: /HTTPS/ },
  { url: 'not a URL', failure: /valid absolute/ },
];
for (const hostname of ['portal.kcfcjp.com', 'www.portal.kcfcjp.com']) {
  for (const url of [
    `https://${hostname}`,
    `https://${hostname.toUpperCase()}`,
    `https://${hostname}.`,
    `https://${hostname.toUpperCase()}.:443/`,
    `https://${hostname}.:8443/path`,
    `https://${hostname}%2e/`,
    `https://${hostname}\u3002/`,
  ]) {
    cases.push({ url, failure: /must not target the production KCFC Portal hostname/ });
  }
}

try {
  let checked = 0;
  for (const { url, failure } of cases) {
    const env = { ...syntheticEnv, APP_URL: url };
    let serverError: unknown;
    try {
      vm.runInNewContext(guard, { URL, process: { env } }, { timeout: 1000 });
    } catch (error) {
      serverError = error;
    }
    if (failure) {
      assert.match(String(serverError), failure, `Server guard must reject ${url} for the expected reason.`);
    } else {
      assert.equal(serverError, undefined, `Server guard must accept ${url}.`);
    }
    checked += 1;

    for (const [script, args, marker] of [
      ['scripts/staging-preflight.mjs', [], 'KCFC staging preflight PASS'],
      ['scripts/staging-runtime-evidence.mjs', [healthPath], 'KCFC staging runtime evidence PASS'],
    ] as const) {
      const result = spawnSync(process.execPath, [script, ...args], {
        env,
        encoding: 'utf8',
        timeout: 10000,
      });
      assert.equal(result.error, undefined, `${script}: subprocess must run successfully.`);
      assert.equal(result.signal, null, `${script}: subprocess must not be killed.`);
      if (failure) {
        assert.notEqual(result.status, 0, `${script} must reject ${url}.`);
        assert.match(result.stderr, failure, `${script} must reject ${url} for the expected reason.`);
        assert.ok(!result.stdout.includes(marker), `${script}: rejection must not print PASS.`);
      } else {
        assert.equal(result.status, 0, `${script} must accept ${url}: ${result.stderr}`);
        assert.ok(result.stdout.includes(marker), `${script}: success marker must be present.`);
      }
      checked += 1;
    }
  }

  // Preserve legacy production behavior; this restriction is staging-only.
  for (const url of ['', 'https://portal.kcfcjp.com', 'https://portal.kcfcjp.com.']) {
    vm.runInNewContext(guard, { URL, process: { env: { KCFC_RUNTIME_ENV: 'production', APP_URL: url } } }, { timeout: 1000 });
  }
  console.log(`Staging application URL boundary: PASS (${checked} synthetic checks across startup, preflight, and evidence; production behavior preserved).`);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
