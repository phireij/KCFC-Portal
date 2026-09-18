export type PwaTransport = 'fcm' | 'webpush';

export type PwaTransportAttempt = {
  userId: string;
  transport: PwaTransport;
  success: boolean;
  detail?: string;
};

export type PwaDeliveryEvidence = {
  userId: string;
  status: 'sent' | 'failed' | 'skipped';
  attempts: number;
  successes: number;
  failures: number;
  detail: string;
};

/**
 * Reduces transport-level evidence to one honest PWA result per member.
 *
 * Semantics:
 * - `sent`: at least one FCM or native Web Push transport accepted the message;
 * - `failed`: one or more transports were attempted and none succeeded;
 * - `skipped`: no deliverable transport was attempted for that member.
 *
 * `sent` intentionally does not mean `delivered`; browser/OS delivery receipts are not
 * available from these transport APIs. Callers must never promote it to delivered/read
 * without separate evidence.
 */
export function buildPwaDeliveryEvidence(
  targetUserIds: Iterable<string>,
  attempts: PwaTransportAttempt[],
): PwaDeliveryEvidence[] {
  const uniqueTargets = Array.from(new Set(Array.from(targetUserIds).filter(Boolean)));
  const attemptsByUser = new Map<string, PwaTransportAttempt[]>();

  attempts.forEach((attempt) => {
    if (!attempt.userId || !uniqueTargets.includes(attempt.userId)) return;
    const existing = attemptsByUser.get(attempt.userId) || [];
    existing.push(attempt);
    attemptsByUser.set(attempt.userId, existing);
  });

  return uniqueTargets.map((userId) => {
    const userAttempts = attemptsByUser.get(userId) || [];
    const successes = userAttempts.filter((attempt) => attempt.success).length;
    const failures = userAttempts.length - successes;
    const status: PwaDeliveryEvidence['status'] = successes > 0
      ? 'sent'
      : userAttempts.length > 0
        ? 'failed'
        : 'skipped';

    const transportSummary = userAttempts.reduce<Record<PwaTransport, { attempts: number; successes: number }>>(
      (summary, attempt) => {
        summary[attempt.transport].attempts += 1;
        if (attempt.success) summary[attempt.transport].successes += 1;
        return summary;
      },
      {
        fcm: { attempts: 0, successes: 0 },
        webpush: { attempts: 0, successes: 0 },
      },
    );

    const detail = status === 'skipped'
      ? 'No deliverable PWA endpoint was attempted.'
      : `Accepted ${successes}/${userAttempts.length} transport attempt(s): FCM ${transportSummary.fcm.successes}/${transportSummary.fcm.attempts}, Web Push ${transportSummary.webpush.successes}/${transportSummary.webpush.attempts}.`;

    return {
      userId,
      status,
      attempts: userAttempts.length,
      successes,
      failures,
      detail,
    };
  });
}
