import { collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import {
  MEMBER_DIRECTORY_PUBLIC_FIELDS,
  type MemberDirectoryProfile,
} from './memberPublicProjection';

const allowedKeys = new Set<string>(MEMBER_DIRECTORY_PUBLIC_FIELDS);

function parseMemberDirectoryProfile(documentId: string, input: unknown): MemberDirectoryProfile {
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
    record.uid !== documentId ||
    typeof record.displayName !== 'string' ||
    typeof record.photoURL !== 'string' ||
    (record.nickname !== undefined && typeof record.nickname !== 'string') ||
    !Array.isArray(record.roles) ||
    !record.roles.every((role) => typeof role === 'string') ||
    !Array.isArray(record.ministries) ||
    !record.ministries.every((ministry) => typeof ministry === 'string') ||
    !Array.isArray(record.lcRoles) ||
    !record.lcRoles.every((role) => typeof role === 'string') ||
    typeof record.isCoreMember !== 'boolean'
  ) {
    throw new Error('Member directory returned a malformed public member record.');
  }

  return record as MemberDirectoryProfile;
}

export function subscribeMemberDirectory(
  onMembers: (members: MemberDirectoryProfile[]) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    collection(db, 'member_directory'),
    (snapshot) => {
      try {
        const members = snapshot.docs
          .map((document) => parseMemberDirectoryProfile(document.id, document.data()))
          .sort((a, b) => a.displayName.localeCompare(b.displayName));
        onMembers(members);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Member directory parsing failed.'));
      }
    },
    (error) => onError?.(error),
  );
}