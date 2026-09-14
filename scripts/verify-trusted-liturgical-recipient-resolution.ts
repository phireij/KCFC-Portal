import fs from 'node:fs';
import {
  availabilityCompletionRecipientIds,
  buildTrustedLiturgicalCommunicationPlan,
  eligibleLiturgicalMemberIds,
  publicLiturgicalCommunicationSummary,
} from '../server/liturgicalCommunicationService';
import type { UserProfile } from '../src/types';

const privateProfiles: UserProfile[] = [
  {
    uid: 'admin-1', email: 'admin@example.com', displayName: 'Admin', photoURL: '', roles: ['admin'], ministries: [],
    isVerified: true, createdAt: '', updatedAt: '', preferences: { announcements: true, duties: true, broadcasts: true, availability: true, assignments: true },
    fcmTokens: ['PRIVATE_ADMIN_TOKEN'],
  },
  {
    uid: 'president-1', email: 'president@example.com', displayName: 'President', photoURL: '', roles: ['president'], ministries: [],
    isVerified: true, createdAt: '', updatedAt: '', preferences: { announcements: true, duties: true, broadcasts: true, availability: true, assignments: true },
    fcmTokens: ['PRIVATE_PRESIDENT_TOKEN'],
  },
  {
    uid: 'lector-1', email: 'lector@example.com', displayName: 'Lector', photoURL: '', roles: ['member'], ministries: ['lector_commentator'],
    isVerified: true, createdAt: '', updatedAt: '', preferences: { announcements: true, duties: true, broadcasts: true, availability: true, assignments: true },
    fcmTokens: ['PRIVATE_LECTOR_TOKEN'],
  },
  {
    uid: 'usher-1', email: 'usher@example.com', displayName: 'Usher', photoURL: '', roles: ['member'], ministries: ['usher'],
    isVerified: true, createdAt: '', updatedAt: '', preferences: { announcements: true, duties: true, broadcasts: true, availability: false, assignments: true, emailPartner: false },
    fcmTokens: ['PRIVATE_USHER_TOKEN'],
  },
  {
    uid: 'regular-1', email: 'regular@example.com', displayName: 'Regular', photoURL: '', roles: ['member'], ministries: [],
    isVerified: true, createdAt: '', updatedAt: '', fcmTokens: ['PRIVATE_REGULAR_TOKEN'],
  },
  {
    uid: 'disabled-1', email: 'disabled@example.com', displayName: 'Disabled', photoURL: '', roles: ['member'], ministries: ['altar_server'],
    isVerified: true, isDisabled: true, createdAt: '', updatedAt: '', fcmTokens: ['PRIVATE_DISABLED_TOKEN'],
  },
  {
    uid: 'bootstrap', email: 'kcfc.jp@gmail.com', displayName: 'Bootstrap', photoURL: '', roles: ['admin'], ministries: ['usher'],
    isVerified: true, createdAt: '', updatedAt: '', fcmTokens: ['PRIVATE_BOOTSTRAP_TOKEN'],
  },
];

const eligible = eligibleLiturgicalMemberIds(privateProfiles);
if (JSON.stringify(eligible) !== JSON.stringify(['lector-1', 'usher-1'])) {
  throw new Error(`Unexpected liturgical eligibility: ${JSON.stringify(eligible)}`);
}

const completion = availabilityCompletionRecipientIds(privateProfiles, 'lector-1');
if (JSON.stringify(completion) !== JSON.stringify(['admin-1', 'bootstrap', 'lector-1', 'president-1'])) {
  throw new Error(`Unexpected availability-completion recipients: ${JSON.stringify(completion)}`);
}

const availabilityPlan = buildTrustedLiturgicalCommunicationPlan({
  kind: 'availability_request',
  poll: { id: 'poll-1', title: 'October Mass Availability' },
  profiles: privateProfiles,
});
if (availabilityPlan.notifications.length !== 2) throw new Error('Availability request must create two Inbox notification plans.');
if (!availabilityPlan.pushTokens.includes('PRIVATE_LECTOR_TOKEN')) throw new Error('Trusted resolver should retain eligible private push material internally.');
if (availabilityPlan.pushTokens.includes('PRIVATE_USHER_TOKEN')) throw new Error('Muted availability preference must suppress Usher secondary push delivery.');
if (availabilityPlan.affectedUserIds.includes('bootstrap')) throw new Error('Bootstrap account must not enter ordinary liturgical eligibility.');

const completionPlan = buildTrustedLiturgicalCommunicationPlan({
  kind: 'availability_complete',
  poll: { id: 'poll-1', title: 'October Mass Availability', createdBy: 'lector-1' },
  profiles: privateProfiles,
});
if (!completionPlan.affectedUserIds.includes('bootstrap')) {
  throw new Error('Bootstrap admin must retain trusted leadership-notification semantics.');
}

const initialPlan = buildTrustedLiturgicalCommunicationPlan({
  kind: 'assignment_publish',
  poll: {
    id: 'poll-1',
    title: 'October Mass Availability',
    assignments: { '2026-10-04': { 'lector-1': 'Lector 1', 'usher-1': 'Usher 1' } },
  },
  profiles: privateProfiles,
});
if (initialPlan.mode !== 'initial' || initialPlan.affectedUserIds.length !== 2) {
  throw new Error('Initial roster publication must target all assigned active members.');
}

const revisionPlan = buildTrustedLiturgicalCommunicationPlan({
  kind: 'assignment_publish',
  poll: {
    id: 'poll-1',
    title: 'October Mass Availability',
    rosterRevision: 1,
    lastPublishedAssignments: { '2026-10-04': { 'lector-1': 'Lector 1' } },
    assignments: { '2026-10-04': { 'usher-1': 'Usher 1' } },
  },
  profiles: privateProfiles,
});
if (revisionPlan.mode !== 'revision' || JSON.stringify(revisionPlan.affectedUserIds) !== JSON.stringify(['lector-1', 'usher-1'])) {
  throw new Error(`Revision must target removed and newly assigned members: ${JSON.stringify(revisionPlan.affectedUserIds)}`);
}

const publicSummary = publicLiturgicalCommunicationSummary(availabilityPlan);
const publicJson = JSON.stringify(publicSummary);
for (const privateValue of [
  'admin@example.com', 'lector@example.com', 'usher@example.com',
  'PRIVATE_ADMIN_TOKEN', 'PRIVATE_LECTOR_TOKEN', 'PRIVATE_USHER_TOKEN', 'PRIVATE_BOOTSTRAP_TOKEN',
]) {
  if (publicJson.includes(privateValue)) {
    throw new Error(`Public liturgical communication summary leaked private recipient material: ${privateValue}`);
  }
}
for (const forbiddenKey of ['pushTokens', 'fcmTokens', 'email', 'emails', 'userIds', 'affectedUserIds']) {
  if (Object.prototype.hasOwnProperty.call(publicSummary, forbiddenKey)) {
    throw new Error(`Public liturgical communication summary must not expose private/target identifiers: ${forbiddenKey}`);
  }
}

const serverSource = fs.readFileSync('server.ts', 'utf8');
const registrationImport = 'import { registerLiturgicalCommunicationRoutes } from "./server/liturgicalCommunicationRoutes";';
const registrationCall = 'registerLiturgicalCommunicationRoutes(app, { auth: authAdmin, db: dbAdmin });';
if (!serverSource.includes(registrationImport)) {
  throw new Error('Trusted liturgical communication routes must remain imported by server.ts.');
}
if (!serverSource.includes(registrationCall)) {
  throw new Error('Trusted liturgical communication routes must remain registered in startServer().');
}
if ((serverSource.match(/registerLiturgicalCommunicationRoutes/g) || []).length !== 2) {
  throw new Error('Expected exactly one liturgical route import and one registration call in server.ts.');
}
if (fs.existsSync('.github/workflows/one-shot-register-liturgical-routes.yml') || fs.existsSync('scripts/one-shot-register-liturgical-routes.mjs')) {
  throw new Error('Temporary one-shot route integration machinery must not remain in the repository.');
}

console.log('Trusted liturgical recipient resolution + server registration: PASS');