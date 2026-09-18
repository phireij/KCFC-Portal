export interface MemberPreRegistrationInput {
  email: string;
  displayName: string;
}

export interface MemberPreRegistrationPlan {
  documentId: string;
  email: string;
  displayName: string;
  profile: {
    uid: string;
    email: string;
    displayName: string;
    photoURL: string;
    roles: ['member'];
    ministries: [];
    isEmailVerified: boolean;
    isVerified: boolean;
    isDisabled: boolean;
  };
}

export function normalizeMemberPreRegistrationEmail(email: string) {
  return email.trim().toLowerCase();
}

export function buildPendingMemberDocumentId(email: string) {
  const normalizedEmail = normalizeMemberPreRegistrationEmail(email);
  // New pending records encode the complete normalized email so two accounts that
  // share a local-part at different domains cannot collide. The trusted claim route
  // resolves historical and new pending records by exact stored email, so existing
  // legacy pending_<localpart> documents remain compatible without migration.
  return `pending_${encodeURIComponent(normalizedEmail)}`;
}

export function buildMemberPreRegistrationPlan(input: MemberPreRegistrationInput): MemberPreRegistrationPlan {
  const email = normalizeMemberPreRegistrationEmail(input.email);
  const displayName = input.displayName.trim();

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error('Enter a valid email address.');
  }
  if (!displayName) {
    throw new Error('Enter the member name.');
  }

  const documentId = buildPendingMemberDocumentId(email);
  const photoName = encodeURIComponent(displayName);

  return {
    documentId,
    email,
    displayName,
    profile: {
      uid: documentId,
      email,
      displayName,
      photoURL: `https://ui-avatars.com/api/?name=${photoName}&background=123B66&color=fff`,
      roles: ['member'],
      ministries: [],
      isEmailVerified: false,
      isVerified: false,
      isDisabled: false,
    },
  };
}
