import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');

const requiredMarkers = [
  'const allowInquiryEmailDelivery = runtimeEnvironment !== "staging";',
  'if (allowInquiryEmailDelivery && smtpHost && smtpUser && smtpPass) {',
  '[INBOUND CONTACT] Staging runtime: SMTP notification suppressed; inquiry remains in isolated staging data.',
  'if (runtimeEnvironment === "staging") {',
  'Staging runtime: inquiry email alert simulated; no SMTP message was sent.',
];

for (const marker of requiredMarkers) {
  if (!server.includes(marker)) {
    throw new Error(`Staging inquiry email isolation missing marker: ${marker}`);
  }
}

const publicContactStart = server.indexOf('// 1. Send the email notification directly using SMTP/Nodemailer');
const publicContactEnd = server.indexOf('// 2. Write the message to Firestore', publicContactStart);
if (publicContactStart < 0 || publicContactEnd < 0) throw new Error('Public contact email block not found.');
const publicContactBlock = server.slice(publicContactStart, publicContactEnd);
if (!publicContactBlock.includes('allowInquiryEmailDelivery')) {
  throw new Error('Public contact SMTP path is not staging-gated.');
}

const adminRouteStart = server.indexOf('app.post("/api/admin/send-message-alert"');
const adminRouteEnd = server.indexOf('// Example of automation endpoint', adminRouteStart);
if (adminRouteStart < 0 || adminRouteEnd < 0) throw new Error('Admin inquiry alert route not found.');
const adminRouteBlock = server.slice(adminRouteStart, adminRouteEnd);
const stagingGuardPos = adminRouteBlock.indexOf('if (runtimeEnvironment === "staging") {');
const transporterPos = adminRouteBlock.indexOf('nodemailer.createTransport');
if (stagingGuardPos < 0 || transporterPos < 0 || stagingGuardPos > transporterPos) {
  throw new Error('Admin inquiry alert must exit in staging before SMTP transporter creation.');
}

console.log('Staging inquiry email isolation: PASS');
