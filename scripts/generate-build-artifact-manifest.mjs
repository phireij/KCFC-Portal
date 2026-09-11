import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const distDir = process.argv[2] || 'dist';
const outputPath = process.argv[3] || join(distDir, 'kcfc-build-manifest.json');

if (!existsSync(distDir)) {
  throw new Error(`KCFC build artifact manifest: ${distDir} does not exist.`);
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function resolveSourceSha() {
  const explicit = String(process.env.KCFC_SOURCE_SHA || '').trim();
  if (explicit) return explicit;
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

const sourceCommit = resolveSourceSha();
if (!/^[0-9a-f]{40}$/i.test(sourceCommit)) {
  throw new Error('KCFC build artifact manifest: source commit must be a full 40-character Git SHA.');
}

const resolvedOutput = resolve(outputPath);
const files = walk(distDir)
  .filter((filePath) => resolve(filePath) !== resolvedOutput)
  .map((filePath) => {
    const source = readFileSync(filePath);
    return {
      path: relative(distDir, filePath).replaceAll('\\', '/'),
      bytes: statSync(filePath).size,
      sha256: createHash('sha256').update(source).digest('hex'),
    };
  })
  .sort((a, b) => a.path.localeCompare(b.path));

if (files.length === 0) {
  throw new Error('KCFC build artifact manifest: no build files found.');
}

const manifest = {
  manifestVersion: 1,
  sourceCommit,
  fileCount: files.length,
  totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
  files,
};

writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`KCFC build artifact manifest: ${outputPath}`);
console.log(`Source commit: ${sourceCommit}`);
console.log(`Files hashed: ${manifest.fileCount}`);
console.log(`Total bytes: ${manifest.totalBytes}`);
