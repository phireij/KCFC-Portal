import fs from 'node:fs';

const source = fs.readFileSync('server.ts', 'utf8');

const required = [
  'app.get("/api/health", (req, res) => {',
  'runtime: runtimeEnvironment',
  'firebaseProjectId: targetProjectId',
  'firestoreDatabaseId: databaseId',
  'const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";',
];

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(`Health runtime identity marker missing: ${marker}`);
  }
}

const healthStart = source.indexOf('app.get("/api/health"');
const healthEnd = source.indexOf('app.get("/api/client-id"', healthStart);
if (healthStart < 0 || healthEnd < 0) {
  throw new Error('Unable to isolate /api/health response block');
}
const healthBlock = source.slice(healthStart, healthEnd);

const forbidden = [
  'apiKey',
  'privateKey',
  'vapid',
  'token',
  'secret',
  'credential',
  'authDomain',
  'messagingSenderId',
  'appId',
];
for (const marker of forbidden) {
  if (healthBlock.toLowerCase().includes(marker.toLowerCase())) {
    throw new Error(`Health endpoint exposes forbidden configuration material: ${marker}`);
  }
}

console.log('Health runtime identity boundary: PASS');
