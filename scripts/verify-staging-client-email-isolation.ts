import fs from 'node:fs';

const source = fs.readFileSync('src/lib/gmail.ts', 'utf8');

const oauthGuard = "if (getRuntimeEnvironment() === 'staging') {\n      reject(new Error('Gmail OAuth is disabled in staging.'));";
const sendGuard = "if (getRuntimeEnvironment() === 'staging') {\n    console.info('KCFC staging email simulation: client-side Gmail and SMTP fallback delivery are suppressed.');";
const tokenCall = 'const token = await getGmailAccessToken();';
const gmailSend = "fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send'";
const smtpFallback = "fetch('/api/admin/broadcast-email'";
const simulatedResult = "message: 'Staging email delivery suppressed.'";

for (const marker of [oauthGuard, sendGuard, tokenCall, gmailSend, smtpFallback, simulatedResult]) {
  if (!source.includes(marker)) {
    throw new Error(`Staging client email isolation guard missing marker: ${marker}`);
  }
}

const sendGuardIndex = source.indexOf(sendGuard);
const tokenIndex = source.indexOf(tokenCall);
const gmailIndex = source.indexOf(gmailSend);
const smtpIndex = source.indexOf(smtpFallback);

if (!(sendGuardIndex < tokenIndex && sendGuardIndex < gmailIndex && sendGuardIndex < smtpIndex)) {
  throw new Error('Staging send guard must execute before OAuth token acquisition and all Gmail/SMTP network delivery paths.');
}

const sendGuardEnd = source.indexOf('\n  }\n\n  try {', sendGuardIndex);
if (sendGuardEnd === -1) {
  throw new Error('Could not identify the staging email simulation return boundary.');
}

const stagingBlock = source.slice(sendGuardIndex, sendGuardEnd);
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
    throw new Error(`Staging email simulation must not acquire credentials, perform delivery, or include user content: ${forbidden}`);
  }
}

const oauthGuardIndex = source.indexOf(oauthGuard);
const cachedTokenIndex = source.indexOf('if (cachedToken && Date.now() < tokenExpiry)');
if (!(oauthGuardIndex < cachedTokenIndex)) {
  throw new Error('Gmail OAuth staging refusal must run before cached-token reuse or token-client initialization.');
}

console.log('Staging client email isolation boundary: PASS (send + OAuth fail closed)');
