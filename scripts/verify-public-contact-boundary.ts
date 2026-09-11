import fs from 'node:fs';

const source = fs.readFileSync('server.ts', 'utf8');
const start = source.indexOf('app.post("/api/public/contact"');
const end = source.indexOf('// Secure API endpoint for client-side triggered email alerts', start);
if (start === -1 || end === -1) throw new Error('Public contact route boundary not found.');
const route = source.slice(start, end);

const required = [
  'publicContactUpload.none()',
  'fields: 32',
  'fieldSize: 16 * 1024',
  'name.length <= 160',
  'email.length <= 320',
  'subject.length <= 200',
  'message.length <= 5000',
  'const validEmail = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);',
  'const hasHeaderBreaks = /[\\r\\n]/.test(name)',
  'Invalid contact inquiry. Please check the submitted fields and try again.',
  'const safeName = escapeHtml(name);',
  'const safeEmail = escapeHtml(email);',
  'const safeSubject = escapeHtml(subject || "KCFC Portal Inquiry");',
  'const safeMessage = escapeHtml(message).replace(/\\n/g, "<br />");',
];
for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`Public contact boundary missing marker: ${marker}`);
}

for (const forbidden of ['upload.any()', 'extracted: { name, email, subject, message }']) {
  if (route.includes(forbidden)) throw new Error(`Public contact boundary regression: ${forbidden}`);
}

if (route.includes('alertSent: true')) {
  throw new Error('Public contact persistence must not claim an alert was sent unconditionally.');
}
const alertStateCount = route.split('alertSent: emailSent').length - 1;
if (alertStateCount !== 2) {
  throw new Error(`Expected both public-contact persistence paths to use emailSent; found ${alertStateCount}.`);
}

for (const marker of ['>${name}</td>', '>${subject || "KCFC Portal Inquiry"}</td>', '"${message}"']) {
  if (route.includes(marker)) throw new Error(`Unescaped contact content remains in HTML email: ${marker}`);
}

console.log('Public contact input/privacy/alert-state boundary: PASS');
