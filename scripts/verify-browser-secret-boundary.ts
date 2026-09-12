import fs from 'node:fs';
import path from 'node:path';

const viteSource = fs.readFileSync('vite.config.ts', 'utf8');

const forbiddenViteDefine = /process\.env\.[A-Z0-9_]*(?:API_KEY|SECRET|TOKEN|PRIVATE_KEY)/g;
const viteMatches = viteSource.match(forbiddenViteDefine) || [];
if (viteMatches.length > 0) {
  throw new Error(`Browser secret boundary violation in vite.config.ts: ${viteMatches.join(', ')}`);
}

if (viteSource.includes('process.env.GEMINI_API_KEY')) {
  throw new Error('GEMINI_API_KEY must never be injected into the browser bundle.');
}

const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const forbiddenBrowserEnv = /import\.meta\.env\.VITE_[A-Z0-9_]*(?:SECRET|ACCESS_TOKEN|BOT_TOKEN|VERIFY_TOKEN|CHANNEL_SECRET|PRIVATE_KEY)/g;

const scanDirectory = (directory: string) => {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      scanDirectory(absolute);
      continue;
    }
    if (!sourceExtensions.has(path.extname(entry.name))) continue;
    const source = fs.readFileSync(absolute, 'utf8');
    const matches = source.match(forbiddenBrowserEnv) || [];
    if (matches.length > 0) {
      throw new Error(`Browser secret boundary violation in ${absolute}: ${matches.join(', ')}`);
    }
  }
};

scanDirectory('src');

console.log('Browser provider-secret boundary: PASS');
