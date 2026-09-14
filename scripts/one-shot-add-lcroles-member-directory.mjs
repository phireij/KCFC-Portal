import fs from 'node:fs';

const path = 'firestore.rules';
let source = fs.readFileSync(path, 'utf8');
const before = `                 'uid', 'displayName', 'photoURL', 'nickname', 'roles', 'ministries', 'isCoreMember'\n               ]) &&\n               data.uid == userId &&\n               data.displayName is string && data.displayName.size() <= 200 &&\n               data.get('photoURL', '') is string && data.get('photoURL', '').size() <= 2000 &&\n               data.get('nickname', '') is string && data.get('nickname', '').size() <= 120 &&\n               data.roles is list && data.roles.size() <= 10 &&\n               data.ministries is list && data.ministries.size() <= 20 &&\n               data.isCoreMember is bool;`;
const after = `                 'uid', 'displayName', 'photoURL', 'nickname', 'roles', 'ministries', 'lcRoles', 'isCoreMember'\n               ]) &&\n               data.uid == userId &&\n               data.displayName is string && data.displayName.size() <= 200 &&\n               data.get('photoURL', '') is string && data.get('photoURL', '').size() <= 2000 &&\n               data.get('nickname', '') is string && data.get('nickname', '').size() <= 120 &&\n               data.roles is list && data.roles.size() <= 10 &&\n               data.ministries is list && data.ministries.size() <= 20 &&\n               data.lcRoles is list && data.lcRoles.size() <= 20 &&\n               data.isCoreMember is bool;`;
const parts = source.split(before);
if (parts.length !== 2) throw new Error('Refusing member-directory rule update: expected exactly one projection allowlist anchor.');
source = `${parts[0]}${after}${parts[1]}`;
if (!source.includes("'lcRoles'")) throw new Error('member_directory rules did not gain lcRoles.');
fs.writeFileSync(path, source, 'utf8');
console.log('member_directory lcRoles rule update: PASS');
