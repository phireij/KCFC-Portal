import fs from 'node:fs';

const path = 'src/components/admin/BroadcastTool.tsx';
let source = fs.readFileSync(path, 'utf8');

const importAnchor = "import { appendCommunicationNotificationsToBatch } from '../../lib/communicationFirestore';";
const importReplacement = "import { appendCommunicationNotificationsToBatch, persistCommunicationDeliveryOutcome } from '../../lib/communicationFirestore';";
if (source.includes(importAnchor)) source = source.replace(importAnchor, importReplacement);
if (!source.includes(importReplacement)) throw new Error('Email evidence migration: communication Firestore import anchor missing.');

const sendStartAnchor = `    setSending(true);\n    try {\n      // 1. Send via Portal (durable Inbox + preference-aware FCM targets)`;
const sendStartReplacement = `    setSending(true);\n    const broadcastId = \`broadcast-\${Date.now()}-\${Math.random().toString(36).slice(2, 8)}\`;\n    let notificationIdsByUser: Record<string, string[]> = {};\n    try {\n      // 1. Send via Portal (durable Inbox + preference-aware FCM targets)`;
if (source.includes(sendStartAnchor)) source = source.replace(sendStartAnchor, sendStartReplacement);
if (!source.includes('let notificationIdsByUser: Record<string, string[]> = {};')) throw new Error('Email evidence migration: send-start anchor missing.');

source = source.replace(`        const broadcastId = \`broadcast-\${Date.now()}-\${Math.random().toString(36).slice(2, 8)}\`;\n`, '');

const planAnchor = `          message,\n          allowPwa: true,\n        });`;
const planReplacement = `          message,\n          allowPwa: true,\n          allowEmail: sendByEmail,\n        });`;
if (source.includes(planAnchor)) source = source.replace(planAnchor, planReplacement);
if (!source.includes('allowEmail: sendByEmail')) throw new Error('Email evidence migration: Portal creator-plan anchor missing.');

const commitAnchor = `        const persistedPlan = appendCommunicationNotificationsToBatch(batch, db, creatorPlan);\n        await batch.commit();`;
const commitReplacement = `        const persistedPlan = appendCommunicationNotificationsToBatch(batch, db, creatorPlan);\n        await batch.commit();\n        notificationIdsByUser = persistedPlan.notificationIdsByUser;`;
if (source.includes(commitAnchor)) source = source.replace(commitAnchor, commitReplacement);
if (!source.includes('notificationIdsByUser = persistedPlan.notificationIdsByUser;')) throw new Error('Email evidence migration: persisted plan anchor missing.');

const emailPlanAnchor = `          recipients: filteredRecipients,\n          title,\n          message,\n          allowPwa: false,`;
const emailPlanReplacement = `          recipients: filteredRecipients,\n          broadcastId,\n          title,\n          message,\n          allowPwa: false,`;
if (source.includes(emailPlanAnchor)) source = source.replace(emailPlanAnchor, emailPlanReplacement);

const successAnchor = `            await sendGmail(recipientEmail, title, personalizedHtml);\n            successCount++;`;
const successReplacement = `            await sendGmail(recipientEmail, title, personalizedHtml);\n            const notificationIds = notificationIdsByUser[u.uid] || [];\n            if (notificationIds.length > 0) {\n              await persistCommunicationDeliveryOutcome({\n                firestore: db,\n                notificationIds,\n                userId: u.uid,\n                channel: 'email',\n                status: 'sent',\n                detail: 'Accepted by the authorized Gmail send path.',\n              });\n            }\n            successCount++;`;
if (source.includes(successAnchor)) source = source.replace(successAnchor, successReplacement);
if (!source.includes("channel: 'email',\n                status: 'sent'")) throw new Error('Email evidence migration: Gmail success anchor missing.');

const failureAnchor = `          } catch (mailErr: any) {\n            console.error(\`Failed to send email to \${u.email}:\`, mailErr);\n            failCount++;`;
const failureReplacement = `          } catch (mailErr: any) {\n            console.error(\`Failed to send email to \${u.email}:\`, mailErr);\n            const notificationIds = notificationIdsByUser[u.uid] || [];\n            if (notificationIds.length > 0) {\n              try {\n                await persistCommunicationDeliveryOutcome({\n                  firestore: db,\n                  notificationIds,\n                  userId: u.uid,\n                  channel: 'email',\n                  status: 'failed',\n                  detail: mailErr?.message || 'Gmail send failed.',\n                });\n              } catch (evidenceErr) {\n                console.error('Failed to persist Gmail delivery evidence:', evidenceErr);\n              }\n            }\n            failCount++;`;
if (source.includes(failureAnchor)) source = source.replace(failureAnchor, failureReplacement);
if (!source.includes("channel: 'email',\n                  status: 'failed'")) throw new Error('Email evidence migration: Gmail failure anchor missing.');

fs.writeFileSync(path, source);
console.log('Staged Gmail transport evidence persistence against exact KCFC Inbox records.');
