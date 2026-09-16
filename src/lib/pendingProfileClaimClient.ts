import { auth } from './firebase';

export type PendingProfileClaimResult = {
  success: true;
  claimed: boolean;
  reason: 'claimed' | 'profile-exists' | 'no-pending-profile';
};

export async function claimPendingProfile(): Promise<PendingProfileClaimResult> {
  const user = auth.currentUser;
  if (!user) throw new Error('A signed-in user is required to claim a pending profile.');

  const token = await user.getIdToken();
  const response = await fetch('/api/auth/claim-pending-profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `Pending profile claim failed (${response.status}).`);
  }
  if (payload?.success !== true || typeof payload?.claimed !== 'boolean') {
    throw new Error('Pending profile claim returned an invalid response.');
  }

  return payload as PendingProfileClaimResult;
}
