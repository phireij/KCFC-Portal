import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const serverEntry = fs.readFileSync('server.ts', 'utf8');
assert.doesNotMatch(
  serverEntry,
  /coreStatusStagingExecutor|firestoreCoreStatusTransactionAdapter/,
  'The main server entry must not wire the low-level staging Core-status executor directly.',
);
assert.match(
  serverEntry,
  /registerMemberDirectorySyncRoutes\(app, \{ auth: authAdmin, db: dbAdmin \}\)/,
  'The trusted member-directory route bundle must remain registered from the main server entry.',
);

const memberDirectoryRoutes = fs.readFileSync('server/memberDirectorySyncRoutes.ts', 'utf8');
assert.match(memberDirectoryRoutes, /registerCoreStatusTransitionRoutes/);
assert.match(memberDirectoryRoutes, /KCFC_CORE_STATUS_STAGING_EXECUTOR_ENABLED/);

const transitionRoutes = fs.readFileSync('server/coreStatusTransitionRoutes.ts', 'utf8');
assert.match(transitionRoutes, /runtimeEnvironment !== 'staging'/);
assert.match(transitionRoutes, /!executorEnabled/);
assert.match(transitionRoutes, /verifyIdToken/);
assert.match(transitionRoutes, /role === 'admin' \|\| role === 'president'/);
assert.match(transitionRoutes, /buildCoreStatusMutationPlan/);
assert.match(transitionRoutes, /expectedUpdatedAt/);
assert.match(transitionRoutes, /executeCoreStatusTransitionInStaging/);
assert.match(transitionRoutes, /createFirestoreCoreStatusTransactionAdapter/);
assert.match(transitionRoutes, /Application administrators remain outside routine governed Core Member editing/);
assert.match(
  transitionRoutes,
  /res\.status\(500\)\.json\(\{ error: 'Core Member status change failed\.' \}\)/,
  'Unexpected Core-status executor failures must be sanitized before returning to the browser.',
);
assert.doesNotMatch(
  transitionRoutes,
  /res\.status\([^)]*500[^)]*\)\.json\(\{ error: message \}\)/,
  'Internal Core-status executor error messages must not be reflected to the browser.',
);

function sourceFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

for (const file of sourceFiles('src')) {
  const source = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(
    source,
    /coreStatusStagingExecutor|firestoreCoreStatusTransactionAdapter/,
    `${file} must not import the server-only Core-status executor foundation`,
  );
}

const envExample = fs.readFileSync('.env.example', 'utf8');
assert.match(envExample, /^KCFC_CORE_STATUS_STAGING_EXECUTOR_ENABLED=false$/m);
assert.doesNotMatch(envExample, /^KCFC_CORE_STATUS_STAGING_EXECUTOR_ENABLED=true$/m);

console.log('Core status executor remains server-only, staging-only, authenticated, role-gated, error-sanitized and disabled by default.');
