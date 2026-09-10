import fs from 'node:fs';

const path = 'server.ts';
let source = fs.readFileSync(path, 'utf8');

const importAnchor = 'import webpush from "web-push";\n';
const importLine = 'import { buildPwaDeliveryEvidence, type PwaTransportAttempt } from "./src/lib/pwaDeliveryEvidence";\n';
if (!source.includes(importLine)) {
  if (!source.includes(importAnchor)) throw new Error('PWA evidence migration: web-push import anchor not found.');
  source = source.replace(importAnchor, importAnchor + importLine);
}

const endpointStart = source.indexOf('  app.post("/api/admin/broadcast-custom-push", async (req, res) => {');
const endpointEnd = source.indexOf('  // Secure user-facing API endpoint for self-testing smartphone push notifications', endpointStart);
if (endpointStart === -1 || endpointEnd === -1 || endpointEnd <= endpointStart) {
  throw new Error('PWA evidence migration: custom push endpoint bounds not found.');
}

let block = source.slice(endpointStart, endpointEnd);
if (block.includes('const deliveryResultsByUser = buildPwaDeliveryEvidence(')) {
  console.log('PWA delivery evidence server migration already staged.');
  process.exit(0);
}

const permissionAnchor = `      if (!hasPermission) {\n        res.status(403).json({ error: "Forbidden: You do not have permission to send push notifications" });\n        return;\n      }\n\n`;
const targetSetup = `      if (!hasPermission) {\n        res.status(403).json({ error: "Forbidden: You do not have permission to send push notifications" });\n        return;\n      }\n\n      // Resolve target profiles once so transport results can be attributed honestly per member.\n      const targetUserIds = Array.from(new Set(userIds.filter((id: unknown): id is string => typeof id === "string" && id.trim() !== "")));\n      const targetUserIdSet = new Set(targetUserIds);\n      const targetUsers = (await fetchAllUsersWithFallback(token)).filter(u => targetUserIdSet.has(u.id));\n      const pwaAttempts: PwaTransportAttempt[] = [];\n      const tokenOwners = new Map<string, string[]>();\n      targetUsers.forEach(u => {\n        const tokens = Array.isArray(u.fcmTokens) ? u.fcmTokens.filter(isDeliverableFcmToken) : [];\n        tokens.forEach((deviceToken: string) => {\n          const owners = tokenOwners.get(deviceToken) || [];\n          if (!owners.includes(u.id)) owners.push(u.id);\n          tokenOwners.set(deviceToken, owners);\n        });\n      });\n\n`;
if (!block.includes(permissionAnchor)) throw new Error('PWA evidence migration: permission anchor not found.');
block = block.replace(permissionAnchor, targetSetup);

const fetchFallback = `        const allUsers = await fetchAllUsersWithFallback(token);\n        const userIdsSet = new Set(userIds);\n        allUsers.forEach(u => {\n          if (!userIdsSet.has(u.id)) return;`;
const fetchFallbackReplacement = `        targetUsers.forEach(u => {`;
if (!block.includes(fetchFallback)) throw new Error('PWA evidence migration: FCM target fetch block not found.');
block = block.replace(fetchFallback, fetchFallbackReplacement);

const responseLoop = `            fcmResponse.responses.forEach((resp) => {\n              if (!resp.success && resp.error) {\n                const errCode = resp.error.code || "";\n                const errMsg = resp.error.message || "";`;
const responseLoopReplacement = `            fcmResponse.responses.forEach((resp, index) => {\n              const attemptedToken = realTokens[index];\n              const owners = tokenOwners.get(attemptedToken) || [];\n              owners.forEach(userId => pwaAttempts.push({\n                userId,\n                transport: 'fcm',\n                success: resp.success,\n                ...(!resp.success && resp.error?.message ? { detail: resp.error.message } : {}),\n              }));\n\n              if (!resp.success && resp.error) {\n                const errCode = resp.error.code || "";\n                const errMsg = resp.error.message || "";`;
if (!block.includes(responseLoop)) throw new Error('PWA evidence migration: FCM response loop not found.');
block = block.replace(responseLoop, responseLoopReplacement);

const catchAnchor = `        } catch (fcmErr: any) {\n          console.warn("[FCM CUSTOM BROADCAST SENDER] sendEachForMulticast threw exception:", fcmErr);`;
const catchReplacement = `        } catch (fcmErr: any) {\n          realTokens.forEach((attemptedToken) => {\n            const owners = tokenOwners.get(attemptedToken) || [];\n            owners.forEach(userId => pwaAttempts.push({\n              userId,\n              transport: 'fcm',\n              success: false,\n              detail: fcmErr?.message || 'FCM transport exception',\n            }));\n          });\n          console.warn("[FCM CUSTOM BROADCAST SENDER] sendEachForMulticast threw exception:", fcmErr);`;
if (!block.includes(catchAnchor)) throw new Error('PWA evidence migration: FCM catch anchor not found.');
block = block.replace(catchAnchor, catchReplacement);

const webTargetFetch = `        const allUsers = await fetchAllUsersWithFallback(token);\n        const userIdsSet = new Set(userIds);\n\n        for (const u of allUsers) {\n          if (!userIdsSet.has(u.id)) continue;`;
const webTargetReplacement = `        for (const u of targetUsers) {`;
if (!block.includes(webTargetFetch)) throw new Error('PWA evidence migration: Web Push target fetch block not found.');
block = block.replace(webTargetFetch, webTargetReplacement);

const webResultAnchor = `              const result = await sendWebPushNotification(sub, title, personalizedMsg, clickAction || "/inbox");\n              if (result.success) {`;
const webResultReplacement = `              const result = await sendWebPushNotification(sub, title, personalizedMsg, clickAction || "/inbox");\n              pwaAttempts.push({\n                userId: u.id,\n                transport: 'webpush',\n                success: result.success,\n                ...(!result.success && 'error' in result && result.error ? { detail: result.error } : {}),\n              });\n              if (result.success) {`;
if (!block.includes(webResultAnchor)) throw new Error('PWA evidence migration: Web Push result anchor not found.');
block = block.replace(webResultAnchor, webResultReplacement);

const responseAnchor = `      res.json({\n        success: true,\n        message: (realTokens.length > 0 || webPushSuccessCount > 0) ? "Push broadcast executed." : "Push broadcast simulated successfully (no real devices subscribed yet).",`;
const responseReplacement = `      const deliveryResultsByUser = buildPwaDeliveryEvidence(targetUserIds, pwaAttempts);\n\n      res.json({\n        success: true,\n        message: (realTokens.length > 0 || webPushSuccessCount > 0) ? "Push broadcast executed." : "Push broadcast simulated successfully (no real devices subscribed yet).",\n        deliveryResultsByUser,`;
if (!block.includes(responseAnchor)) throw new Error('PWA evidence migration: response anchor not found.');
block = block.replace(responseAnchor, responseReplacement);

source = source.slice(0, endpointStart) + block + source.slice(endpointEnd);
fs.writeFileSync(path, source);
console.log('Staged per-member PWA delivery evidence in custom push endpoint.');
