import { auth } from './firebase';

export type EnsureAuthenticatedMemberProfileResult = {
  success: true;
  created: boolean;
  reason: 'created' | 'profile-exists';
};

export async function ensureAuthenticatedMemberProfile(
  displayName?: string,
): Promise<EnsureAuthenticatedMemberProfileResult> {
  const user = auth.currentUser;
  if (!user) throw new Error('A signed-in user is required to initialize a member profile.');

  const token = await user.getIdToken();
  const response = await fetch('/api/auth/ensure-member-profile', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ...(displayName ? { displayName } : {}) }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `Member profile initialization failed (${response.status}).`);
  }
  if (payload?.success !== true || typeof payload?.created !== 'boolean') {
    throw new Error('Member profile initialization returned an invalid response.');
  }

  return payload as EnsureAuthenticatedMemberProfileResult;
}
