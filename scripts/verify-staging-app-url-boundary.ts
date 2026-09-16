import fs from 'node:fs';

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

console.log('Staging application URL boundary: PASS');
