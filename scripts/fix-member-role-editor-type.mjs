import fs from 'node:fs';

const path = 'src/components/admin/MemberRoleEditor.tsx';
let source = fs.readFileSync(path, 'utf8');
const from = "const updates: Partial<UserProfile> & { updatedAt: unknown; lcRoles?: string[] } = {";
const to = "const updates: { roles: UserRole[]; ministries: MinistryType[]; updatedAt: ReturnType<typeof serverTimestamp>; lcRoles?: string[] } = {";
if (!source.includes(from)) throw new Error('Expected member-role update typing anchor not found.');
source = source.replace(from, to);
fs.writeFileSync(path, source);
console.log('Corrected Firestore serverTimestamp typing in MemberRoleEditor.');
