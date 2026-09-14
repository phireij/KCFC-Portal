import { auth } from './firebase';

async function authorizedPost(path: string, body?: Record<string, unknown>) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('A signed-in KCFC account is required to refresh the member directory.');
  const idToken = await currentUser.getIdToken();
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body || {}),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || `Member directory refresh failed (${response.status}).`);
  }
  return response.json().catch(() => ({ success: true }));
}

export async function syncOwnMemberDirectoryProfile() {
  return authorizedPost('/api/member-directory/sync-self');
}

export async function syncManagedMemberDirectoryProfile(targetUserId: string) {
  return authorizedPost('/api/admin/member-directory/sync', { targetUserId });
}
