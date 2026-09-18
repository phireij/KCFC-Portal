import { auth } from './firebase';

export type PublicLegacyPollCommunicationSummary = {
  notificationCount?: number;
  alreadyNotified?: boolean;
  complete?: boolean;
  remainingCount?: number;
};

type LegacyPollRoute =
  | '/api/polls/publish/notify'
  | '/api/polls/completion/notify'
  | '/api/polls/close/notify';

async function postLegacyPollRoute(
  route: LegacyPollRoute,
  pollId: string,
): Promise<PublicLegacyPollCommunicationSummary> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in is required to continue.');
  const idToken = await user.getIdToken();
  const response = await fetch(route, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pollId }),
  });

  let payload: Record<string, unknown> = {};
  try {
    payload = await response.json() as Record<string, unknown>;
  } catch {
    // Keep the error generic when the trusted route returns a non-JSON response.
  }

  if (!response.ok) {
    const message = typeof payload.error === 'string'
      ? payload.error
      : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as PublicLegacyPollCommunicationSummary;
}

export const notifyLegacyPollPublished = (pollId: string) =>
  postLegacyPollRoute('/api/polls/publish/notify', pollId);

export const notifyLegacyPollCompletion = (pollId: string) =>
  postLegacyPollRoute('/api/polls/completion/notify', pollId);

export const notifyLegacyPollClosed = (pollId: string) =>
  postLegacyPollRoute('/api/polls/close/notify', pollId);
