import type { UserRole } from '../types';

export type CommunicationAudience = 'public' | 'parishioners' | 'kcfc_members' | 'leadership';

export type CommunicationAudienceProfile = {
  isDisabled?: boolean;
  isVerified?: boolean;
  roles?: UserRole[];
};

const leadershipRoles: UserRole[] = [
  'spiritual_director',
  'admin',
  'president',
  'vice_president',
  'secretary',
  'treasurer',
  'auditor',
  'pro',
  'choir_a_leader',
  'choir_b_leader',
  'lector_commentator_leader',
  'usher_leader',
  'altar_server_leader',
  'kitchen_leader',
  'kitchen_sub_leader',
  'cleaning_leader',
  'cleaning_sub_leader',
];

/**
 * Determines whether an existing Portal account belongs in an announcement/message
 * audience. This helper deliberately does not send anything or mutate user records.
 *
 * Compatibility policy during redevelopment:
 * - disabled accounts never receive new operational Inbox records;
 * - KCFC Members maps to the current verified-member flag;
 * - Leadership maps to the current role model;
 * - Parishioners/Public currently include any active registered Portal account.
 *   A future explicit parishioner identity tier can narrow this without rewriting
 *   historical records.
 */
export function isProfileEligibleForAudience(
  profile: CommunicationAudienceProfile,
  audience: CommunicationAudience,
) {
  if (profile.isDisabled) return false;
  if (audience === 'kcfc_members') return profile.isVerified === true;
  if (audience === 'leadership') {
    return (profile.roles || []).some((role) => leadershipRoles.includes(role));
  }
  return true;
}

export function getLeadershipCommunicationRoles() {
  return [...leadershipRoles];
}
