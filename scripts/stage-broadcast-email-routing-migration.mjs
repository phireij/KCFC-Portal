import fs from 'node:fs';

const path = 'src/components/admin/BroadcastTool.tsx';
let source = fs.readFileSync(path, 'utf8');

const oldBlock = `      if (sendByEmail) {\n        const recipientList = filteredRecipients\n          .filter(u => !!u.email && u.email.includes('@'));`;

const newBlock = `      if (sendByEmail) {\n        const emailRoutingPlan = buildLeadershipBroadcastCreatorPlan({\n          recipients: filteredRecipients,\n          title,\n          message,\n          allowPwa: false,\n          allowEmail: true,\n        });\n        const emailRecipientIds = new Set(emailRoutingPlan.emailRecipientIds);\n        const recipientList = filteredRecipients\n          .filter(u => emailRecipientIds.has(u.uid) && !!u.email && u.email.includes('@'));`;

if (!source.includes(oldBlock)) {
  if (source.includes('const emailRoutingPlan = buildLeadershipBroadcastCreatorPlan({')) {
    console.log('Broadcast email routing alignment already staged.');
    process.exit(0);
  }
  throw new Error('Broadcast email migration: recipient block anchor not found.');
}

source = source.replace(oldBlock, newBlock);
fs.writeFileSync(path, source);
console.log('Staged preference-aware BroadcastTool email routing alignment.');
