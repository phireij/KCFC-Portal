import { readFileSync } from 'node:fs';

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`KCFC staging preflight: missing required environment variable ${name}.`);
  return value;
}

function expectFalse(name) {
  const value = String(process.env[name] ?? 'false').trim().toLowerCase();
  if (value !== 'false') {
    throw new Error(`KCFC staging preflight: ${name} must be false for isolated QA (received ${JSON.stringify(value)}).`);
  }
}

const committedConfig = JSON.parse(readFileSync(new URL('../firebase-applet-config.json', import.meta.url), 'utf8'));
const committedProjectId = String(committedConfig.projectId || '').trim();

const clientRuntime = required('VITE_KCFC_RUNTIME_ENV').toLowerCase();
const serverRuntime = required('KCFC_RUNTIME_ENV').toLowerCase();
if (clientRuntime !== 'staging' || serverRuntime !== 'staging') {
  throw new Error('KCFC staging preflight: both VITE_KCFC_RUNTIME_ENV and KCFC_RUNTIME_ENV must equal "staging".');
}

const appUrlRaw = required('APP_URL');
let appUrl;
try {
  appUrl = new URL(appUrlRaw);
} catch {
  throw new Error('KCFC staging preflight: APP_URL must be a valid absolute URL.');
}
if (appUrl.protocol !== 'https:') {
  throw new Error('KCFC staging preflight: APP_URL must use HTTPS for PWA/Web Push QA.');
}
const productionPortalHostnames = new Set(['portal.kcfcjp.com', 'www.portal.kcfcjp.com']);
if (productionPortalHostnames.has(appUrl.hostname.toLowerCase())) {
  throw new Error('KCFC staging preflight: APP_URL must not target the production KCFC Portal hostname.');
}

const clientProjectId = required('VITE_FIREBASE_PROJECT_ID');
const serverProjectId = required('FIREBASE_PROJECT_ID');
required('VITE_FIREBASE_API_KEY');
required('FIREBASE_API_KEY');
required('VITE_FIREBASE_AUTH_DOMAIN');
required('VITE_FIREBASE_APP_ID');
required('VITE_FIREBASE_MESSAGING_SENDER_ID');

if (clientProjectId !== serverProjectId) {
  throw new Error(`KCFC staging preflight: client/server Firebase project mismatch (${clientProjectId} vs ${serverProjectId}).`);
}
if (!committedProjectId) {
  throw new Error('KCFC staging preflight: committed Firebase project ID is unavailable; cannot prove isolation.');
}
if (clientProjectId === committedProjectId) {
  throw new Error('KCFC staging preflight: staging Firebase project must differ from the committed production/default project.');
}

const clientDatabaseId = String(process.env.VITE_FIREBASE_DATABASE_ID || '').trim();
const serverDatabaseId = String(process.env.FIREBASE_DATABASE_ID || '').trim();
if (clientDatabaseId !== serverDatabaseId) {
  throw new Error(`KCFC staging preflight: client/server Firestore database ID mismatch (${clientDatabaseId || '(default)'} vs ${serverDatabaseId || '(default)'}).`);
}

required('VITE_FCM_VAPID_KEY');
const serverVapidPublic = String(process.env.WEB_PUSH_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || '').trim();
const serverVapidPrivate = String(process.env.WEB_PUSH_VAPID_PRIVATE_KEY || process.env.VAPID_PRIVATE_KEY || '').trim();
if (!serverVapidPublic || !serverVapidPrivate) {
  throw new Error('KCFC staging preflight: explicit server VAPID public/private keys are required for isolated notification QA.');
}
if (String(process.env.VITE_FCM_VAPID_KEY || '').trim() !== serverVapidPublic) {
  throw new Error('KCFC staging preflight: browser VAPID public key must match the server staging VAPID public key.');
}

expectFalse('KCFC_CORE_STATUS_STAGING_EXECUTOR_ENABLED');
for (const name of [
  'KCFC_CONNECTOR_LINE_ENABLED',
  'KCFC_CONNECTOR_TELEGRAM_ENABLED',
  'KCFC_CONNECTOR_WHATSAPP_ENABLED',
  'KCFC_CONNECTOR_VIBER_ENABLED',
  'VITE_KCFC_LINE_CONNECTOR_ENABLED',
  'VITE_KCFC_TELEGRAM_CONNECTOR_ENABLED',
  'VITE_KCFC_WHATSAPP_CONNECTOR_ENABLED',
  'VITE_KCFC_VIBER_CONNECTOR_ENABLED',
]) {
  expectFalse(name);
}

console.log('KCFC staging preflight PASS');
console.log(`Application URL host: ${appUrl.hostname}`);
console.log(`Firebase project: ${clientProjectId}`);
console.log(`Firestore database: ${clientDatabaseId || '(default)'}`);
console.log('Runtime markers: client=staging, server=staging');
console.log('External connectors: OFF');
console.log('Core status staging executor: OFF');
console.log('VAPID: explicit client/server staging keys present and public keys match');
