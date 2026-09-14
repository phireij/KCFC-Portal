import type { User } from 'firebase/auth';
import {
  MEMBER_DIRECTORY_PUBLIC_FIELDS,
  type MemberDirectoryProfile,
} from './memberPublicProjection';

const allowedKeys = new Set<string>(MEMBER_DIRECTORY_PUBLIC_FIELDS);

function parseMemberDirectoryProfile(input: unknown): MemberDirectoryProfile {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Member directory returned an invalid member record.');
  }

  const record = input as Record<string, unknown>;
  const unexpectedKeys = Object.keys(record).filter((key) => !allowedKeys.has(key));
  if (unexpectedKeys.length > 0) {
    throw new Error(`Member directory returned non-public fields: ${unexpectedKeys.join(', ')}`);
  }

  if (
    typeof record.uid !== 'string' ||
    typeof record.displayName !== 'string' ||
    typeof record.photoURL !== 'string' ||
    (record.nickname !== undefined && typeof record.nickname !== 'string') ||
    !Array.isArray(record.roles) ||
    !record.roles.every((role) => typeof role === 'string') ||
    !Array.isArray(record.ministries) ||
    !record.ministries.every((ministry) => typeof ministry === 'string') ||
    typeof record.isCoreMember !== 'boolean'
  ) {
    throw new Error('Member directory returned a malformed public member record.');
  }

  return record as MemberDirectoryProfile;
}

export async function fetchMemberDirectory(user: User): Promise<MemberDirectoryProfile[]> {
  const idToken = await user.getIdToken();
  const response = await fetch('/api/member-directory', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Member directory request failed with HTTP ${response.status}.`);
  }

  const body = await response.json() as { members?: unknown };
  if (!Array.isArray(body.members)) {
    throw new Error('Member directory response is missing the members array.');
  }

  return body.members.map(parseMemberDirectoryProfile);
}
