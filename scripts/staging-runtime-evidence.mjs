import { readFileSync } from 'node:fs';

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`KCFC staging runtime evidence: missing required environment variable ${name}.`);
  return value;
}

const healthPath = process.argv[2];
if (!healthPath) {
  throw new Error('KCFC staging runtime evidence: provide the saved /api/health JSON path. Example: npm run staging:evidence -- /tmp/kcfc-staging-health.json');
}

const clientRuntime = required('VITE_KCFC_RUNTIME_ENV').toLowerCase();
const serverRuntime = required('KCFC_RUNTIME_ENV').toLowerCase();
if (clientRuntime !== 'staging' || serverRuntime !== 'staging') {
  throw new Error('KCFC staging runtime evidence: both runtime markers must equal "staging".');
}

const appUrlRaw = required('APP_URL');
let appUrl;
try {
  appUrl = new URL(appUrlRaw);
} catch {
  throw new Error('KCFC staging runtime evidence: APP_URL must be a valid absolute URL.');
}
if (appUrl.protocol !== 'https:') {
  throw new Error('KCFC staging runtime evidence: APP_URL must use HTTPS.');
}
const productionPortalHostnames = new Set(['portal.kcfcjp.com', 'www.portal.kcfcjp.com']);
if (productionPortalHostnames.has(appUrl.hostname.toLowerCase())) {
  throw new Error('KCFC staging runtime evidence: APP_URL must not target the production KCFC Portal hostname.');
}

const clientProjectId = required('VITE_FIREBASE_PROJECT_ID');
const serverProjectId = required('FIREBASE_PROJECT_ID');
if (clientProjectId !== serverProjectId) {
  throw new Error('KCFC staging runtime evidence: client/server Firebase project IDs do not match.');
}

const clientDatabaseId = String(process.env.VITE_FIREBASE_DATABASE_ID || '').trim();
const serverDatabaseId = String(process.env.FIREBASE_DATABASE_ID || '').trim();
if (clientDatabaseId !== serverDatabaseId) {
  throw new Error('KCFC staging runtime evidence: client/server Firestore database IDs do not match.');
}
const expectedDatabaseId = clientDatabaseId || '(default)';

let health;
try {
  health = JSON.parse(readFileSync(healthPath, 'utf8'));
} catch (error) {
  throw new Error(`KCFC staging runtime evidence: unable to read valid JSON from ${healthPath}: ${error instanceof Error ? error.message : String(error)}`);
}

if (!health || typeof health !== 'object' || Array.isArray(health)) {
  throw new Error('KCFC staging runtime evidence: health payload must be a JSON object.');
}

const allowedFields = new Set(['status', 'time', 'runtime', 'firebaseProjectId', 'firestoreDatabaseId']);
const unexpectedFields = Object.keys(health).filter((key) => !allowedFields.has(key));
if (unexpectedFields.length > 0) {
  throw new Error(`KCFC staging runtime evidence: health payload contains unexpected field(s): ${unexpectedFields.join(', ')}.`);
}

if (health.status !== 'ok') {
  throw new Error(`KCFC staging runtime evidence: expected health status "ok", received ${JSON.stringify(health.status)}.`);
}
if (health.runtime !== 'staging') {
  throw new Error(`KCFC staging runtime evidence: expected health runtime "staging", received ${JSON.stringify(health.runtime)}.`);
}
if (health.firebaseProjectId !== clientProjectId) {
  throw new Error('KCFC staging runtime evidence: deployed Firebase project ID does not match the protected staging environment.');
}
if (health.firestoreDatabaseId !== expectedDatabaseId) {
  throw new Error('KCFC staging runtime evidence: deployed Firestore database ID does not match the protected staging environment.');
}
if (typeof health.time !== 'string' || Number.isNaN(Date.parse(health.time))) {
  throw new Error('KCFC staging runtime evidence: health time must be a valid timestamp string.');
}

console.log('KCFC staging runtime evidence PASS');
console.log(`Application URL host: ${appUrl.hostname}`);
console.log(`Firebase project: ${clientProjectId}`);
console.log(`Firestore database: ${expectedDatabaseId}`);
console.log('Runtime markers: client=staging, server=staging');
console.log('Health status: ok');
console.log('Health runtime: staging');
console.log('Health response fields: status,time,runtime,firebaseProjectId,firestoreDatabaseId');
