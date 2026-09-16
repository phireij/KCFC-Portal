import fs from 'node:fs';

const browser = fs.readFileSync('src/pages/Announcements.tsx', 'utf8');
for (const forbidden of ["collection(db, 'users')", 'getDocs(', 'fcmTokens', 'webPushSubscriptions', 'connectedCommunicationApps', 'recipientTokens']) {
  if (browser.includes(forbidden)) throw new Error('Announcements browser must not resolve private recipient state: ' + forbidden);
}
for (const marker of ["'/api/announcements/publish-notifications'", 'body: JSON.stringify({ announcementId })']) {
  if (!browser.includes(marker)) throw new Error('Announcements browser missing trusted routing marker: ' + marker);
}

const route = fs.readFileSync('server/announcementCommunicationRoutes.ts', 'utf8');
for (const marker of ["app.post('/api/announcements/publish-notifications'", "db.collection('users').get()", 'isProfileEligibleForAudience', 'buildCommunicationRoutingPlan', 'notificationRef = db.collection(\'notifications\').doc', 'stagingSuppressed: staging']) {
  if (!route.includes(marker)) throw new Error('Trusted announcement routing missing marker: ' + marker);
}
if (route.includes('req.body?.recipientTokens') || route.includes('req.body?.userIds')) throw new Error('Announcement notification route must not accept caller-selected recipient tokens or UIDs.');

const server = fs.readFileSync('server.ts', 'utf8');
if (!server.includes('registerAnnouncementCommunicationRoutes')) throw new Error('Server must register trusted announcement communication routes.');

console.log('Announcement recipient boundary: PASS');
