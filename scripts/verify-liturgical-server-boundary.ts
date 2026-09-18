import fs from 'node:fs';

const routeSource = fs.readFileSync('server/liturgicalCommunicationRoutes.ts', 'utf8');
const serviceSource = fs.readFileSync('server/liturgicalCommunicationService.ts', 'utf8');

for (const endpoint of [
  '/api/liturgical/availability-request/notify',
  '/api/liturgical/availability-complete/notify',
  '/api/liturgical/roster/plan',
  '/api/liturgical/roster/publish',
]) {
  if (!routeSource.includes(endpoint)) throw new Error(`Trusted liturgical route missing: ${endpoint}`);
}

const bodyFieldMatches = Array.from(routeSource.matchAll(/request\.body\?\.([A-Za-z0-9_]+)/g)).map((match) => match[1]);
const unexpectedBodyFields = Array.from(new Set(bodyFieldMatches.filter((field) => field !== 'pollId')));
if (unexpectedBodyFields.length > 0) {
  throw new Error(`Liturgical routes must not accept caller-selected recipient/delivery fields: ${unexpectedBodyFields.join(', ')}`);
}

for (const forbidden of [
  'recipientTokens',
  'pushTokens:',
  'fcmTokens:',
  'emails:',
  'affectedUserIds:',
]) {
  if (routeSource.includes(forbidden)) {
    throw new Error(`Liturgical route must not expose or accept private recipient material: ${forbidden}`);
  }
}

if (!routeSource.includes('publicLiturgicalCommunicationSummary(plan)')) {
  throw new Error('Liturgical routes must return the privacy-safe aggregate communication summary.');
}
if (routeSource.includes('response.json(plan)')) {
  throw new Error('Liturgical routes must never serialize the internal recipient plan.');
}
if (!routeSource.includes("db.collection('users').get()")) {
  throw new Error('Trusted server boundary must derive recipient state from the private users collection server-side.');
}
if (!routeSource.includes('materializeNotificationRecord(record, FieldValue.serverTimestamp())')) {
  throw new Error('Trusted server boundary must preserve queued delivery diagnostics on Inbox notification creation.');
}
if (!routeSource.includes('availabilityRequestNotifiedAt') || !routeSource.includes('availabilityCompletionNotifiedAt')) {
  throw new Error('Availability notification routes must retain idempotency markers.');
}
if (!routeSource.includes('db.runTransaction')) {
  throw new Error('Trusted liturgical writes must retain transaction boundaries for idempotent notification/publication updates.');
}

if (!serviceSource.includes('publicLiturgicalCommunicationSummary')) {
  throw new Error('Trusted recipient resolver must define a browser-safe summary boundary.');
}
if (!serviceSource.includes('pushTokens: string[]')) {
  throw new Error('Trusted recipient resolver must keep private push material internal for later transport execution.');
}

console.log('Liturgical trusted server boundary: PASS');
