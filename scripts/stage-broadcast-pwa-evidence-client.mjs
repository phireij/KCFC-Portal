import fs from 'node:fs';

const path = 'src/components/admin/BroadcastTool.tsx';
let source = fs.readFileSync(path, 'utf8');

if (source.includes('notificationIdsByUser: persistedPlan.notificationIdsByUser')) {
  console.log('Broadcast PWA evidence client migration already staged.');
  process.exit(0);
}

const appendAnchor = `        const batch = writeBatch(db);\n        appendCommunicationNotificationsToBatch(batch, db, creatorPlan);\n        await batch.commit();`;
const appendReplacement = `        const batch = writeBatch(db);\n        const persistedPlan = appendCommunicationNotificationsToBatch(batch, db, creatorPlan);\n        await batch.commit();`;
if (!source.includes(appendAnchor)) throw new Error('Broadcast PWA evidence client migration: persisted plan anchor not found.');
source = source.replace(appendAnchor, appendReplacement);

const bodyAnchor = `                userIds: creatorPlan.pushRecipientIds,\n                recipientTokens: creatorPlan.pushTokens,\n                title: \`Broadcast: \${title}\`,`;
const bodyReplacement = `                userIds: creatorPlan.pushRecipientIds,\n                recipientTokens: creatorPlan.pushTokens,\n                notificationIdsByUser: persistedPlan.notificationIdsByUser,\n                title: \`Broadcast: \${title}\`,`;
if (!source.includes(bodyAnchor)) throw new Error('Broadcast PWA evidence client migration: request body anchor not found.');
source = source.replace(bodyAnchor, bodyReplacement);

const logAnchor = `            const pResult = await pResponse.json();\n            console.info('FCM smartphone alerts dispatch completed:', pResult);`;
const logReplacement = `            const pResult = await pResponse.json();\n            console.info('FCM smartphone alerts dispatch completed:', pResult);\n            if (typeof pResult.persistedDeliveryRecords === 'number') {\n              console.info('KCFC Inbox PWA delivery evidence persisted for records:', pResult.persistedDeliveryRecords);\n            }`;
if (!source.includes(logAnchor)) throw new Error('Broadcast PWA evidence client migration: response log anchor not found.');
source = source.replace(logAnchor, logReplacement);

fs.writeFileSync(path, source);
console.log('Staged BroadcastTool PWA evidence correlation with exact Inbox record IDs.');
