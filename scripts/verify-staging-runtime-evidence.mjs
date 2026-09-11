import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const tempDir = mkdtempSync(join(tmpdir(), 'kcfc-staging-evidence-'));
const healthPath = join(tempDir, 'health.json');
const baseEnv = {
  ...process.env,
  APP_URL: 'https://kcfc-staging-ci.example.invalid',
  VITE_KCFC_RUNTIME_ENV: 'staging',
  KCFC_RUNTIME_ENV: 'staging',
  VITE_FIREBASE_PROJECT_ID: 'kcfc-staging-ci',
  FIREBASE_PROJECT_ID: 'kcfc-staging-ci',
  VITE_FIREBASE_DATABASE_ID: 'kcfc-staging-ci-db',
  FIREBASE_DATABASE_ID: 'kcfc-staging-ci-db',
};

function run(payload, env = baseEnv) {
  writeFileSync(healthPath, JSON.stringify(payload), 'utf8');
  return spawnSync(process.execPath, ['scripts/staging-runtime-evidence.mjs', healthPath], {
    env,
    encoding: 'utf8',
  });
}

function expectPass(result, label) {
  if (result.status !== 0) {
    throw new Error(`${label}: expected PASS, received exit ${result.status}. stderr=${result.stderr}`);
  }
  if (!result.stdout.includes('KCFC staging runtime evidence PASS')) {
    throw new Error(`${label}: PASS marker missing from stdout.`);
  }
  for (const secretMarker of ['API_KEY', 'VAPID', 'TOKEN', 'PASSWORD', 'PRIVATE']) {
    if (result.stdout.toUpperCase().includes(secretMarker)) {
      throw new Error(`${label}: output unexpectedly contains secret-like marker ${secretMarker}.`);
    }
  }
}

function expectFail(result, label) {
  if (result.status === 0) {
    throw new Error(`${label}: expected failure but validator exited successfully.`);
  }
}

try {
  const validPayload = {
    status: 'ok',
    time: '2026-09-11T11:30:00.000Z',
    runtime: 'staging',
    firebaseProjectId: 'kcfc-staging-ci',
    firestoreDatabaseId: 'kcfc-staging-ci-db',
  };

  expectPass(run(validPayload), 'valid staging health evidence');
  expectFail(run({ ...validPayload, firebaseApiKey: 'must-not-appear' }), 'unexpected sensitive field');
  expectFail(run({ ...validPayload, firebaseProjectId: 'wrong-project' }), 'project mismatch');
  expectFail(run({ ...validPayload, runtime: 'production' }), 'runtime mismatch');
  expectFail(run(validPayload, { ...baseEnv, APP_URL: 'https://portal.kcfcjp.com' }), 'production hostname');

  console.log('Staging runtime evidence validator contract: PASS');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
