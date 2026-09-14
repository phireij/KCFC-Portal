import fs from 'node:fs';

function replaceOnce(path, before, after, label) {
  const source = fs.readFileSync(path, 'utf8');
  const parts = source.split(before);
  if (parts.length !== 2) throw new Error(`Expected exactly one ${label} anchor in ${path}.`);
  fs.writeFileSync(path, `${parts[0]}${after}${parts[1]}`, 'utf8');
}

replaceOnce(
  'firestore.rules',
  '      allow get: if isOwner(userId) || isAdmin() || isLeader();\n      allow list: if isAdmin() || isLeader();',
  '      allow get: if isOwner(userId) || canAdministerMembers();\n      allow list: if canAdministerMembers();',
  'private users read rules',
);

replaceOnce(
  'scripts/verify-private-user-read-boundary.ts',
  "const expectedGet = 'allow get: if isOwner(userId) || isAdmin() || isLeader();';\nconst expectedList = 'allow list: if isAdmin() || isLeader();';",
  "const expectedGet = 'allow get: if isOwner(userId) || canAdministerMembers();';\nconst expectedList = 'allow list: if canAdministerMembers();';",
  'private users verifier expectations',
);

replaceOnce(
  'scripts/verify-private-user-read-boundary.ts',
  "    throw new Error('Private users get must be limited to self or authorized governance roles.');",
  "    throw new Error('Private users get must be limited to self or Admin/President member administrators.');",
  'get error message',
);

replaceOnce(
  'scripts/verify-private-user-read-boundary.ts',
  "    throw new Error('Private users list must be limited to authorized governance roles.');",
  "    throw new Error('Private users list must be limited to Admin/President member administrators.');",
  'list error message',
);

console.log('Private users read tightening patch: PASS');
