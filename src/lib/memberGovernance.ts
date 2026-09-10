import type { MinistryType, UserProfile, UserRole } from '../types';

export const MEMBER_ROLE_LIMITS: Partial<Record<UserRole, number>> = {
  spiritual_director: 1,
  admin: 1,
  president: 1,
  vice_president: 2,
  secretary: 1,
  treasurer: 1,
  auditor: 1,
  pro: 1,
  choir_a_leader: 1,
  choir_b_leader: 1,
  lector_commentator_leader: 1,
  usher_leader: 1,
  altar_server_leader: 1,
  kitchen_leader: 1,
  kitchen_sub_leader: 1,
  cleaning_leader: 1,
  cleaning_sub_leader: 1,
};

export const EXECUTIVE_ROLES: UserRole[] = [
  'spiritual_director',
  'admin',
  'president',
  'vice_president',
  'secretary',
  'treasurer',
  'auditor',
  'pro',
];

export const LEADERSHIP_ROLES: UserRole[] = [
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

export const CHORE_MINISTRIES: MinistryType[] = [
  'kitchen',
  'cleaning',
  'cleaning_toilet_ok',
  'cleaning_toilet_ng',
];

export const LITURGICAL_MINISTRIES: MinistryType[] = [
  'choir_a',
  'choir_b',
  'lector_commentator',
  'usher',
  'altar_server',
];

const ROLE_MINISTRY_REQUIREMENTS: Partial<Record<UserRole, MinistryType>> = {
  choir_a_leader: 'choir_a',
  choir_b_leader: 'choir_b',
  lector_commentator_leader: 'lector_commentator',
  usher_leader: 'usher',
  altar_server_leader: 'altar_server',
  kitchen_leader: 'kitchen',
  kitchen_sub_leader: 'kitchen',
  cleaning_leader: 'cleaning',
  cleaning_sub_leader: 'cleaning',
};

export type MemberGovernanceIssue = {
  code:
    | 'member_required'
    | 'president_exclusive'
    | 'too_many_roles'
    | 'role_limit'
    | 'role_requires_ministry'
    | 'core_required_for_leadership'
    | 'core_required_for_chore'
    | 'choir_exclusive'
    | 'cleaning_status_requires_cleaning';
  message: string;
};

export type CoreStatusTransitionPlan = {
  fromCore: boolean;
  toCore: boolean;
  requiresCleanup: boolean;
  rolesToRemove: UserRole[];
  ministriesToRemove: MinistryType[];
  preservedRoles: UserRole[];
  preservedMinistries: MinistryType[];
  warnings: string[];
};

export function normalizeMemberRoles(roles: UserRole[]): UserRole[] {
  return Array.from(new Set<UserRole>([...roles, 'member']));
}

export function validateMemberGovernance(input: {
  member: UserProfile;
  allMembers: UserProfile[];
  roles: UserRole[];
  ministries: MinistryType[];
}): MemberGovernanceIssue[] {
  const { member, allMembers, ministries } = input;
  const roles = normalizeMemberRoles(input.roles);
  const issues: MemberGovernanceIssue[] = [];

  if (!roles.includes('member')) {
    issues.push({ code: 'member_required', message: 'Every KCFC profile must retain the Member role.' });
  }

  const extraRoles = roles.filter((role) => role !== 'member');
  const leadershipRoles = extraRoles.filter((role) => LEADERSHIP_ROLES.includes(role));
  const executiveRoles = extraRoles.filter((role) => EXECUTIVE_ROLES.includes(role));

  if (roles.includes('president') && extraRoles.length > 1) {
    issues.push({ code: 'president_exclusive', message: 'The President cannot hold an additional executive or committee leadership role.' });
  }

  const dualRoleAllowed = Boolean(
    member.isCoreMember
      && executiveRoles.length === 1
      && executiveRoles[0] !== 'president'
      && leadershipRoles.length === 1
      && ['kitchen_leader', 'kitchen_sub_leader', 'cleaning_leader', 'cleaning_sub_leader'].includes(leadershipRoles[0]),
  );

  if ((!dualRoleAllowed && extraRoles.length > 1) || (dualRoleAllowed && extraRoles.length > 2)) {
    issues.push({
      code: 'too_many_roles',
      message: dualRoleAllowed
        ? 'This member can hold at most one executive role plus one Kitchen/Cleaning leadership role.'
        : 'A member can hold only one role in addition to Member unless the approved Core-member dual-role rule applies.',
    });
  }

  if (!member.isCoreMember && leadershipRoles.length > 0) {
    issues.push({ code: 'core_required_for_leadership', message: 'Committee leadership roles require Core Member status.' });
  }

  if (!member.isCoreMember && ministries.some((ministry) => CHORE_MINISTRIES.includes(ministry))) {
    issues.push({ code: 'core_required_for_chore', message: 'Kitchen and Cleaning committee assignments require Core Member status.' });
  }

  const hasChoir = ministries.some((ministry) => ministry === 'choir_a' || ministry === 'choir_b');
  const hasOtherLiturgical = ministries.some((ministry) => ['lector_commentator', 'usher', 'altar_server'].includes(ministry));
  if (hasChoir && hasOtherLiturgical) {
    issues.push({ code: 'choir_exclusive', message: 'Choir membership cannot be combined with Lector/Commentator, Usher or Altar Server in the current KCFC ministry model.' });
  }

  if (ministries.some((ministry) => ministry === 'cleaning_toilet_ok' || ministry === 'cleaning_toilet_ng') && !ministries.includes('cleaning')) {
    issues.push({ code: 'cleaning_status_requires_cleaning', message: 'Cleaning toilet status requires the Cleaning ministry assignment.' });
  }

  for (const role of leadershipRoles) {
    const requiredMinistry = ROLE_MINISTRY_REQUIREMENTS[role];
    if (requiredMinistry && !ministries.includes(requiredMinistry)) {
      issues.push({
        code: 'role_requires_ministry',
        message: `${role.replaceAll('_', ' ')} requires membership in ${requiredMinistry.replaceAll('_', ' ')}.`,
      });
    }
  }

  for (const role of extraRoles) {
    const limit = MEMBER_ROLE_LIMITS[role];
    if (!limit) continue;
    const assignedElsewhere = allMembers.filter((candidate) => candidate.uid !== member.uid && (candidate.roles || []).includes(role));
    if (assignedElsewhere.length >= limit) {
      issues.push({
        code: 'role_limit',
        message: `${role.replaceAll('_', ' ')} is limited to ${limit} member${limit === 1 ? '' : 's'} and is already fully assigned.`,
      });
    }
  }

  return issues;
}

export function planCoreStatusTransition(member: UserProfile, toCore: boolean): CoreStatusTransitionPlan {
  const fromCore = Boolean(member.isCoreMember);
  const currentRoles = normalizeMemberRoles(member.roles || ['member']);
  const currentMinistries = Array.from(new Set(member.ministries || []));

  if (fromCore === toCore) {
    return {
      fromCore,
      toCore,
      requiresCleanup: false,
      rolesToRemove: [],
      ministriesToRemove: [],
      preservedRoles: currentRoles,
      preservedMinistries: currentMinistries,
      warnings: [],
    };
  }

  if (toCore) {
    return {
      fromCore,
      toCore,
      requiresCleanup: false,
      rolesToRemove: [],
      ministriesToRemove: [],
      preservedRoles: currentRoles,
      preservedMinistries: currentMinistries,
      warnings: [
        'Upgrading to Core Member expands eligibility but does not automatically assign a chore ministry or leadership role.',
        'Any new role or ministry still requires a separate governed edit and validation.',
      ],
    };
  }

  const rolesToRemove = currentRoles.filter((role) => role !== 'member');
  const ministriesToRemove = currentMinistries.filter((ministry) => CHORE_MINISTRIES.includes(ministry));
  const preservedMinistries = currentMinistries.filter((ministry) => !CHORE_MINISTRIES.includes(ministry));
  const warnings: string[] = [
    'Downgrading from Core Member removes executive and committee leadership roles under the current legacy policy.',
    'Kitchen, Cleaning and related cleaning-status assignments are removed; liturgical ministries are preserved.',
  ];

  if (rolesToRemove.length > 0) warnings.push(`${rolesToRemove.length} non-Member role${rolesToRemove.length === 1 ? '' : 's'} would be removed.`);
  if (ministriesToRemove.length > 0) warnings.push(`${ministriesToRemove.length} chore ministry/status assignment${ministriesToRemove.length === 1 ? '' : 's'} would be removed.`);

  return {
    fromCore,
    toCore,
    requiresCleanup: rolesToRemove.length > 0 || ministriesToRemove.length > 0,
    rolesToRemove,
    ministriesToRemove,
    preservedRoles: ['member'],
    preservedMinistries,
    warnings,
  };
}
