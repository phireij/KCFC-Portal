import type { Express, Request } from 'express';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { toMemberDirectoryProfile } from '../src/lib/memberPublicProjection';

type MemberDirectorySyncDependencies = {
  auth: Auth;
  db: Firestore;
};

const GOVERNANCE_SYNC_ROLES = new Set(['admin', 'president']);

function bearerToken(req: Request) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

async function callerCanSyncAnotherMember(
  auth: Auth,
  db: Firestore,
  token: string,
) {
  const decoded = await auth.verifyIdToken(token);
  const email = String(decoded.email || '').trim().toLowerCase();
  if (email === 'kcfc.jp@gmail.com') return { allowed: true, callerUid: decoded.uid };

  const caller = await db.collection('users').doc(decoded.uid).get();
  if (!caller.exists) return { allowed: false, callerUid: decoded.uid };
  const data = caller.data() || {};
  const roles = Array.isArray(data.roles) ? data.roles.filter((value): value is string => typeof value === 'string') : [];
  const active = data.isVerified === true && data.isDisabled !== true;
  return {
    allowed: active && roles.some((role) => GOVERNANCE_SYNC_ROLES.has(role)),
    callerUid: decoded.uid,
  };
}

async function synchronizeMemberDirectoryProfile(db: Firestore, uid: string) {
  const userRef = db.collection('users').doc(uid);
  const directoryRef = db.collection('member_directory').doc(uid);
  const user = await userRef.get();

  if (!user.exists) {
    await directoryRef.delete();
    return 'deleted-missing-user' as const;
  }

  const projection = toMemberDirectoryProfile(uid, user.data() || {});
  if (!projection) {
    await directoryRef.delete();
    return 'deleted-ineligible-user' as const;
  }

  await directoryRef.set(projection, { merge: false });
  return 'upserted' as const;
}

export function registerMemberDirectorySyncRoutes(
  app: Express,
  { auth, db }: MemberDirectorySyncDependencies,
) {
  app.post('/api/member-directory/sync-self', async (req, res) => {
    const token = bearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const decoded = await auth.verifyIdToken(token);
      const action = await synchronizeMemberDirectoryProfile(db, decoded.uid);
      res.json({ success: true, action });
    } catch (error) {
      console.error('[MEMBER DIRECTORY SELF SYNC ERROR]', error);
      res.status(500).json({ error: 'Member directory synchronization failed' });
    }
  });

  app.post('/api/admin/member-directory/sync', async (req, res) => {
    const token = bearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const targetUserId = typeof req.body?.targetUserId === 'string' ? req.body.targetUserId.trim() : '';
    if (!targetUserId || targetUserId.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(targetUserId)) {
      res.status(400).json({ error: 'Invalid target user ID' });
      return;
    }

    try {
      const caller = await callerCanSyncAnotherMember(auth, db, token);
      if (!caller.allowed) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      const action = await synchronizeMemberDirectoryProfile(db, targetUserId);
      res.json({ success: true, action });
    } catch (error) {
      console.error('[MEMBER DIRECTORY ADMIN SYNC ERROR]', error);
      res.status(500).json({ error: 'Member directory synchronization failed' });
    }
  });
}
