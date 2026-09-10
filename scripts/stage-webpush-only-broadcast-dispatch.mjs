import fs from 'node:fs';

const path = 'src/components/admin/BroadcastTool.tsx';
let source = fs.readFileSync(path, 'utf8');

const importAnchor = "import { buildLeadershipBroadcastCreatorPlan } from '../../lib/broadcastCreatorPlan';";
const newImport = "import { buildLeadershipBroadcastCreatorPlan, shouldDispatchPwaForPlan } from '../../lib/broadcastCreatorPlan';";
if (source.includes(importAnchor)) source = source.replace(importAnchor, newImport);

const oldCondition = 'if (currentUser && creatorPlan.pushRecipientIds.length > 0 && creatorPlan.pushTokens.length > 0) {';
const newCondition = 'if (currentUser && shouldDispatchPwaForPlan(creatorPlan)) {';
if (source.includes(oldCondition)) {
  source = source.replace(oldCondition, newCondition);
} else if (!source.includes(newCondition)) {
  throw new Error('Web Push-only dispatch migration: condition anchor not found.');
}

fs.writeFileSync(path, source);
console.log('Staged Web Push-only leadership broadcast dispatch support.');
