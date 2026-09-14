import type { Express, Request, Response } from 'express';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { toMemberDirectoryProfile } from '../src/lib/memberPublicProjection';

type MemberDirectoryRouteDependencies = {
  auth: Auth;
  db: Firestore;
};

const bearerToken = (request: Request) => {
  const header = request.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return '';
  return header.slice('Bearer '.length).trim();
};

export function registerMemberDirectoryRoute(
  app: Express,
  { auth, db }: MemberDirectoryRouteDependencies,
) {
  app.get('/api/member-directory', async (request: Request, response: Response) => {
    response.setHeader('Cache-Control', 'private, no-store');

    const token = bearerToken(request);
    if (!token) {
      response.status(401).json({ error: 'Authentication required' });
      return;
    }

    try {
      const decoded = await auth.verifyIdToken(token);
      const callerSnapshot = await db.collection('users').doc(decoded.uid).get();
      const caller = callerSnapshot.data();
      const bootstrapAdmin = String(decoded.email || '').trim().toLowerCase() === 'kcfc.jp@gmail.com';

      if (!callerSnapshot.exists || (!bootstrapAdmin && (caller?.isVerified !== true || caller?.isDisabled === true))) {
        response.status(403).json({ error: 'Member access required' });
        return;
      }

      const usersSnapshot = await db.collection('users').get();
      const members = usersSnapshot.docs
        .map((item) => toMemberDirectoryProfile(item.id, item.data()))
        .filter((member): member is NonNullable<typeof member> => Boolean(member))
        .sort((a, b) => a.displayName.localeCompare(b.displayName));

      response.json({ members });
    } catch (error) {
      console.warn('Member directory request rejected:', error instanceof Error ? error.message : 'unknown error');
      response.status(401).json({ error: 'Invalid session' });
    }
  });
}
