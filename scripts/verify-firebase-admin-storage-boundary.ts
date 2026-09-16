import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const roots = ['server.ts', 'src'];
const sourceFiles: string[] = [];

function collect(path: string) {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(path)) collect(join(path, entry));
    return;
  }
  if (/\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(path)) sourceFiles.push(path);
}

for (const root of roots) collect(root);

const forbidden: Array<{ label: string; pattern: RegExp }> = [
  { label: 'Firebase Admin Storage module import', pattern: /firebase-admin\/storage/ },
  { label: 'direct @google-cloud/storage import', pattern: /@google-cloud\/storage/ },
  { label: 'Firebase Admin getStorage API', pattern: /\bgetStorage\s*\(/ },
];

const violations: string[] = [];
for (const file of sourceFiles) {
  const content = readFileSync(file, 'utf8');
  for (const rule of forbidden) {
    if (rule.pattern.test(content)) {
      violations.push(`${relative('.', file)}: ${rule.label}`);
    }
  }
}

if (violations.length > 0) {
  console.error('Firebase Admin Storage is currently security-dispositioned as an unused optional dependency path.');
  console.error('Importing or activating Storage requires reopening dependency reachability review first.');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(`Firebase Admin Storage boundary verified across ${sourceFiles.length} source files: no Storage import/API activation found.`);
