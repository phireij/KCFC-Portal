import fs from 'node:fs';

const [auditPath, summaryPath, rawStatus = '0'] = process.argv.slice(2);
const commandStatus = Number(rawStatus) || 0;

let parsed = null;
let parseError = null;
try {
  const raw = fs.readFileSync(auditPath, 'utf8').trim();
  if (raw) parsed = JSON.parse(raw);
} catch (error) {
  parseError = error instanceof Error ? error.message : String(error);
}

const vulnerabilities = parsed?.metadata?.vulnerabilities || {};
const counts = {
  critical: Number(vulnerabilities.critical || 0),
  high: Number(vulnerabilities.high || 0),
  moderate: Number(vulnerabilities.moderate || 0),
  low: Number(vulnerabilities.low || 0),
  total: Number(vulnerabilities.total || 0),
};

const lines = [
  '## Production dependency audit snapshot',
  '',
  'This redevelopment check is intentionally non-blocking while dependency remediation is triaged one package family at a time. It does **not** authorize production release with known vulnerabilities.',
  '',
];

if (parsed?.metadata?.vulnerabilities) {
  lines.push('| Severity | Count |', '| --- | ---: |');
  for (const severity of ['critical', 'high', 'moderate', 'low']) {
    lines.push(`| ${severity} | ${counts[severity]} |`);
  }
  lines.push(`| **total** | **${counts.total}** |`, '');
} else {
  lines.push('No parseable vulnerability totals were returned by the registry for this run.', '');
}

if (commandStatus !== 0) {
  lines.push(`\`npm audit --omit=dev\` exited with status ${commandStatus}. This is expected when vulnerabilities are reported; registry/network errors are also surfaced here without breaking redevelopment CI.`, '');
}
if (parseError) lines.push(`Audit JSON parse note: ${parseError}`, '');

lines.push('Remediation policy: no `npm audit fix --force`; inspect runtime exposure, prefer compatible upgrades, and validate TypeScript/build/regression checks after each dependency family change.', '');

const output = `${lines.join('\n')}\n`;
process.stdout.write(output);
if (summaryPath) fs.appendFileSync(summaryPath, output);
