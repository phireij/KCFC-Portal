export type LiturgicalAssignmentMap = Record<string, Record<string, string>>;

type AssignmentToken = string;

function assignmentsByUser(assignments: LiturgicalAssignmentMap = {}) {
  const result = new Map<string, Set<AssignmentToken>>();

  Object.entries(assignments).forEach(([massDate, dateAssignments]) => {
    Object.entries(dateAssignments || {}).forEach(([userId, role]) => {
      if (!userId || !role) return;
      const tokens = result.get(userId) || new Set<AssignmentToken>();
      tokens.add(`${massDate}::${role}`);
      result.set(userId, tokens);
    });
  });

  return result;
}

function sameTokens(a?: Set<AssignmentToken>, b?: Set<AssignmentToken>) {
  if (!a && !b) return true;
  if (!a || !b || a.size !== b.size) return false;
  for (const token of a) {
    if (!b.has(token)) return false;
  }
  return true;
}

export type AssignmentDiff = {
  addedUserIds: string[];
  removedUserIds: string[];
  changedUserIds: string[];
  affectedUserIds: string[];
};

/**
 * Compares the last deliberately published roster with the new roster draft.
 * User IDs are returned deterministically to make tests, auditing and recipient
 * planning stable. No Firestore data is mutated here.
 */
export function diffLiturgicalAssignments(
  previous: LiturgicalAssignmentMap = {},
  current: LiturgicalAssignmentMap = {},
): AssignmentDiff {
  const before = assignmentsByUser(previous);
  const after = assignmentsByUser(current);
  const allIds = Array.from(new Set([...before.keys(), ...after.keys()])).sort();

  const addedUserIds: string[] = [];
  const removedUserIds: string[] = [];
  const changedUserIds: string[] = [];

  allIds.forEach((userId) => {
    const prior = before.get(userId);
    const next = after.get(userId);
    if (!prior && next) {
      addedUserIds.push(userId);
      return;
    }
    if (prior && !next) {
      removedUserIds.push(userId);
      return;
    }
    if (!sameTokens(prior, next)) changedUserIds.push(userId);
  });

  return {
    addedUserIds,
    removedUserIds,
    changedUserIds,
    affectedUserIds: Array.from(new Set([
      ...addedUserIds,
      ...removedUserIds,
      ...changedUserIds,
    ])).sort(),
  };
}
