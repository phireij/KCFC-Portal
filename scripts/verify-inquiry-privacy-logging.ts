import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');

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

const requiredMarkers = [
  '[INBOUND CONTACT] Parsed inquiry fields:',
  'messageLength=${message.length}',
  '[INBOUND CONTACT] Attempting Firestore REST fallback write.',
  'res.json({ success: true, emailSent, firestoreWritten });',
  'bodyFields=${inboundBodyFieldCount} queryFields=${inboundQueryFieldCount}',
  'res.status(500).json({ error: "Failed to process contact inquiry" });',
];

for (const marker of requiredMarkers) {
  if (!server.includes(marker)) {
    throw new Error(`Inquiry privacy guard missing marker: ${marker}`);
  }
}

console.log('Inquiry privacy logging boundary: PASS');
