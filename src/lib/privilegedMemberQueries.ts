import { auth } from './firebase';

export type PendingMemberSummary = {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
};

async function authorizedSummaryPost<T>(path: string): Promise<T> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('A signed-in KCFC account is required.');
  const idToken = await currentUser.getIdToken();
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || `Privileged member summary request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export function subscribePendingMembers(
  onMembers: (members: PendingMemberSummary[]) => void,
  onError?: (error: Error) => void,
) {
  let cancelled = false;
  let running = false;

  const refresh = async () => {
    if (cancelled || running) return;
    running = true;
    try {
      const payload = await authorizedSummaryPost<{ members?: PendingMemberSummary[] }>('/api/admin/member-summaries/pending');
      if (!cancelled) onMembers(Array.isArray(payload.members) ? payload.members : []);
    } catch (error) {
      if (!cancelled) onError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      running = false;
    }
  };

  void refresh();
  const intervalId = window.setInterval(refresh, 30_000);
  const handleFocus = () => { void refresh(); };
  window.addEventListener('focus', handleFocus);

  return () => {
    cancelled = true;
    window.clearInterval(intervalId);
    window.removeEventListener('focus', handleFocus);
  };
}

export function subscribePendingMemberCount(
  onCount: (count: number) => void,
  onError?: (error: Error) => void,
) {
  return subscribePendingMembers(
    (members) => onCount(members.length),
    onError,
  );
}

export type PrivilegedPollEmailRecipient = {
  uid: string;
  email: string;
  displayName: string;
  nickname?: string;
  isCoreMember: boolean;
  ministries: string[];
};

export async function listPrivilegedPollEmailRecipients(): Promise<PrivilegedPollEmailRecipient[]> {
  const payload = await authorizedSummaryPost<{ recipients?: PrivilegedPollEmailRecipient[] }>(
    '/api/admin/member-summaries/poll-email-recipients',
  );
  return Array.isArray(payload.recipients) ? payload.recipients : [];
}
