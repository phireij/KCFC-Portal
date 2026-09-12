import { appendFileSync, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const distDir = process.argv[2] || 'dist';
const summaryPath = process.env.GITHUB_STEP_SUMMARY;

if (!existsSync(distDir)) {
  console.error(`Build asset report: ${distDir} does not exist.`);
  process.exit(1);
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

const assets = walk(distDir)
  .filter((filePath) => filePath.endsWith('.js'))
  .map((filePath) => {
    const bytes = statSync(filePath).size;
    const source = readFileSync(filePath);
    const gzipBytes = gzipSync(source, { level: 9 }).length;
    return {
      file: relative(distDir, filePath),
      bytes,
      gzipBytes,
    };
  })
  .sort((a, b) => b.gzipBytes - a.gzipBytes);

if (assets.length === 0) {
  console.error('Build asset report: no JavaScript assets were found.');
  process.exit(1);
}

const kib = (bytes) => (bytes / 1024).toFixed(1);
const totalBytes = assets.reduce((sum, asset) => sum + asset.bytes, 0);
const totalGzipBytes = assets.reduce((sum, asset) => sum + asset.gzipBytes, 0);
const mainEntry = assets.find((asset) => /^assets\/index-[^/]+\.js$/.test(asset.file));

const lines = [
  '## KCFC production build asset snapshot',
  '',
  `JavaScript assets: **${assets.length}**`,
  `Total JavaScript: **${kib(totalBytes)} KiB raw / ${kib(totalGzipBytes)} KiB gzip**`,
  mainEntry ? `Main application entry: **${mainEntry.file} — ${kib(mainEntry.bytes)} KiB raw / ${kib(mainEntry.gzipBytes)} KiB gzip**` : 'Main application entry: not separately identified by the standard Vite index naming pattern.',
  '',
  '| JavaScript asset | Raw KiB | Gzip KiB |',
  '| --- | ---: | ---: |',
  ...assets.map((asset) => `| \`${asset.file}\` | ${kib(asset.bytes)} | ${kib(asset.gzipBytes)} |`),
  '',
  '> This step is evidence/reporting. The existing Vite chunk-size warning remains enabled and is not suppressed by raising `chunkSizeWarningLimit`.',
  '',
];

const report = lines.join('\n');
console.log(report);
if (summaryPath) appendFileSync(summaryPath, report, 'utf8');
