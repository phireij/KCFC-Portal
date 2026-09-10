import fs from 'node:fs';

const path = 'src/components/admin/BroadcastTool.tsx';
let source = fs.readFileSync(path, 'utf8');

const importAnchor = "import { cn } from '../../lib/utils';\n";
if (!source.includes("buildLeadershipBroadcastCreatorPlan")) {
  if (!source.includes(importAnchor)) throw new Error('Broadcast migration: import anchor not found.');
  source = source.replace(
    importAnchor,
    `${importAnchor}import { buildLeadershipBroadcastCreatorPlan } from '../../lib/broadcastCreatorPlan';\nimport { appendCommunicationNotificationsToBatch } from '../../lib/communicationFirestore';\n`,
  );
}

source = source.replace(
  '    return Array.from(allMatched.values());',
  '    return Array.from(allMatched.values()).filter(u => !u.isDisabled);',
);

const portalStart = source.indexOf('      // 1. Send via Portal (Firestore notifications & FCM Smartphone Alerts)');
const emailStart = source.indexOf('      // 2. Send via Email (Direct Gmail API integration)');
if (portalStart === -1 || emailStart === -1 || emailStart <= portalStart) {
  throw new Error('Broadcast migration: portal/email block anchors not found.');
}

const replacement = `      // 1. Send via Portal (durable Inbox + preference-aware FCM targets)\n      if (sendInPortal) {\n        const broadcastId = \`broadcast-\${Date.now()}-\${Math.random().toString(36).slice(2, 8)}\`;\n        const creatorPlan = buildLeadershipBroadcastCreatorPlan({\n          recipients: filteredRecipients,\n          broadcastId,\n          title,\n          message,\n          allowPwa: true,\n        });\n\n        const batch = writeBatch(db);\n        appendCommunicationNotificationsToBatch(batch, db, creatorPlan);\n        await batch.commit();\n\n        // Trigger native smartphone alert only for recipients whose routing plan includes PWA.\n        try {\n          const currentUser = auth.currentUser;\n          if (currentUser && creatorPlan.pushRecipientIds.length > 0 && creatorPlan.pushTokens.length > 0) {\n            const idToken = await currentUser.getIdToken();\n            const fcmBody = message\n              .replace(/\\[name\\]/gi, 'Member')\n              .replace(/\\{name\\}/gi, 'Member')\n              .replace(/\\[nickname\\]/gi, 'Member')\n              .replace(/\\{nickname\\}/gi, 'Member');\n\n            const pResponse = await fetch('/api/admin/broadcast-custom-push', {\n              method: 'POST',\n              headers: {\n                'Content-Type': 'application/json',\n                'Authorization': \`Bearer \${idToken}\`\n              },\n              body: JSON.stringify({\n                userIds: creatorPlan.pushRecipientIds,\n                recipientTokens: creatorPlan.pushTokens,\n                title: \`Broadcast: \${title}\`,\n                body: fcmBody,\n                clickAction: '/inbox'\n              })\n            });\n            const pResult = await pResponse.json();\n            console.info('FCM smartphone alerts dispatch completed:', pResult);\n          }\n        } catch (pushErr) {\n          console.error('FCM smartphone alerts dispatch failed:', pushErr);\n        }\n      }\n\n`;

source = source.slice(0, portalStart) + replacement + source.slice(emailStart);
fs.writeFileSync(path, source);
console.log('Staged BroadcastTool communication migration.');
