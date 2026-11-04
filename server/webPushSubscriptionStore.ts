import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { Firestore } from 'firebase-admin/firestore';

type SubscriptionStore = Pick<Firestore, 'collection' | 'runTransaction'>;
type Subscription = { endpoint: string; [key: string]: unknown };

/** Read and replace in one transaction so concurrent registrations cannot be lost. */
export async function registerWebPushSubscription(
  db: SubscriptionStore,
  userId: string,
  subscription: Subscription,
  limit: number,
) {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('Subscription limit must be a positive integer.');
  const userRef = db.collection('users').doc(userId);
  const registeredAt = new Date().toISOString();
  // Distinguish a refresh even when its endpoint, keys and millisecond timestamp
  // match an earlier delivery snapshot. Reuse this identity on transaction retries.
  const registration = { ...subscription, registeredAt, registrationId: randomUUID() };
  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(userRef);
    const stored = snapshot.data()?.webPushSubscriptions;
    const otherSubscriptions = (Array.isArray(stored) ? stored : [])
      .filter(sub => sub && typeof sub.endpoint === 'string' && sub.endpoint !== subscription.endpoint);
    const subscriptions = limit === 1 ? [] : otherSubscriptions.slice(-(limit - 1));
    subscriptions.push(registration);
    transaction.set(userRef, { webPushSubscriptions: subscriptions, updatedAt: registeredAt }, { merge: true });
  });
}

/** Remove only the exact registrations whose delivery was reported expired. */
export async function pruneExpiredWebPushSubscriptions(
  db: SubscriptionStore,
  userId: string,
  expiredSubscriptions: readonly unknown[],
) {
  if (expiredSubscriptions.length === 0) return;
  const userRef = db.collection('users').doc(userId);
  await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(userRef);
    if (!snapshot.exists) return;
    const stored = snapshot.data()?.webPushSubscriptions;
    if (!Array.isArray(stored)) return;
    const remaining = stored.filter(sub => !expiredSubscriptions.some(expired => isDeepStrictEqual(sub, expired)));
    if (remaining.length !== stored.length) {
      transaction.update(userRef, { webPushSubscriptions: remaining });
    }
  });
}
