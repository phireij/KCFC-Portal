import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
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
        return work({
          async getMember(uid) {
            const ref = db.collection('users').doc(uid);
            const snapshot = await firestoreTransaction.get(ref);
            if (!snapshot.exists) return null;
            return { uid: snapshot.id, ...snapshot.data() } as UserProfile;
          },

          async updateMember(uid, update) {
            const ref = db.collection('users').doc(uid);
            firestoreTransaction.update(ref, {
              isCoreMember: update.isCoreMember,
              roles: update.roles,
              ministries: update.ministries,
              updatedAt: timestampFromIso(update.updatedAt),
            });
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
