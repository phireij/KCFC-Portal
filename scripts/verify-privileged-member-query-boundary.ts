import fs from 'node:fs';

const client = fs.readFileSync('src/lib/privilegedMemberQueries.ts', 'utf8');
for (const forbidden of [
  "from 'firebase/firestore'",
  "collection(db, 'users')",
  'getDocs(',
  'onSnapshot(',
  'where(',
]) {
  if (client.includes(forbidden)) {
    throw new Error(`Privileged member summary client must not query private users directly: ${forbidden}`);
  }
}
for (const marker of [
  "'/api/admin/member-summaries/pending'",
  "'/api/admin/member-summaries/poll-email-recipients'",
]) {
  if (!client.includes(marker)) throw new Error(`Privileged member summary client missing trusted route: ${marker}`);
}

const route = fs.readFileSync('server/privilegedMemberQueryRoutes.ts', 'utf8');
for (const marker of [
  "app.post('/api/admin/member-summaries/pending'",
  "app.post('/api/admin/member-summaries/poll-email-recipients'",
  "db.collection('users').where('isVerified', '==', false).get()",
  "db.collection('users').where('isVerified', '==', true).get()",
]) {
  if (!route.includes(marker)) throw new Error(`Trusted privileged member summary route missing marker: ${marker}`);
}
for (const privateField of [
  'birthdate',
  'homeAddress',
  'phoneNumber',
  'fcmTokens',
  'webPushSubscriptions',
  'connectedCommunicationApps',
  'preferences',
]) {
  if (route.includes(`${privateField},`) || route.includes(`${privateField}:`)) {
    throw new Error(`Privileged member summary response must not expose private field: ${privateField}`);
  }
}

const server = fs.readFileSync('server.ts', 'utf8');
if (!server.includes('registerPrivilegedMemberQueryRoutes')) {
  throw new Error('Server must register privileged member summary routes.');
}

console.log('Privileged member query boundary: PASS');
