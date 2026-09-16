import fs from 'node:fs';

const source = fs.readFileSync('server.ts', 'utf8');

const forbidden = [
  'Caller UID verified: "${callerUid}" | Email: "${callerEmail}"',
  'Failed recipients: ${failedRecipients.join(", ")}',
  'logMessage(`[PROCESS] Caller UID verified:',
  'Body preview: "${body.substring(0, 100)}..."',
  'Title: "${title}"',
  'res.status(500).json({ error: err.message || "Failed to register web push subscription" });',
  'res.status(500).json({ error: error.message || "Failed to dispatch push notification" });',
  'res.status(500).json({ error: error.message || "Failed to dispatch custom push notification" });',
  'res.status(500).json({ error: error.message || "Failed to dispatch test push notification" });',
  'res.status(500).json({ error: error.message || "Failed to process verification email dispatch" });',
  'logMessage(`[WEBPUSH TEST PRUNE] Pruned expired subscriptions for user ${callerUid}`);',
  'logMessage(`[SMTP SUCCESS] Sent custom server-side verification link to ${email}`);',
  'logMsgText = `[SMTP INITIATED] Custom server-side verification link dispatch started for ${email}`;',
  'Raw verification link: ${verificationLink}',
];

for (const marker of forbidden) {
  if (source.includes(marker)) {
    throw new Error(`Server diagnostic privacy regression: forbidden marker present: ${marker}`);
  }
}

const identifierMarkers = [
  '${userId}',
  '${targetUserId}',
  '${currentUid}',
  '${callerUid}',
  '${emailTrimmed}',
  '${targetUser.uid}',
  '${targetUser.email}',
  '${callerEmail}',
  '${rec.email}',
  '${u.id}',
  '${JSON.stringify(allUidsToDelete)}',
];

for (const line of source.split(/\r?\n/)) {
  if (!line.includes('logMessage(') && !line.includes('console.')) continue;
  for (const marker of identifierMarkers) {
    if (line.includes(marker)) {
      throw new Error(`Server diagnostic privacy regression: member identifier interpolation present in diagnostic statement: ${marker}`);
    }
  }
}

const required = [
  'logMessage(`[PROCESS] Caller Firebase ID token verified.`);',
  'emailLogMessage = `[SMTP SUCCESS] Finished personalized email dispatch. Sent: ${successCount}, Failed: ${failCount}.`;',
  '[FCM SIMULATION] No registered real browser push tokens found. Announcement broadcast simulation completed without message-content logging.',
  '[FCM SIMULATION] No registered real browser push tokens found for targeted users. Custom broadcast simulation completed without message-content logging.',
  'res.status(500).json({ error: "Failed to register web push subscription" });',
  'res.status(500).json({ error: "Failed to dispatch push notification" });',
  'res.status(500).json({ error: "Failed to dispatch custom push notification" });',
  'res.status(500).json({ error: "Failed to dispatch test push notification" });',
  'res.status(500).json({ error: "Failed to process verification email dispatch" });',
  'logMessage(`[WEBPUSH TEST PRUNE] Pruned expired subscriptions for authenticated caller.`);',
  'logMessage(`[SMTP SUCCESS] Custom server-side verification link dispatched.`);',
  'logMsgText = `[SMTP INITIATED] Custom server-side verification link dispatch started.`;',
  'Verification link generated for authenticated caller without logging the link.',
];

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(`Server diagnostic privacy guard missing marker: ${marker}`);
  }
}

const callerSafeCount = source.split('logMessage(`[PROCESS] Caller Firebase ID token verified.`);').length - 1;
if (callerSafeCount < 1) {
  throw new Error('Expected at least one privacy-safe caller verification log statement.');
}

const smtpSafeCount = source.split('emailLogMessage = `[SMTP SUCCESS] Finished personalized email dispatch. Sent: ${successCount}, Failed: ${failCount}.`;').length - 1;
if (smtpSafeCount < 1) {
  throw new Error('Expected at least one privacy-safe SMTP result log statement.');
}

console.log(`Server diagnostic privacy logging boundary: PASS (${callerSafeCount} caller log(s), ${smtpSafeCount} SMTP result log(s)); member identifiers, broadcast message previews, notification backend exception details, and verification-link values are absent from public/persistent diagnostic surfaces.`);
