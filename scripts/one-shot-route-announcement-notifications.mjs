import fs from 'node:fs';

function replaceOnce(source, before, after, label) {
  const parts = source.split(before);
  if (parts.length !== 2) throw new Error(`Refusing announcement routing patch: expected exactly one ${label} anchor.`);
  return `${parts[0]}${after}${parts[1]}`;
}

{
  const path = 'server.ts';
  let source = fs.readFileSync(path, 'utf8');
  source = replaceOnce(
    source,
    'import { registerMemberDirectorySyncRoutes } from "./server/memberDirectorySyncRoutes";\n',
    'import { registerMemberDirectorySyncRoutes } from "./server/memberDirectorySyncRoutes";\nimport { registerAnnouncementCommunicationRoutes } from "./server/announcementCommunicationRoutes";\n',
    'server import',
  );
  source = replaceOnce(
    source,
    '  registerMemberDirectorySyncRoutes(app, { auth: authAdmin, db: dbAdmin });\n',
    '  registerMemberDirectorySyncRoutes(app, { auth: authAdmin, db: dbAdmin });\n  registerAnnouncementCommunicationRoutes(app, {\n    auth: authAdmin,\n    db: dbAdmin,\n    staging: runtimeEnvironment === "staging",\n    getMessaging: () => getMessagingAdmin(appAdmin),\n    sendWebPush: sendWebPushNotification,\n  });\n',
    'server registration',
  );
  fs.writeFileSync(path, source, 'utf8');
}

{
  const path = 'src/pages/Announcements.tsx';
  let source = fs.readFileSync(path, 'utf8');
  for (const token of ['  getDocs,\n', '  writeBatch,\n']) source = source.replace(token, '');
  source = source.replace("import { Announcement, ConnectedCommunicationApp, NotificationPreferences } from '../types';", "import { Announcement } from '../types';");
  source = source.replace("import { buildCommunicationRoutingPlan } from '../lib/communicationRouting';\n", '');
  source = source.replace("import { buildNotificationRecord } from '../lib/notificationRecord';\n", '');
  source = source.replace("import { CommunicationAudience, isProfileEligibleForAudience } from '../lib/communicationAudience';", "import { CommunicationAudience } from '../lib/communicationAudience';");

  const helperStart = source.indexOf("const connectedProvidersFor = (apps?: ConnectedCommunicationApp[]) =>");
  const componentStart = source.indexOf('export default function Announcements()', helperStart);
  if (helperStart < 0 || componentStart < 0) throw new Error('Unable to locate obsolete announcement browser recipient helper.');
  source = source.slice(0, helperStart) + source.slice(componentStart);

  const publishStart = source.indexOf('  const publishNotifications = async (announcementId: string');
  const saveStart = source.indexOf('  const handleSave = async ', publishStart);
  if (publishStart < 0 || saveStart < 0) throw new Error('Unable to locate announcement publish notification block.');
  const replacement = [
    '  const publishNotifications = async (announcementId: string) => {',
    "    if (!user) throw new Error('A signed-in announcement creator is required.');",
    '    const idToken = await user.getIdToken();',
    "    const response = await fetch('/api/announcements/publish-notifications', {",
    "      method: 'POST',",
    '      headers: {',
    "        'Content-Type': 'application/json',",
    '        Authorization: `Bearer ${idToken}`,',
    '      },',
    '      body: JSON.stringify({ announcementId }),',
    '    });',
    '    if (!response.ok) {',
    '      const payload = await response.json().catch(() => ({}));',
    '      throw new Error(payload?.error || `Announcement notification dispatch failed (${response.status}).`);',
    '    }',
    '  };',
    '',
  ].join('\n');
  source = source.slice(0, publishStart) + replacement + source.slice(saveStart);
  source = source.replace(
    '        await publishNotifications(announcementId, form.title.trim(), form.audience, form.push);',
    '        await publishNotifications(announcementId);',
  );
  fs.writeFileSync(path, source, 'utf8');
}

{
  const path = 'scripts/verify-announcement-recipient-boundary.ts';
  const lines = [
    "import fs from 'node:fs';",
    '',
    "const browser = fs.readFileSync('src/pages/Announcements.tsx', 'utf8');",
    "for (const forbidden of [\"collection(db, 'users')\", 'getDocs(', 'fcmTokens', 'webPushSubscriptions', 'connectedCommunicationApps', 'recipientTokens']) {",
    "  if (browser.includes(forbidden)) throw new Error('Announcements browser must not resolve private recipient state: ' + forbidden);",
    '}',
    "for (const marker of [\"'/api/announcements/publish-notifications'\", 'body: JSON.stringify({ announcementId })']) {",
    "  if (!browser.includes(marker)) throw new Error('Announcements browser missing trusted routing marker: ' + marker);",
    '}',
    '',
    "const route = fs.readFileSync('server/announcementCommunicationRoutes.ts', 'utf8');",
    "for (const marker of [\"app.post('/api/announcements/publish-notifications'\", \"db.collection('users').get()\", 'isProfileEligibleForAudience', 'buildCommunicationRoutingPlan', 'notificationRef = db.collection(\\'notifications\\').doc', 'stagingSuppressed: staging']) {",
    "  if (!route.includes(marker)) throw new Error('Trusted announcement routing missing marker: ' + marker);",
    '}',
    "if (route.includes('req.body?.recipientTokens') || route.includes('req.body?.userIds')) throw new Error('Announcement notification route must not accept caller-selected recipient tokens or UIDs.');",
    '',
    "const server = fs.readFileSync('server.ts', 'utf8');",
    "if (!server.includes('registerAnnouncementCommunicationRoutes')) throw new Error('Server must register trusted announcement communication routes.');",
    '',
    "console.log('Announcement recipient boundary: PASS');",
    '',
  ];
  fs.writeFileSync(path, lines.join('\n'), 'utf8');
}

{
  const path = 'package.json';
  let source = fs.readFileSync(path, 'utf8');
  source = replaceOnce(
    source,
    'npx tsx scripts/verify-browser-secret-boundary.ts &&',
    'npx tsx scripts/verify-browser-secret-boundary.ts && npx tsx scripts/verify-announcement-recipient-boundary.ts &&',
    'lint announcement guard',
  );
  fs.writeFileSync(path, source, 'utf8');
}

console.log('Trusted announcement recipient routing patch: PASS');
