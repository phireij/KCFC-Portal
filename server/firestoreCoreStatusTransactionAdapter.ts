import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { toMemberDirectoryProfile } from '../src/lib/memberPublicProjection';
import type { UserProfile } from '../src/types';
import type {
  CoreStatusAuditRecord,
  CoreStatusTransactionAdapter,
} from './coreStatusStagingExecutor';

function timestampFromIso(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Core-status transaction received an invalid ISO timestamp.');
  }
  return Timestamp.fromDate(date);
}

export function createFirestoreCoreStatusTransactionAdapter(db: Firestore): CoreStatusTransactionAdapter {
  return {
    async runTransaction(work) {
      return db.runTransaction(async (firestoreTransaction) => {
        const loadedMembers = new Map<string, UserProfile>();

        return work({
          async getMember(uid) {
            const ref = db.collection('users').doc(uid);
            const snapshot = await firestoreTransaction.get(ref);
            if (!snapshot.exists) return null;
            const member = { uid: snapshot.id, ...snapshot.data() } as UserProfile;
            loadedMembers.set(uid, member);
            return member;
          },

          async updateMember(uid, update) {
            const ref = db.collection('users').doc(uid);
            const current = loadedMembers.get(uid);
            if (!current) {
              throw new Error('Core-status transaction must read the member before updating it.');
            }

            const updatedAt = timestampFromIso(update.updatedAt);
            firestoreTransaction.update(ref, {
              isCoreMember: update.isCoreMember,
              roles: update.roles,
              ministries: update.ministries,
              updatedAt,
            });

            const nextMember = {
              ...current,
              isCoreMember: update.isCoreMember,
              roles: update.roles,
              ministries: update.ministries,
              updatedAt,
            };
            const projection = toMemberDirectoryProfile(uid, {
              ...nextMember,
            } as unknown as Record<string, unknown>);
            const directoryRef = db.collection('member_directory').doc(uid);
            if (projection) {
              firestoreTransaction.set(directoryRef, projection, { merge: false });
            } else {
              firestoreTransaction.delete(directoryRef);
            }
          },

          async appendAudit(record: CoreStatusAuditRecord) {
            const ref = db.collection('leadership_audit').doc(record.eventId);
            firestoreTransaction.create(ref, {
              ...record,
              committedAt: timestampFromIso(record.committedAt),
              createdAt: FieldValue.serverTimestamp(),
            });
          },
        });
      });
    },
  };
}
