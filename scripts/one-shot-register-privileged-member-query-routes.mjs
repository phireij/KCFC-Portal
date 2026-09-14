import fs from 'node:fs';

function replaceOnce(source, before, after, label) {
  const parts = source.split(before);
  if (parts.length !== 2) throw new Error(`Refusing privileged member route registration: expected exactly one ${label} anchor.`);
  return `${parts[0]}${after}${parts[1]}`;
}

const path = 'server.ts';
let source = fs.readFileSync(path, 'utf8');
source = replaceOnce(
  source,
  'import { registerAnnouncementCommunicationRoutes } from "./server/announcementCommunicationRoutes";\n',
  'import { registerAnnouncementCommunicationRoutes } from "./server/announcementCommunicationRoutes";\nimport { registerPrivilegedMemberQueryRoutes } from "./server/privilegedMemberQueryRoutes";\n',
  'server import',
);
source = replaceOnce(
  source,
  '  registerMemberDirectorySyncRoutes(app, { auth: authAdmin, db: dbAdmin });\n',
  '  registerMemberDirectorySyncRoutes(app, { auth: authAdmin, db: dbAdmin });\n  registerPrivilegedMemberQueryRoutes(app, { auth: authAdmin, db: dbAdmin });\n',
  'server registration',
);
fs.writeFileSync(path, source, 'utf8');
console.log('Privileged member query route registration: PASS');
