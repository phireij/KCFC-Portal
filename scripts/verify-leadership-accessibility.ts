import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

const admin = read('src/pages/Admin.tsx');
const approvals = read('src/components/admin/MemberApprovalQueue.tsx');
const roles = read('src/components/admin/MemberRoleEditor.tsx');
const core = read('src/components/admin/CoreStatusPlanner.tsx');
const inquiries = read('src/components/admin/LeadershipInquiries.tsx');

assert.match(admin, /role="tablist"/);
assert.match(admin, /role="tab"/);
assert.match(admin, /aria-selected=/);
assert.match(admin, /role="tabpanel"/);
assert.match(admin, /focus-visible:ring-2/);

for (const [name, source] of [
  ['MemberApprovalQueue', approvals],
  ['MemberRoleEditor', roles],
  ['CoreStatusPlanner', core],
  ['LeadershipInquiries', inquiries],
] as const) {
  assert.match(source, /focus-visible:ring-2/, `${name} must expose visible keyboard focus`);
  assert.match(source, /min-h-(11|12|14)/, `${name} must retain phone-friendly touch targets`);
}

assert.match(roles, /aria-pressed=/, 'Role/ministry toggles must expose pressed state');
assert.match(core, /aria-pressed=/, 'Core status preview toggles must expose pressed state');
assert.match(core, /Read-only impact preview/, 'Core status planner must remain explicitly preview-only');
assert.match(approvals, /without recreating the Firebase account, changing the UID/, 'Approval UX must retain identity-preservation copy');

assert.doesNotMatch(admin, /onClick=.*delete/i, 'Routine Leadership shell must not expose inline deletion actions');

console.log('Leadership keyboard, touch-target and safety accessibility guards verified.');
