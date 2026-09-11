import { readFileSync } from 'node:fs';

const sw = readFileSync('public/firebase-messaging-sw.js', 'utf8');
const client = readFileSync('src/lib/fcmClient.ts', 'utf8');

const forbiddenWorkerFragments = [
  'firebase.initializeApp',
  'initializeApp(',
  'firebaseConfig',
  'projectId',
  'messagingSenderId',
  'importScripts("https://www.gstatic.com/firebasejs',
  "importScripts('https://www.gstatic.com/firebasejs",
  'VITE_FIREBASE_',
  'FIREBASE_PROJECT_ID',
];

for (const fragment of forbiddenWorkerFragments) {
  if (sw.includes(fragment)) {
    throw new Error(`Web Push service worker must remain Firebase-project agnostic; forbidden fragment found: ${fragment}`);
  }
}

const requiredWorkerFragments = [
  "self.addEventListener('push'",
  'self.registration.showNotification',
  "self.addEventListener('notificationclick'",
  'self.location.origin',
];

for (const fragment of requiredWorkerFragments) {
  if (!sw.includes(fragment)) {
    throw new Error(`Web Push service worker contract missing required fragment: ${fragment}`);
  }
}

const registrationPattern = /navigator\.serviceWorker\.register\(["']\/firebase-messaging-sw\.js["'],\s*\{\s*scope:\s*["']\/["']\s*\}\)/g;
const registrations = client.match(registrationPattern) || [];
if (registrations.length < 1) {
  throw new Error('FCM/Web Push client must register /firebase-messaging-sw.js with root scope.');
}

const registerCalls = client.match(/navigator\.serviceWorker\.register\(/g) || [];
if (registerCalls.length !== registrations.length) {
  throw new Error('All service-worker registrations in fcmClient.ts must use the canonical same-origin /firebase-messaging-sw.js root-scope worker.');
}

if (client.includes('serviceWorker.register("http://') || client.includes("serviceWorker.register('http://") ||
    client.includes('serviceWorker.register("https://') || client.includes("serviceWorker.register('https://")) {
  throw new Error('Notification service worker must never be registered from a cross-origin URL.');
}

console.log(`Web Push service worker boundary verified (${registrations.length} canonical registration call(s)).`);
