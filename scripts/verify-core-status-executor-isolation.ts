import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const serverEntry = fs.readFileSync('server.ts', 'utf8');
assert.doesNotMatch(
  serverEntry,
  /coreStatusStagingExecutor|firestoreCoreStatusTransactionAdapter/,
  'The main server entry must not wire the staging-only Core-status executor before an explicit staging activation gate.',
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

console.log('Core status executor remains server-only, route-isolated and disabled by default.');
