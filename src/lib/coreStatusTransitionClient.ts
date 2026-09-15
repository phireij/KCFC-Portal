import { auth } from './firebase';

export type CoreStatusTransitionResponse = {
  success: true;
  targetUserId: string;
  isCoreMember: boolean;
  removedRoles: string[];
  removedMinistries: string[];
  auditEventId: string;
};

export async function transitionManagedMemberCoreStatus(input: {
  targetUserId: string;
  toCore: boolean;
  expectedUpdatedAt: string | null;
  reason?: string;
}): Promise<CoreStatusTransitionResponse> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('A signed-in KCFC administrator or President is required to change Core Member status.');
  }

  const idToken = await currentUser.getIdToken();
  const response = await fetch('/api/admin/core-status/transition', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `Core Member status change failed (${response.status}).`);
  }
  return payload as CoreStatusTransitionResponse;
}
