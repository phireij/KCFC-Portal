import fs from 'node:fs';

const source = fs.readFileSync('server.ts', 'utf8');
const start = source.indexOf('app.post("/api/admin/broadcast-email"');
if (start < 0) throw new Error('Email broadcast route not found');
const nextRoute = source.indexOf('\n  app.', start + 20);
const segment = source.slice(start, nextRoute > start ? nextRoute : source.length);

const required = [
  'const allowRealBroadcastEmail = runtimeEnvironment !== "staging";',
  'if (allowRealBroadcastEmail && smtpHost && smtpUser && smtpPass) {',
  'usingRealSMTP = true;',
  'Broadcast simulated successfully (SMTP not configured). Logs have been written.',
];
for (const marker of required) {
  if (!segment.includes(marker)) throw new Error(`Staging email broadcast isolation marker missing: ${marker}`);
}

if (segment.includes('if (smtpHost && smtpUser && smtpPass) {')) {
  throw new Error('Email broadcast route can still enter real SMTP without the staging isolation gate');
}

console.log('Staging email broadcast isolation: PASS');
