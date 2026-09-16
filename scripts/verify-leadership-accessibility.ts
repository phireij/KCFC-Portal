import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path: string) => fs.readFileSync(path, 'utf8');

const appShell = read('src/App.tsx');
const navbar = read('src/components/layout/Navbar.tsx');
const admin = read('src/pages/Admin.tsx');
const approvals = read('src/components/admin/MemberApprovalQueue.tsx');
const roles = read('src/components/admin/MemberRoleEditor.tsx');
const core = read('src/components/admin/CoreStatusPlanner.tsx');
const inquiries = read('src/components/admin/LeadershipInquiries.tsx');

assert.match(admin, /const adminRoles = \['admin', 'president'\]/, 'Leadership workspace must remain Admin/President-only.');
assert.match(appShell, /<Route path="\/admin"[^\n]*\['admin', 'president'\]/, 'The /admin route must remain Admin/President-only.');
assert.match(navbar, /\['admin', 'president'\]\.includes\(role\)/, 'Leadership navigation must remain Admin/President-only.');

assert.match(admin, /role="tablist"/);
assert.match(admin, /role="tab"/);
assert.match(admin, /aria-selected=/);
assert.match(admin, /aria-orientation="horizontal"/);
assert.match(admin, /tabIndex=\{selected \? 0 : -1\}/, 'Leadership tabs must use roving tabIndex');
assert.match(admin, /ArrowRight/);
assert.match(admin, /ArrowLeft/);
assert.match(admin, /ArrowDown/);
assert.match(admin, /ArrowUp/);
assert.match(admin, /event\.key === 'Home'/);
assert.match(admin, /event\.key === 'End'/);
assert.match(admin, /aria-controls="leadership-workspace-panel"/);
assert.match(admin, /role="tabpanel"/);
assert.match(admin, /aria-labelledby=\{activeTabId\}/);
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

console.log('Leadership route boundary, roving tabs, keyboard navigation, touch targets and safety accessibility guards verified.');
