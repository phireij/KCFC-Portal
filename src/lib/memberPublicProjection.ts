import type { MinistryType, UserRole } from '../types';

export type MemberDirectoryProfile = {
  uid: string;
  displayName: string;
  photoURL: string;
  nickname?: string;
  roles: UserRole[];
  ministries: MinistryType[];
  isCoreMember: boolean;
};

export const MEMBER_DIRECTORY_PUBLIC_FIELDS = [
  'uid',
  'displayName',
  'photoURL',
  'nickname',
  'roles',
  'ministries',
  'isCoreMember',
] as const;

const strings = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const optionalString = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

export function toMemberDirectoryProfile(
  uid: string,
  data: Record<string, unknown>,
): MemberDirectoryProfile | null {
  if (!uid) return null;
  if (data.isVerified !== true || data.isDisabled === true) return null;

  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  if (email === 'kcfc.jp@gmail.com') return null;

  return {
    uid,
    displayName: optionalString(data.displayName) || 'KCFC Member',
    photoURL: optionalString(data.photoURL) || '',
    ...(optionalString(data.nickname) ? { nickname: optionalString(data.nickname) } : {}),
    roles: strings(data.roles) as UserRole[],
    ministries: strings(data.ministries) as MinistryType[],
    isCoreMember: data.isCoreMember === true,
  };
}
