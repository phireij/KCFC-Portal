import type { UserProfile } from '../types';

export type MemberAccountStatus = 'pending' | 'active' | 'disabled';

export type MemberAccountStatusSummary = {
  total: number;
  active: number;
  pending: number;
  disabled: number;
};

export function getMemberAccountStatus(member: UserProfile): MemberAccountStatus {
  if (member.isDisabled) return 'disabled';
  if (!member.isVerified) return 'pending';
  return 'active';
}

export function summarizeMemberAccountStatus(members: UserProfile[]): MemberAccountStatusSummary {
  const summary: MemberAccountStatusSummary = {
    total: 0,
    active: 0,
    pending: 0,
    disabled: 0,
  };

  for (const member of members) {
    if ((member.roles || []).includes('admin')) continue;
    summary.total += 1;
    summary[getMemberAccountStatus(member)] += 1;
  }

  return summary;
}
