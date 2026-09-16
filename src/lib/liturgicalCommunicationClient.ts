import { auth } from './firebase';

export type PublicLiturgicalCommunicationSummary = {
  mode?: 'availability_request' | 'availability_complete' | 'initial' | 'revision' | 'no_change';
  nextRevision?: number;
  affectedCount?: number;
  notificationCount?: number;
  pushRecipientCount?: number;
  emailRecipientCount?: number;
  connectorRecipientCounts?: Record<string, number>;
  alreadyNotified?: boolean;
  complete?: boolean;
  remainingCount?: number;
};

type LiturgicalRoute =
  | '/api/liturgical/availability-request/notify'
  | '/api/liturgical/availability-complete/notify'
  | '/api/liturgical/roster/plan'
  | '/api/liturgical/roster/publish';

async function postLiturgicalRoute(
  route: LiturgicalRoute,
  pollId: string,
): Promise<PublicLiturgicalCommunicationSummary> {
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
    // Keep the error below generic if the trusted route returned a non-JSON response.
  }

  if (!response.ok) {
    const error = typeof payload.error === 'string' ? payload.error : `Request failed (${response.status})`;
    const missing = Array.isArray(payload.missing)
      ? payload.missing.filter((value): value is string => typeof value === 'string')
      : [];
    throw new Error(missing.length > 0 ? `${error}: ${missing.join(', ')}` : error);
  }

  return payload as PublicLiturgicalCommunicationSummary;
}

export const notifyAvailabilityRequest = (pollId: string) =>
  postLiturgicalRoute('/api/liturgical/availability-request/notify', pollId);

export const notifyAvailabilityCompletion = (pollId: string) =>
  postLiturgicalRoute('/api/liturgical/availability-complete/notify', pollId);

export const planLiturgicalRosterPublication = (pollId: string) =>
  postLiturgicalRoute('/api/liturgical/roster/plan', pollId);

export const publishLiturgicalRoster = (pollId: string) =>
  postLiturgicalRoute('/api/liturgical/roster/publish', pollId);
