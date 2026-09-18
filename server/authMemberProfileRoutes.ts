import type { Express, Request } from 'express';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';

type AuthMemberProfileDependencies = {
  auth: Auth;
  db: Firestore;
};

function bearerToken(req: Request) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

function safeDisplayName(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, 200);
}

function avatarUrl(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'KCFC')}&background=123B66&color=fff`;
}

export function registerAuthMemberProfileRoutes(
  app: Express,
  { auth, db }: AuthMemberProfileDependencies,
) {
  app.post('/api/auth/ensure-member-profile', async (req, res) => {
    const token = bearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const decoded = await auth.verifyIdToken(token);
      const authUser = await auth.getUser(decoded.uid);
      const email = String(authUser.email || decoded.email || '').trim().toLowerCase();
      if (!email) {
        res.status(400).json({ error: 'Authenticated account has no email address' });
        return;
      }

      const userRef = db.collection('users').doc(decoded.uid);
      const existing = await userRef.get();
      if (existing.exists) {
        res.json({ success: true, created: false, reason: 'profile-exists' });
        return;
      }

      const isBootstrapAdmin = email === 'kcfc.jp@gmail.com';
      const requestedName = safeDisplayName(req.body?.displayName);
      const authName = safeDisplayName(authUser.displayName);
      const displayName = isBootstrapAdmin ? 'ADMIN' : (authName || requestedName || 'Member');
      const profile = {
        uid: decoded.uid,
        email,
        displayName,
        photoURL: String(authUser.photoURL || '').trim() || avatarUrl(displayName),
        roles: isBootstrapAdmin ? ['admin'] : ['member'],
        ministries: [],
        lcRoles: [],
        isCoreMember: false,
        isEmailVerified: isBootstrapAdmin || authUser.emailVerified === true,
        isVerified: isBootstrapAdmin,
        isDisabled: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      let created = false;
      await db.runTransaction(async (transaction) => {
        const fresh = await transaction.get(userRef);
        if (fresh.exists) return;
        transaction.set(userRef, profile, { merge: false });
        created = true;
      });

      res.json({
        success: true,
        created,
        reason: created ? 'created' : 'profile-exists',
      });
    } catch (error) {
      console.error('[AUTH MEMBER PROFILE ERROR]', error);
      res.status(500).json({ error: 'Member profile initialization failed' });
    }
  });
}
