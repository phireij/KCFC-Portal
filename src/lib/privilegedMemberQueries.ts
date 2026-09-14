import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { db } from './firebase';

export type PendingMemberSummary = {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
};

export function subscribePendingMembers(
  onMembers: (members: PendingMemberSummary[]) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    query(collection(db, 'users'), where('isVerified', '==', false)),
    (snapshot) => onMembers(snapshot.docs.flatMap((item) => {
      const data = item.data();
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
    })),
    (error) => onError?.(error),
  );
}

export function subscribePendingMemberCount(
  onCount: (count: number) => void,
  onError?: (error: Error) => void,
) {
  return subscribePendingMembers(
    (members) => onCount(members.length),
    onError,
  );
}

export type PrivilegedPollEmailRecipient = {
  uid: string;
  email: string;
  displayName: string;
  nickname?: string;
  isCoreMember: boolean;
  ministries: string[];
};

export async function listPrivilegedPollEmailRecipients(): Promise<PrivilegedPollEmailRecipient[]> {
  const snapshot = await getDocs(query(collection(db, 'users'), where('isVerified', '==', true)));
  return snapshot.docs.flatMap((item) => {
    const data = item.data();
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
}
