import { auth } from './firebase';

const MAX_SYNC_ATTEMPTS = 3;

const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

async function authorizedPost(path: string, body?: Record<string, unknown>) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('A signed-in KCFC account is required to refresh the member directory.');

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_SYNC_ATTEMPTS; attempt += 1) {
    try {
      const idToken = await currentUser.getIdToken(attempt > 1);
      const response = await fetch(path, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body || {}),
      });

      if (response.ok) {
        return response.json().catch(() => ({ success: true }));
      }

      const payload = await response.json().catch(() => ({}));
      const message = payload?.error || `Member directory refresh failed (${response.status}).`;
      lastError = new Error(message);

      // Authorization/validation failures will not become healthy through retrying.
      if (response.status < 500 && response.status !== 408 && response.status !== 429) {
        throw lastError;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt >= MAX_SYNC_ATTEMPTS) throw lastError;
    }

    if (attempt < MAX_SYNC_ATTEMPTS) {
      await delay(200 * attempt);
    }
  }

  throw lastError || new Error('Member directory refresh failed.');
}

export async function syncOwnMemberDirectoryProfile() {
  return authorizedPost('/api/member-directory/sync-self');
}

export async function syncManagedMemberDirectoryProfile(targetUserId: string) {
  return authorizedPost('/api/admin/member-directory/sync', { targetUserId });
}
