import type { Express, Request } from 'express';
import type { Auth } from 'firebase-admin/auth';
import { FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore';
import type { Poll, UserProfile } from '../src/types';
import { materializeNotificationRecord } from '../src/lib/notificationPersistence';
import {
  buildTrustedLiturgicalCommunicationPlan,
  eligibleLiturgicalMemberIds,
  publicLiturgicalCommunicationSummary,
} from './liturgicalCommunicationService';

type Dependencies = {
  auth: Auth;
  db: Firestore;
};

type Caller = {
  uid: string;
  email?: string;
  profile: UserProfile;
  bootstrap: boolean;
};

const leaderRoles = new Set([
  'admin',
  'president',
  'vice_president',
  'secretary',
  'auditor',
  'lector_commentator_leader',
  'usher_leader',
  'altar_server_leader',
]);

const bearerToken = (request: Request) => {
  const value = request.headers.authorization || '';
  return value.startsWith('Bearer ') ? value.slice('Bearer '.length).trim() : '';
};

const isLeader = (caller: Caller) =>
  caller.bootstrap || (caller.profile.roles || []).some((role) => leaderRoles.has(role));

const isApproved = (caller: Caller) =>
  caller.bootstrap || (caller.profile.isVerified === true && caller.profile.isDisabled !== true);

async function authenticate(request: Request, { auth, db }: Dependencies): Promise<Caller> {
  const token = bearerToken(request);
  if (!token) throw Object.assign(new Error('Authentication required'), { statusCode: 401 });

  let decoded;
  try {
    decoded = await auth.verifyIdToken(token);
  } catch {
    throw Object.assign(new Error('Invalid session'), { statusCode: 401 });
  }

  const profileSnapshot = await db.collection('users').doc(decoded.uid).get();
  if (!profileSnapshot.exists) {
    throw Object.assign(new Error('Caller profile not found'), { statusCode: 403 });
  }

  const profile = { uid: profileSnapshot.id, ...profileSnapshot.data() } as UserProfile;
  const bootstrap = String(decoded.email || profile.email || '').trim().toLowerCase() === 'kcfc.jp@gmail.com';
  const caller = { uid: decoded.uid, email: decoded.email, profile, bootstrap };
  if (!isApproved(caller)) {
    throw Object.assign(new Error('Approved member access required'), { statusCode: 403 });
  }
  return caller;
}

async function readPoll(db: Firestore, pollId: unknown) {
  if (typeof pollId !== 'string' || !pollId.trim()) {
    throw Object.assign(new Error('pollId is required'), { statusCode: 400 });
  }
  const reference = db.collection('polls').doc(pollId.trim());
  const snapshot = await reference.get();
  if (!snapshot.exists) throw Object.assign(new Error('Poll not found'), { statusCode: 404 });
  const poll = { id: snapshot.id, ...snapshot.data() } as Poll & {
    availabilityRequestNotifiedAt?: unknown;
    availabilityCompletionNotifiedAt?: unknown;
    rosterPublished?: boolean;
    rosterPublishedAt?: unknown;
    rosterPublishedBy?: string;
    rosterPublishedByName?: string;
    publicationMode?: 'explicit';
    lastPublishedAssignments?: Record<string, Record<string, string>>;
    rosterRevision?: number;
  };
  if (poll.category !== 'committee') {
    throw Object.assign(new Error('Liturgical communication routes require a committee poll'), { statusCode: 400 });
  }
  return { reference, poll };
}

async function readPrivateProfiles(db: Firestore) {
  const snapshot = await db.collection('users').get();
  return snapshot.docs.map((document) => ({ uid: document.id, ...document.data() } as UserProfile));
}

const massDatesForPoll = (poll: Poll) =>
  poll.massDates?.length
    ? poll.massDates
    : poll.massDate
      ? [{ date: poll.massDate, description: poll.description }]
      : [];

const missingRequiredRoles = (poll: Poll) => {
  const missing: string[] = [];
  const assignments = poll.assignments || {};
  massDatesForPoll(poll).forEach((mass) => {
    const roles = Object.values(assignments[mass.date] || {});
    if (!roles.includes('Commentator')) missing.push(`${mass.date}: Commentator`);
    if (!roles.some((role) => role.startsWith('Lector'))) missing.push(`${mass.date}: Lector`);
    if (!roles.some((role) => role.startsWith('Altar Server'))) missing.push(`${mass.date}: Altar Server`);
    if (!roles.some((role) => role.startsWith('Usher'))) missing.push(`${mass.date}: Usher`);
  });
  return missing;
};

function appendNotifications(
  transaction: Transaction,
  db: Firestore,
  plan: ReturnType<typeof buildTrustedLiturgicalCommunicationPlan>,
) {
  plan.notifications.forEach(({ record }) => {
    const reference = db.collection('notifications').doc();
    transaction.set(reference, materializeNotificationRecord(record, FieldValue.serverTimestamp()));
  });
}

function sendError(response: Parameters<Express['use']>[0] extends never ? never : any, error: unknown) {
  const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
    ? Number((error as { statusCode?: unknown }).statusCode) || 500
    : 500;
  const message = error instanceof Error ? error.message : 'Request failed';
  response.status(statusCode).json({ error: message });
}

export function registerLiturgicalCommunicationRoutes(
  app: Express,
  dependencies: Dependencies,
) {
  const { db } = dependencies;

  app.post('/api/liturgical/availability-request/notify', async (request, response) => {
    try {
      const caller = await authenticate(request, dependencies);
      if (!isLeader(caller)) {
        response.status(403).json({ error: 'Liturgical leader access required' });
        return;
      }

      const { reference, poll } = await readPoll(db, request.body?.pollId);
      if (poll.status === 'draft') {
        response.status(409).json({ error: 'Draft availability requests cannot notify members' });
        return;
      }
      const profiles = await readPrivateProfiles(db);
      const plan = buildTrustedLiturgicalCommunicationPlan({
        kind: 'availability_request',
        poll,
        profiles,
      });
      const summary = publicLiturgicalCommunicationSummary(plan);

      if (poll.availabilityRequestNotifiedAt) {
        response.json({ ...summary, alreadyNotified: true });
        return;
      }

      const committed = await db.runTransaction(async (transaction) => {
        const fresh = await transaction.get(reference);
        if (!fresh.exists) throw Object.assign(new Error('Poll not found'), { statusCode: 404 });
        if (fresh.data()?.availabilityRequestNotifiedAt) return false;
        appendNotifications(transaction, db, plan);
        transaction.update(reference, { availabilityRequestNotifiedAt: FieldValue.serverTimestamp() });
        return true;
      });

      response.json({ ...summary, alreadyNotified: !committed });
    } catch (error) {
      sendError(response, error);
    }
  });

  app.post('/api/liturgical/availability-complete/notify', async (request, response) => {
    try {
      await authenticate(request, dependencies);
      const { reference, poll } = await readPoll(db, request.body?.pollId);
      const profiles = await readPrivateProfiles(db);
      const eligibleIds = eligibleLiturgicalMemberIds(profiles);
      const responseSnapshot = await reference.collection('responses').get();
      const respondedIds = new Set(
        responseSnapshot.docs
          .map((document) => document.data()?.userId)
          .filter((value): value is string => typeof value === 'string' && Boolean(value)),
      );
      const remainingCount = eligibleIds.filter((uid) => !respondedIds.has(uid)).length;
      if (eligibleIds.length === 0 || remainingCount > 0) {
        response.json({ complete: false, remainingCount });
        return;
      }

      const plan = buildTrustedLiturgicalCommunicationPlan({
        kind: 'availability_complete',
        poll,
        profiles,
      });
      const summary = publicLiturgicalCommunicationSummary(plan);
      if (poll.availabilityCompletionNotifiedAt) {
        response.json({ complete: true, ...summary, alreadyNotified: true });
        return;
      }

      const committed = await db.runTransaction(async (transaction) => {
        const fresh = await transaction.get(reference);
        if (!fresh.exists) throw Object.assign(new Error('Poll not found'), { statusCode: 404 });
        if (fresh.data()?.availabilityCompletionNotifiedAt) return false;
        appendNotifications(transaction, db, plan);
        transaction.update(reference, { availabilityCompletionNotifiedAt: FieldValue.serverTimestamp() });
        return true;
      });

      response.json({ complete: true, ...summary, alreadyNotified: !committed });
    } catch (error) {
      sendError(response, error);
    }
  });

  app.post('/api/liturgical/roster/plan', async (request, response) => {
    try {
      const caller = await authenticate(request, dependencies);
      if (!isLeader(caller)) {
        response.status(403).json({ error: 'Liturgical leader access required' });
        return;
      }
      const { poll } = await readPoll(db, request.body?.pollId);
      if (poll.status !== 'closed') {
        response.status(409).json({ error: 'Close the availability request before publishing the roster' });
        return;
      }
      const missing = missingRequiredRoles(poll);
      if (missing.length > 0) {
        response.status(409).json({ error: 'Required liturgical roles are incomplete', missing });
        return;
      }
      const profiles = await readPrivateProfiles(db);
      const plan = buildTrustedLiturgicalCommunicationPlan({
        kind: 'assignment_publish',
        poll,
        profiles,
      });
      response.json(publicLiturgicalCommunicationSummary(plan));
    } catch (error) {
      sendError(response, error);
    }
  });

  app.post('/api/liturgical/roster/publish', async (request, response) => {
    try {
      const caller = await authenticate(request, dependencies);
      if (!isLeader(caller)) {
        response.status(403).json({ error: 'Liturgical leader access required' });
        return;
      }
      const pollId = request.body?.pollId;
      const { reference } = await readPoll(db, pollId);
      const profiles = await readPrivateProfiles(db);

      const summary = await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists) throw Object.assign(new Error('Poll not found'), { statusCode: 404 });
        const poll = { id: snapshot.id, ...snapshot.data() } as Poll & {
          lastPublishedAssignments?: Record<string, Record<string, string>>;
          rosterRevision?: number;
        };
        if (poll.category !== 'committee') throw Object.assign(new Error('Committee poll required'), { statusCode: 400 });
        if (poll.status !== 'closed') throw Object.assign(new Error('Close the availability request before publishing the roster'), { statusCode: 409 });
        const missing = missingRequiredRoles(poll);
        if (missing.length > 0) {
          throw Object.assign(new Error(`Required liturgical roles are incomplete: ${missing.join(', ')}`), { statusCode: 409 });
        }

        const plan = buildTrustedLiturgicalCommunicationPlan({
          kind: 'assignment_publish',
          poll,
          profiles,
        });
        appendNotifications(transaction, db, plan);
        transaction.update(reference, {
          rosterPublished: true,
          rosterPublishedAt: FieldValue.serverTimestamp(),
          rosterPublishedBy: caller.uid,
          rosterPublishedByName: caller.profile.displayName || 'KCFC Leader',
          publicationMode: 'explicit',
          lastPublishedAssignments: poll.assignments || {},
          rosterRevision: plan.nextRevision || Math.max(1, poll.rosterRevision || 1),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return publicLiturgicalCommunicationSummary(plan);
      });

      response.json(summary);
    } catch (error) {
      sendError(response, error);
    }
  });
}
