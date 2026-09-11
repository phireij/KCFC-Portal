import fs from 'node:fs';

const source = fs.readFileSync('src/lib/gmail.ts', 'utf8');

const stagingGuard = "if (runtimeEnvironment === 'staging') {";
const tokenCall = 'const token = await getGmailAccessToken();';
const gmailSend = "fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send'";
const smtpFallback = "fetch('/api/admin/broadcast-email'";
const simulatedResult = "message: 'Staging email delivery suppressed.'";

for (const marker of [stagingGuard, tokenCall, gmailSend, smtpFallback, simulatedResult]) {
  if (!source.includes(marker)) {
    throw new Error(`Staging client email isolation guard missing marker: ${marker}`);
  }
}

const guardIndex = source.indexOf(stagingGuard);
const tokenIndex = source.indexOf(tokenCall);
const gmailIndex = source.indexOf(gmailSend);
const smtpIndex = source.indexOf(smtpFallback);

if (!(guardIndex < tokenIndex && guardIndex < gmailIndex && guardIndex < smtpIndex)) {
  throw new Error('Staging email guard must execute before OAuth token acquisition and all Gmail/SMTP network delivery paths.');
}

const stagingBlockEnd = source.indexOf('\n  }\n\n  try {', guardIndex);
if (stagingBlockEnd === -1) {
  throw new Error('Could not identify the staging email simulation return boundary.');
}

const stagingBlock = source.slice(guardIndex, stagingBlockEnd);
for (const forbidden of [
  'getGmailAccessToken(',
  'gmail.googleapis.com',
  '/api/admin/broadcast-email',
  'Authorization',
  'to:',
  'subject:',
  'body:',
]) {
  if (stagingBlock.includes(forbidden)) {
    throw new Error(`Staging email simulation must not acquire credentials, perform delivery, or log/message user content: ${forbidden}`);
  }
}

console.log('Staging client email isolation boundary: PASS');
