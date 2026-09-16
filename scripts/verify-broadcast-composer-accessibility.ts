import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('src/components/admin/BroadcastTool.tsx', 'utf8');

assert.ok(source.includes('kcfc-surface overflow-hidden p-4 sm:p-6 lg:p-8'), 'Broadcast composer should use the responsive KCFC surface.');
assert.ok(source.includes('aria-pressed={sendInPortal}'), 'PWA/Portal channel toggle must expose pressed state.');
assert.ok(source.includes('aria-pressed={sendByEmail}'), 'Email channel toggle must expose pressed state.');
assert.ok(source.includes('aria-label="Search members by name or email"'), 'Member search must have an accessible name.');
assert.ok(source.includes('aria-label={`Remove ${u.displayName || u.email || \'member\'} from selection`}'), 'Selected member removal must have an accessible name.');
assert.ok(source.includes('aria-pressed={isSelected}'), 'Search-result member selection must expose pressed state.');
assert.ok(source.includes('min-h-11 w-full p-2.5 text-left text-xs'), 'Member search results must meet the mobile touch-height baseline.');
assert.ok(source.includes('min-h-16 p-4 rounded-2xl border text-left'), 'Distribution channel toggles must provide a large touch target.');
assert.ok(source.includes('min-h-11 min-w-11'), 'Compact composer actions must provide practical touch targets.');
assert.ok(source.includes('PWA / Portal Alert'), 'Composer copy must distinguish the PWA/Portal secondary alert.');
assert.ok(source.includes('Email Partner Alert'), 'Composer copy must identify email as a partner alert.');
assert.ok(source.includes('Every broadcast keeps a durable KCFC Inbox copy'), 'Composer must explain Inbox source-of-truth behavior.');
assert.equal(source.includes('#5A5A40'), false, 'Legacy olive identity must not return to the leadership broadcast composer.');
assert.equal(source.includes('#4A4A30'), false, 'Legacy olive text identity must not return to generated leadership email styling.');

console.log('Leadership broadcast composer accessibility verification passed.');
