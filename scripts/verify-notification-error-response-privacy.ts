import fs from 'node:fs';

const source = fs.readFileSync('server.ts', 'utf8');

const forbidden = [
  'res.status(500).json({ error: err.message || "Failed to register web push subscription" });',
  'res.status(500).json({ error: error.message || "Failed to dispatch push notification" });',
  'res.status(500).json({ error: error.message || "Failed to dispatch custom push notification" });',
];

for (const marker of forbidden) {
  if (source.includes(marker)) {
    throw new Error(`Notification error-response privacy regression: raw backend exception fallback remains: ${marker}`);
  }
}

const required = [
  'res.status(500).json({ error: "Failed to register web push subscription" });',
  'res.status(500).json({ error: "Failed to dispatch push notification" });',
  'res.status(500).json({ error: "Failed to dispatch custom push notification" });',
];

for (const marker of required) {
  if (!source.includes(marker)) {
    throw new Error(`Notification error-response privacy guard missing stable public error marker: ${marker}`);
  }
}

console.log('Notification error-response privacy boundary: PASS');
