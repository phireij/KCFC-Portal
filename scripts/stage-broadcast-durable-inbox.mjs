import fs from 'node:fs';

const path = 'src/components/admin/BroadcastTool.tsx';
let source = fs.readFileSync(path, 'utf8');

const setupAnchor = `    setSending(true);\n    const broadcastId = \`broadcast-\${Date.now()}-\${Math.random().toString(36).slice(2, 8)}\`;\n    let notificationIdsByUser: Record<string, string[]> = {};\n    try {`;
const setupReplacement = `    setSending(true);\n    const broadcastId = \`broadcast-\${Date.now()}-\${Math.random().toString(36).slice(2, 8)}\`;\n    const creatorPlan = buildLeadershipBroadcastCreatorPlan({\n      recipients: filteredRecipients,\n      broadcastId,\n      title,\n      message,\n      allowPwa: sendInPortal,\n      allowEmail: sendByEmail,\n    });\n    let notificationIdsByUser: Record<string, string[]> = {};\n    try {`;
if (source.includes(setupAnchor)) source = source.replace(setupAnchor, setupReplacement);
if (!source.includes('allowPwa: sendInPortal')) throw new Error('Durable Inbox migration: shared creator-plan setup anchor missing.');

const portalAnchor = `      // 1. Send via Portal (durable Inbox + preference-aware FCM targets)\n      if (sendInPortal) {\n        const creatorPlan = buildLeadershipBroadcastCreatorPlan({\n          recipients: filteredRecipients,\n          broadcastId,\n          title,\n          message,\n          allowPwa: true,\n          allowEmail: sendByEmail,\n        });\n\n        const batch = writeBatch(db);`;
const portalReplacement = `      // 1. Always create the durable KCFC Inbox record; secondary channels remain preference-aware.\n      {\n        const batch = writeBatch(db);`;
if (source.includes(portalAnchor)) source = source.replace(portalAnchor, portalReplacement);
if (!source.includes('Always create the durable KCFC Inbox record')) throw new Error('Durable Inbox migration: Portal block anchor missing.');

const pushStartAnchor = `        // Trigger native smartphone alert only for recipients whose routing plan includes PWA.\n        try {`;
const pushStartReplacement = `        // Trigger native smartphone alert only when the leader selected Portal/PWA delivery.\n        if (sendInPortal) {\n          try {`;
if (source.includes(pushStartAnchor)) source = source.replace(pushStartAnchor, pushStartReplacement);
if (!source.includes('if (sendInPortal) {\n          try {')) throw new Error('Durable Inbox migration: PWA gate anchor missing.');

const pushEndAnchor = `        } catch (pushErr) {\n          console.error('FCM smartphone alerts dispatch failed:', pushErr);\n        }\n      }\n\n      // 2. Send via Email (Direct Gmail API integration)`;
const pushEndReplacement = `          } catch (pushErr) {\n            console.error('FCM smartphone alerts dispatch failed:', pushErr);\n          }\n        }\n      }\n\n      // 2. Send via Email (Direct Gmail API integration)`;
if (source.includes(pushEndAnchor)) source = source.replace(pushEndAnchor, pushEndReplacement);
if (!source.includes("console.error('FCM smartphone alerts dispatch failed:', pushErr);\n          }\n        }")) throw new Error('Durable Inbox migration: PWA closing anchor missing.');

const emailPlanAnchor = `      if (sendByEmail) {\n        const emailRoutingPlan = buildLeadershipBroadcastCreatorPlan({\n          recipients: filteredRecipients,\n          broadcastId,\n          title,\n          message,\n          allowPwa: false,\n          allowEmail: true,\n        });\n        const emailRecipientIds = new Set(emailRoutingPlan.emailRecipientIds);`;
const emailPlanReplacement = `      if (sendByEmail) {\n        const emailRecipientIds = new Set(creatorPlan.emailRecipientIds);`;
if (source.includes(emailPlanAnchor)) source = source.replace(emailPlanAnchor, emailPlanReplacement);
if (!source.includes('const emailRecipientIds = new Set(creatorPlan.emailRecipientIds);')) throw new Error('Durable Inbox migration: email plan reuse anchor missing.');

const confirmationAnchor = `    if (sendInPortal) channels.push("Portal notifications");\n    if (sendByEmail) channels.push("Emails");`;
const confirmationReplacement = `    if (sendInPortal) channels.push("PWA/Portal alerts");\n    if (sendByEmail) channels.push("Emails");`;
if (source.includes(confirmationAnchor)) source = source.replace(confirmationAnchor, confirmationReplacement);

const subtitleAnchor = `          <p className="text-gray-500 dark:text-gray-400 font-serif italic text-sm">Send notifications inside the portal or via direct emails.</p>`;
const subtitleReplacement = `          <p className="text-gray-500 dark:text-gray-400 font-serif italic text-sm">Every broadcast keeps a durable KCFC Inbox copy; PWA and email are secondary alerts.</p>`;
if (source.includes(subtitleAnchor)) source = source.replace(subtitleAnchor, subtitleReplacement);

fs.writeFileSync(path, source);
console.log('Staged unconditional durable Inbox creation for leadership broadcasts.');
