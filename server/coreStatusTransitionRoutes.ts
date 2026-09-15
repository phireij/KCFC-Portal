import type { Express, Request } from 'express';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { buildCoreStatusMutationPlan } from '../src/lib/coreStatusMutationPlan';
import type { UserProfile, UserRole } from '../src/types';
import { executeCoreStatusTransitionInStaging } from './coreStatusStagingExecutor';
import { createFirestoreCoreStatusTransactionAdapter } from './firestoreCoreStatusTransactionAdapter';

type CoreStatusTransitionRouteDependencies = {
  auth: Auth;
  db: Firestore;
  runtimeEnvironment: string;
  executorEnabled: boolean;
};

function bearerToken(req: Request) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

function memberRoles(data: FirebaseFirestore.DocumentData | undefined): UserRole[] {
  if (!data || !Array.isArray(data.roles)) return [];
  return data.roles.filter((value): value is UserRole => typeof value === 'string');
}

function transitionReason(fromCore: boolean, toCore: boolean, supplied: unknown) {
  if (typeof supplied === 'string') {
    const trimmed = supplied.trim();
    if (trimmed) return trimmed.slice(0, 240);
  }
  return `Governed member editing: ${fromCore ? 'Core Member' : 'Regular Member'} to ${toCore ? 'Core Member' : 'Regular Member'}`;
}

export function registerCoreStatusTransitionRoutes(
  app: Express,
  { auth, db, runtimeEnvironment, executorEnabled }: CoreStatusTransitionRouteDependencies,
) {
  app.post('/api/admin/core-status/transition', async (req, res) => {
    const token = bearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (runtimeEnvironment !== 'staging') {
      res.status(403).json({ error: 'Core Member status changes are currently enabled only in the isolated staging environment.' });
      return;
    }
    if (!executorEnabled) {
      res.status(503).json({ error: 'Core Member status changes are not enabled for this staging deployment.' });
      return;
    }

    const targetUserId = typeof req.body?.targetUserId === 'string' ? req.body.targetUserId.trim() : '';
    const toCore = req.body?.toCore;
    const expectedUpdatedAt = req.body?.expectedUpdatedAt;

    if (!targetUserId || targetUserId.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(targetUserId)) {
      res.status(400).json({ error: 'Invalid target user ID' });
      return;
    }
    if (typeof toCore !== 'boolean') {
      res.status(400).json({ error: 'A Core Member target status is required.' });
      return;
    }
    if (!(expectedUpdatedAt === null || typeof expectedUpdatedAt === 'string')) {
      res.status(400).json({ error: 'Invalid member version precondition.' });
      return;
    }

    try {
      const decoded = await auth.verifyIdToken(token);
      const actorSnapshot = await db.collection('users').doc(decoded.uid).get();
      if (!actorSnapshot.exists) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const actorData = actorSnapshot.data() || {};
      const actorRoles = memberRoles(actorData);
      const actorActive = actorData.isVerified === true && actorData.isDisabled !== true;
      if (!actorActive || !actorRoles.some((role) => role === 'admin' || role === 'president')) {
        res.status(403).json({ error: 'Core Member status changes require an authorized KCFC administrator or President.' });
        return;
      }

      const targetSnapshot = await db.collection('users').doc(targetUserId).get();
      if (!targetSnapshot.exists) {
        res.status(404).json({ error: 'Target member was not found.' });
        return;
      }

      const target = { uid: targetSnapshot.id, ...targetSnapshot.data() } as UserProfile;
      if (target.isVerified !== true || target.isDisabled === true) {
        res.status(409).json({ error: 'Core Member status can be changed only for active verified members.' });
        return;
      }
      if ((target.roles || []).includes('admin')) {
        res.status(409).json({ error: 'Application administrators remain outside routine governed Core Member editing.' });
        return;
      }
      if (Boolean(target.isCoreMember) === toCore) {
        res.status(409).json({ error: `This member is already a ${toCore ? 'Core Member' : 'Regular Member'}.` });
        return;
      }

      const plan = buildCoreStatusMutationPlan({
        member: target,
        toCore,
        actorUid: decoded.uid,
        reason: transitionReason(Boolean(target.isCoreMember), toCore, req.body?.reason),
      });

      if (plan.precondition.expectedUpdatedAt !== expectedUpdatedAt) {
        res.status(409).json({ error: 'This member changed after the status review. Refresh the member and review the transition again.' });
        return;
      }

      const result = await executeCoreStatusTransitionInStaging({
        plan,
        context: {
          environment: 'staging',
          executorEnabled,
          actorUid: decoded.uid,
          actorRoles,
          now: () => new Date().toISOString(),
        },
        adapter: createFirestoreCoreStatusTransactionAdapter(db),
      });

      res.json({
        success: true,
        targetUserId: result.targetUid,
        isCoreMember: toCore,
        removedRoles: plan.removedRoles,
        removedMinistries: plan.removedMinistries,
        auditEventId: result.auditEventId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Core Member status change failed.';
      const stale = /stale|changed after/i.test(message);
      console.error('[CORE STATUS TRANSITION ERROR]', error);
      res.status(stale ? 409 : 500).json({ error: message });
    }
  });
}
