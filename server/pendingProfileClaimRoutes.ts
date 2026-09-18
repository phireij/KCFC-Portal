import type { Express, Request } from 'express';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { toMemberDirectoryProfile } from '../src/lib/memberPublicProjection';

type PendingProfileClaimDependencies = {
  auth: Auth;
  db: Firestore;
};

function bearerToken(req: Request) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function avatarUrl(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'KCFC')}&background=123B66&color=fff`;
}

export function registerPendingProfileClaimRoutes(
  app: Express,
  { auth, db }: PendingProfileClaimDependencies,
) {
  app.post('/api/auth/claim-pending-profile', async (req, res) => {
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

      const targetRef = db.collection('users').doc(decoded.uid);
      const targetSnapshot = await targetRef.get();
      if (targetSnapshot.exists) {
        res.json({ success: true, claimed: false, reason: 'profile-exists' });
        return;
      }

      // Resolve by the exact authenticated email, not by a caller-provided document ID.
      // This avoids local-part collisions such as person@example.com vs person@other.example.
      const matching = await db.collection('users').where('email', '==', email).limit(10).get();
      const pendingMatches = matching.docs.filter((item) => item.id.startsWith('pending_'));
      const nonPendingMatches = matching.docs.filter((item) => !item.id.startsWith('pending_') && item.id !== decoded.uid);

      if (nonPendingMatches.length > 0) {
        res.status(409).json({ error: 'A member profile already exists for this email' });
        return;
      }
      if (pendingMatches.length === 0) {
        res.json({ success: true, claimed: false, reason: 'no-pending-profile' });
        return;
      }
      if (pendingMatches.length !== 1) {
        res.status(409).json({ error: 'Multiple pending profiles exist for this email' });
        return;
      }

      const pendingRef = pendingMatches[0].ref;
      const directoryRef = db.collection('member_directory').doc(decoded.uid);
      let claimedProfile: Record<string, unknown> | null = null;

      await db.runTransaction(async (transaction) => {
        const [freshTarget, freshPending] = await Promise.all([
          transaction.get(targetRef),
          transaction.get(pendingRef),
        ]);

        if (freshTarget.exists) return;
        if (!freshPending.exists) throw new Error('Pending profile disappeared during claim');

        const pending = freshPending.data() || {};
        const pendingEmail = String(pending.email || '').trim().toLowerCase();
        if (pendingEmail !== email) throw new Error('Pending profile email no longer matches authenticated caller');

        const isBootstrapAdmin = email === 'kcfc.jp@gmail.com';
        const displayName = String(pending.displayName || authUser.displayName || 'Member').trim() || 'Member';
        const photoURL = String(pending.photoURL || authUser.photoURL || avatarUrl(displayName)).trim();
        const profile = {
          uid: decoded.uid,
          email,
          displayName,
          photoURL,
          roles: strings(pending.roles).length > 0 ? strings(pending.roles) : (isBootstrapAdmin ? ['admin'] : ['member']),
          ministries: strings(pending.ministries),
          lcRoles: strings(pending.lcRoles),
          isCoreMember: pending.isCoreMember === true,
          isEmailVerified: isBootstrapAdmin || authUser.emailVerified || pending.isEmailVerified === true,
          isVerified: isBootstrapAdmin || pending.isVerified === true,
          isDisabled: pending.isDisabled === true,
          createdAt: pending.createdAt || FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };

        transaction.set(targetRef, profile, { merge: false });
        transaction.delete(pendingRef);

        const projection = toMemberDirectoryProfile(decoded.uid, profile);
        if (projection) transaction.set(directoryRef, projection, { merge: false });
        else transaction.delete(directoryRef);
        claimedProfile = profile;
      });

      res.json({
        success: true,
        claimed: claimedProfile !== null,
        reason: claimedProfile ? 'claimed' : 'profile-exists',
      });
    } catch (error) {
      console.error('[PENDING PROFILE CLAIM ERROR]', error);
      res.status(500).json({ error: 'Pending profile claim failed' });
    }
  });
}
