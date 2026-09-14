import fs from 'node:fs';

const rulesPath = 'firestore.rules';
let rules = fs.readFileSync(rulesPath, 'utf8');
const before = `      allow get: if isSignedIn();\n      allow list: if isApproved();`;
const after = `      allow get: if isOwner(userId) || isAdmin() || isLeader();\n      allow list: if isAdmin() || isLeader();`;
const ruleParts = rules.split(before);
if (ruleParts.length !== 2) throw new Error('Refusing private user read cutover: expected exactly one broad users-read anchor.');
rules = `${ruleParts[0]}${after}${ruleParts[1]}`;
fs.writeFileSync(rulesPath, rules, 'utf8');

const packagePath = 'package.json';
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const marker = 'npx tsx scripts/verify-private-user-read-boundary.ts';
if (!packageJson.scripts?.lint || typeof packageJson.scripts.lint !== 'string') {
  throw new Error('Refusing private user read cutover: lint script missing.');
}
if (!packageJson.scripts.lint.includes(marker)) {
  const anchor = 'npx tsx scripts/verify-member-public-projection.ts';
  if (!packageJson.scripts.lint.includes(anchor)) throw new Error('Refusing private user read cutover: lint anchor missing.');
  packageJson.scripts.lint = packageJson.scripts.lint.replace(anchor, `${anchor} && ${marker}`);
}
fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');

console.log('Private users read-boundary cutover: PASS');
