import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const contactStart = server.indexOf('app.post("/api/public/contact"');
const contactEnd = server.indexOf('// Secure API endpoint for client-side triggered email alerts', contactStart);
if (contactStart === -1 || contactEnd === -1) {
  throw new Error('Public contact route boundary not found for inquiry privacy verification.');
}
const contactRoute = server.slice(contactStart, contactEnd);

const forbiddenMarkers = [
  'Extracted fields => name:',
  'POSTing to REST endpoint: ${firestoreUrl}',
  'errorDetails: errorDetails || undefined',
  'const inboundHeaders = JSON.stringify(req.headers);',
  'const inboundBody = JSON.stringify(req.body);',
  'const inboundQuery = JSON.stringify(req.query);',
  'Headers: ${inboundHeaders} | Body: ${inboundBody} | Query: ${inboundQuery}',
  'res.status(500).json({ error: err.message || "Failed to process contact inquiry" });',
];

for (const marker of forbiddenMarkers) {
  if (server.includes(marker)) {
    throw new Error(`Inquiry privacy regression: forbidden marker present: ${marker}`);
  }
}

const contactErrorForbidden = [
  'let errorDetails =',
  '${dbErr.message}',
  '${errText}',
  '${fsErr.message}',
  '${err.message}',
  'await fsResponse.text()',
];
for (const marker of contactErrorForbidden) {
  if (contactRoute.includes(marker)) {
    throw new Error(`Inquiry persistent diagnostic privacy regression: raw backend detail present: ${marker}`);
  }
}

const requiredMarkers = [
  '[INBOUND CONTACT] Parsed inquiry fields:',
  'messageLength=${message.length}',
  '[INBOUND CONTACT] Attempting Firestore REST fallback write.',
  'res.json({ success: true, emailSent, firestoreWritten });',
  'bodyFields=${inboundBodyFieldCount} queryFields=${inboundQueryFieldCount}',
  'res.status(500).json({ error: "Failed to process contact inquiry" });',
  '[WARN] dbAdmin direct write failed; attempting Firestore REST fallback.',
  '[ERROR] Firestore REST fallback failed with status ${fsResponse.status}.',
  '[ERROR] Firestore REST fallback request failed.',
  '[ERROR] Public contact endpoint execution failed.',
];

for (const marker of requiredMarkers) {
  if (!server.includes(marker)) {
    throw new Error(`Inquiry privacy guard missing marker: ${marker}`);
  }
}

console.log('Inquiry privacy logging boundary: PASS (payload, URL, backend-detail and public-error privacy enforced).');
