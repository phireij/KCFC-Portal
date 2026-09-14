import fs from 'node:fs';
import { MEMBER_DIRECTORY_PUBLIC_FIELDS, toMemberDirectoryProfile } from '../src/lib/memberPublicProjection';

const privateSentinels = {
  email: 'private@example.com',
  birthdate: '1990-01-01',
  homeAddress: 'PRIVATE HOME ADDRESS',
  phoneNumber: '+81-PRIVATE-PHONE',
  preferences: { announcements: true },
  fcmTokens: ['PRIVATE_FCM_TOKEN'],
  webPushSubscriptions: [{ endpoint: 'PRIVATE_WEB_PUSH_ENDPOINT' }],
  connectedCommunicationApps: [{ provider: 'telegram', displayName: 'PRIVATE_HANDLE' }],
};

const projected = toMemberDirectoryProfile('member-123', {
  ...privateSentinels,
  displayName: 'Visible Member',
  photoURL: 'https://example.invalid/photo.jpg',
  nickname: 'Visible Nickname',
  roles: ['member', 'usher_leader'],
  ministries: ['usher'],
  isCoreMember: true,
  isVerified: true,
  isDisabled: false,
});

if (!projected) throw new Error('Expected verified enabled member to produce a public projection.');

const actualKeys = Object.keys(projected).sort();
const allowedKeys = [...MEMBER_DIRECTORY_PUBLIC_FIELDS].sort();
if (JSON.stringify(actualKeys) !== JSON.stringify(allowedKeys)) {
  throw new Error(`Unexpected member-directory fields. Expected ${allowedKeys.join(', ')}; received ${actualKeys.join(', ')}`);
}

const serialized = JSON.stringify(projected);
for (const sentinel of [
  privateSentinels.email,
  privateSentinels.birthdate,
  privateSentinels.homeAddress,
  privateSentinels.phoneNumber,
  privateSentinels.fcmTokens[0],
  privateSentinels.webPushSubscriptions[0].endpoint,
  privateSentinels.connectedCommunicationApps[0].displayName,
]) {
  if (serialized.includes(sentinel)) throw new Error(`Private member data leaked into public projection: ${sentinel}`);
}

if (toMemberDirectoryProfile('pending-member', { displayName: 'Pending', isVerified: false }) !== null) {
  throw new Error('Unverified members must not appear in the member directory projection.');
}

if (toMemberDirectoryProfile('disabled-member', { displayName: 'Disabled', isVerified: true, isDisabled: true }) !== null) {
  throw new Error('Disabled members must not appear in the member directory projection.');
}

if (toMemberDirectoryProfile('bootstrap-admin', {
  email: 'KCFC.JP@GMAIL.COM',
  displayName: 'Bootstrap',
  isVerified: true,
}) !== null) {
  throw new Error('Bootstrap service/admin identity must not appear in the member directory projection.');
}

const firestoreRules = fs.readFileSync('firestore.rules', 'utf8');
const projectionStart = firestoreRules.indexOf('match /member_directory/{userId}');
const projectionEnd = firestoreRules.indexOf('// --- Polls Collection ---', projectionStart);
if (projectionStart < 0 || projectionEnd < 0) {
  throw new Error('Firestore rules must contain a bounded member_directory rule block.');
}
const projectionRules = firestoreRules.slice(projectionStart, projectionEnd);
if (!projectionRules.includes('allow read: if isApproved();')) {
  throw new Error('member_directory reads must remain restricted to approved authenticated members.');
}
if (!projectionRules.includes('allow create, update: if isAdmin() && isValidMemberDirectoryProfile(incoming());')) {
  throw new Error('member_directory writes must remain restricted to validated administrative writes.');
}
if (!projectionRules.includes('allow delete: if isAdmin();')) {
  throw new Error('member_directory deletion must remain administrative.');
}
for (const field of MEMBER_DIRECTORY_PUBLIC_FIELDS) {
  if (!projectionRules.includes(`'${field}'`)) {
    throw new Error(`Firestore member_directory allowlist is missing public field: ${field}`);
  }
}
for (const privateField of [
  'email', 'birthdate', 'homeAddress', 'phoneNumber', 'preferences',
  'fcmTokens', 'webPushSubscriptions', 'connectedCommunicationApps',
]) {
  if (projectionRules.includes(`'${privateField}'`)) {
    throw new Error(`Private field must not be allowed in member_directory rules: ${privateField}`);
  }
}

console.log('Member public projection boundary: PASS');
