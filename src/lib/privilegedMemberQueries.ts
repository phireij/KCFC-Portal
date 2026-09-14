import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from './firebase';

export function subscribePendingMemberCount(
  onCount: (count: number) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    query(collection(db, 'users'), where('isVerified', '==', false)),
    (snapshot) => onCount(snapshot.docs.filter((item) => {
      const email = String(item.data().email || '').trim().toLowerCase();
      return email !== 'kcfc.jp@gmail.com';
    }).length),
    (error) => onError?.(error),
  );
}
