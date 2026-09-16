import type { Express, Request } from 'express';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';

type PrivilegedMemberQueryDependencies = {
  auth: Auth;
  db: Firestore;
};

const PENDING_SUMMARY_ROLES = new Set([
  'admin',
  'president',
  'vice_president',
  'secretary',
  'auditor',
]);

const POLL_EMAIL_ROLES = new Set([
  'admin',
  'president',
  'vice_president',
  'secretary',
  'treasurer',
  'auditor',
  'pro',
  'lector_commentator_leader',
  'altar_server_leader',
  'usher_leader',
  'kitchen_leader',
  'cleaning_leader',
]);

function bearerToken(req: Request) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

async function authorize(
  auth: Auth,
  db: Firestore,
  token: string,
  allowedRoles: Set<string>,
) {
  const decoded = await auth.verifyIdToken(token);
  const email = String(decoded.email || '').trim().toLowerCase();
  if (email === 'kcfc.jp@gmail.com') return true;

  const caller = await db.collection('users').doc(decoded.uid).get();
  if (!caller.exists) return false;
  const data = caller.data() || {};
  const roles = Array.isArray(data.roles)
    ? data.roles.filter((role): role is string => typeof role === 'string')
    : [];
  return data.isVerified === true
    && data.isDisabled !== true
    && roles.some((role) => allowedRoles.has(role));
}

export function registerPrivilegedMemberQueryRoutes(
  app: Express,
  { auth, db }: PrivilegedMemberQueryDependencies,
) {
  app.post('/api/admin/member-summaries/pending', async (req, res) => {
    const token = bearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      if (!await authorize(auth, db, token, PENDING_SUMMARY_ROLES)) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const snapshot = await db.collection('users').where('isVerified', '==', false).get();
      const members = snapshot.docs.flatMap((item) => {
        const data = item.data() || {};
        const email = String(data.email || '').trim();
        if (email.toLowerCase() === 'kcfc.jp@gmail.com') return [];
        const displayName = String(data.displayName || '').trim() || 'Pending member';
        const photoURL = String(data.photoURL || '').trim();
        return [{
          uid: item.id,
          displayName,
          email,
          ...(photoURL ? { photoURL } : {}),
        }];
      });

      res.json({ members });
    } catch (error) {
      console.error('[PENDING MEMBER SUMMARY ERROR]', error);
      res.status(500).json({ error: 'Pending member summaries could not be loaded' });
    }
  });

  app.post('/api/admin/member-summaries/poll-email-recipients', async (req, res) => {
    const token = bearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      if (!await authorize(auth, db, token, POLL_EMAIL_ROLES)) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const snapshot = await db.collection('users').where('isVerified', '==', true).get();
      const recipients = snapshot.docs.flatMap((item) => {
        const data = item.data() || {};
        const email = String(data.email || '').trim();
        if (!email || data.isDisabled === true || email.toLowerCase() === 'kcfc.jp@gmail.com') return [];
        const displayName = String(data.displayName || '').trim() || 'Community Member';
        const nickname = String(data.nickname || '').trim();
        const ministries = Array.isArray(data.ministries)
          ? data.ministries.filter((value): value is string => typeof value === 'string')
          : [];
        return [{
          uid: item.id,
          email,
          displayName,
          ...(nickname ? { nickname } : {}),
          isCoreMember: data.isCoreMember === true,
          ministries,
        }];
      });

      res.json({ recipients });
    } catch (error) {
      console.error('[POLL EMAIL RECIPIENT SUMMARY ERROR]', error);
      res.status(500).json({ error: 'Poll email recipient summaries could not be loaded' });
    }
  });
}
