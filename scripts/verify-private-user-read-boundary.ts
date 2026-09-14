import fs from 'node:fs';

const rules = fs.readFileSync('firestore.rules', 'utf8');
const usersStart = rules.indexOf('match /users/{userId}');
const usersEnd = rules.indexOf('// --- Public-safe Member Directory Projection ---', usersStart);
if (usersStart < 0 || usersEnd < 0) {
  throw new Error('Firestore rules must contain a bounded users rule block.');
}
const usersRules = rules.slice(usersStart, usersEnd);

const expectedGet = 'allow get: if isOwner(userId) || isAdmin() || isLeader();';
const expectedList = 'allow list: if isAdmin() || isLeader();';
if (!usersRules.includes(expectedGet)) {
  throw new Error('Private users get must be limited to self or authorized governance roles.');
}
if (!usersRules.includes(expectedList)) {
  throw new Error('Private users list must be limited to authorized governance roles.');
}
for (const forbidden of [
  'allow get: if isSignedIn();',
  'allow list: if isApproved();',
]) {
  if (usersRules.includes(forbidden)) {
    throw new Error(`Over-broad private users read rule remains: ${forbidden}`);
  }
}

const projectionStart = rules.indexOf('match /member_directory/{userId}');
const projectionEnd = rules.indexOf('// --- Polls Collection ---', projectionStart);
const projectionRules = rules.slice(projectionStart, projectionEnd);
if (!projectionRules.includes('allow read: if isApproved();')) {
  throw new Error('Approved members must retain access to the sanitized member_directory projection.');
}

console.log('Private user read boundary: PASS');
