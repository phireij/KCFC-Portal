import fs from 'node:fs';

const source = fs.readFileSync('server.ts', 'utf8');

const forbidden = [
  'Caller UID verified: "${callerUid}" | Email: "${callerEmail}"',
  'Failed recipients: ${failedRecipients.join(", ")}',
  'logMessage(`[PROCESS] Caller UID verified:',
];

for (const marker of forbidden) {
  if (source.includes(marker)) {
    throw new Error(`Server diagnostic privacy regression: forbidden marker present: ${marker}`);
  }
}

const required = [
  'logMessage(`[PROCESS] Caller Firebase ID token verified.`);',
  'emailLogMessage = `[SMTP SUCCESS] Finished personalized email dispatch. Sent: ${successCount}, Failed: ${failCount}.`;',
];

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(`Server diagnostic privacy guard missing marker: ${marker}`);
  }
}

const callerSafeCount = source.split('logMessage(`[PROCESS] Caller Firebase ID token verified.`);').length - 1;
if (callerSafeCount !== 4) {
  throw new Error(`Expected 4 privacy-safe caller verification log statements, found ${callerSafeCount}`);
}

const smtpSafeCount = source.split('emailLogMessage = `[SMTP SUCCESS] Finished personalized email dispatch. Sent: ${successCount}, Failed: ${failCount}.`;').length - 1;
if (smtpSafeCount !== 2) {
  throw new Error(`Expected 2 privacy-safe SMTP result log statements, found ${smtpSafeCount}`);
}

console.log('Server diagnostic privacy logging boundary: PASS');
