import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, normalize } from 'node:path';

const manifestPath = process.argv[2] || 'dist/kcfc-build-manifest.json';
const distDir = process.argv[3] || 'dist';

if (!existsSync(manifestPath)) {
  throw new Error(`KCFC build artifact manifest verification: missing ${manifestPath}.`);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.manifestVersion !== 1) {
  throw new Error('KCFC build artifact manifest verification: unsupported manifestVersion.');
}
if (!/^[0-9a-f]{40}$/i.test(String(manifest.sourceCommit || ''))) {
  throw new Error('KCFC build artifact manifest verification: invalid sourceCommit.');
}
if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
  throw new Error('KCFC build artifact manifest verification: files must be a non-empty array.');
}
if (manifest.fileCount !== manifest.files.length) {
  throw new Error('KCFC build artifact manifest verification: fileCount mismatch.');
}

const seen = new Set();
let totalBytes = 0;
for (const entry of manifest.files) {
  if (!entry || typeof entry !== 'object') {
    throw new Error('KCFC build artifact manifest verification: malformed file entry.');
  }
  const relativePath = String(entry.path || '');
  if (!relativePath || relativePath.startsWith('/') || relativePath.includes('..') || normalize(relativePath).startsWith('..')) {
    throw new Error(`KCFC build artifact manifest verification: unsafe relative path ${JSON.stringify(relativePath)}.`);
  }
  if (relativePath === 'kcfc-build-manifest.json') {
    throw new Error('KCFC build artifact manifest verification: manifest must not hash itself.');
  }
  if (seen.has(relativePath)) {
    throw new Error(`KCFC build artifact manifest verification: duplicate file path ${relativePath}.`);
  }
  seen.add(relativePath);

  const filePath = join(distDir, relativePath);
  if (!existsSync(filePath)) {
    throw new Error(`KCFC build artifact manifest verification: missing build file ${relativePath}.`);
  }
  const source = readFileSync(filePath);
  const bytes = statSync(filePath).size;
  const sha256 = createHash('sha256').update(source).digest('hex');
  if (entry.bytes !== bytes) {
    throw new Error(`KCFC build artifact manifest verification: byte-size mismatch for ${relativePath}.`);
  }
  if (entry.sha256 !== sha256) {
    throw new Error(`KCFC build artifact manifest verification: SHA-256 mismatch for ${relativePath}.`);
  }
  totalBytes += bytes;
}

if (manifest.totalBytes !== totalBytes) {
  throw new Error('KCFC build artifact manifest verification: totalBytes mismatch.');
}

console.log(`KCFC build artifact manifest verification: PASS (${manifest.fileCount} files, source ${manifest.sourceCommit})`);
