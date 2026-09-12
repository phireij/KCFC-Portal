import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src/components/layout/Navbar.tsx', 'utf8');

const home = source.indexOf("label: 'Home'");
const schedule = source.indexOf("label: 'Schedule'");
const community = source.indexOf("label: 'Community'");
const updates = source.indexOf("label: 'Updates'");
const more = source.indexOf("label: 'More'");
assert.ok(home >= 0 && home < schedule && schedule < community && community < updates && updates < more, 'Primary mobile navigation must remain Home → Schedule → Community → Updates → More.');

assert.match(source, /grid-cols-5/, 'Mobile primary navigation must remain five equal destinations.');
assert.match(source, /min-h-\[62px\]/, 'Mobile primary navigation targets must remain comfortably above the 44px minimum.');
assert.match(source, /safe-area-inset-bottom/, 'Bottom navigation must retain iPhone safe-area spacing.');
assert.match(source, /aria-label="Primary mobile navigation"/, 'Mobile navigation requires a dedicated accessible label.');
assert.match(source, /aria-expanded=\{showMore\}/, 'More must expose expanded state.');
assert.match(source, /aria-controls="kcfc-more-sheet"/, 'More must identify its controlled sheet.');
assert.match(source, /role="dialog"/, 'More sheet must retain dialog semantics.');
assert.match(source, /aria-modal="true"/, 'More sheet must remain modal to assistive technology.');
assert.match(source, /aria-label="Close more menu"/, 'More sheet backdrop must retain an accessible close action.');
assert.match(source, /aria-label="Close"/, 'More sheet close button must remain named.');
assert.match(source, /focus-visible:ring-2/, 'Navigation controls must retain visible keyboard focus.');
assert.doesNotMatch(source, /overflow-x-auto/, 'Primary navigation must not regress to horizontal scrolling.');

assert.match(source, /\['admin', 'president', 'treasurer'\]/, 'Accounting navigation must remain role-gated.');
assert.match(source, /\['admin', 'president', 'vice_president', 'secretary', 'auditor'\]/, 'Leadership navigation must remain role-gated.');

console.log('Mobile navigation order, touch targets, safe areas, dialog semantics and role gates verified.');
