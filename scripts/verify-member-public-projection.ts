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

console.log('Member public projection boundary: PASS');
