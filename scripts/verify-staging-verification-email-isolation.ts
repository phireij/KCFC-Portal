import fs from 'node:fs';

const source = fs.readFileSync('server.ts', 'utf8');
const startMarker = 'app.post("/api/auth/send-verification", async (req, res) => {';
const endMarker = '// Secure API endpoint to retrieve diagnostic service logs';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error('Verification-email route boundary missing');
const section = source.slice(start, end);

const required = [
  'const allowVerificationEmailDelivery = runtimeEnvironment !== "staging";',
  'if (allowVerificationEmailDelivery && smtpHost && smtpUser && smtpPass) {',
  'verificationLink: emailSent ? undefined : verificationLink',
];
for (const marker of required) {
  if (!section.includes(marker)) throw new Error(`Staging verification-email isolation marker missing: ${marker}`);
}
if (section.includes('if (smtpHost && smtpUser && smtpPass) {')) {
  throw new Error('Verification-email route still contains an unguarded SMTP delivery condition');
}
console.log('Staging verification-email isolation: PASS');
