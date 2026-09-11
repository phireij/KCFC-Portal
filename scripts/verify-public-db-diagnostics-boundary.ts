import fs from 'node:fs';

const source = fs.readFileSync('server.ts', 'utf8');

const forbidden = [
  'app.get("/api/public/db-diagnostics"',
  'firebaseConfigFromFileKeys',
  'defaultDbUsers',
  'namedDbUsers',
];

for (const marker of forbidden) {
  if (source.includes(marker)) {
    throw new Error(`Public database diagnostics privacy regression: forbidden marker present: ${marker}`);
  }
}

const requiredHealthMarkers = [
  'app.get("/api/health"',
  'firebaseProjectId: targetProjectId',
  'firestoreDatabaseId: databaseId',
];

for (const marker of requiredHealthMarkers) {
  if (!source.includes(marker)) {
    throw new Error(`Safe runtime health identity marker missing: ${marker}`);
  }
}

console.log('Public database diagnostics boundary: PASS');
