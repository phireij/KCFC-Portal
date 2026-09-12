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

const describeFix = (item) => {
  if (item.fixAvailable === true) return 'yes';
  if (item.fixAvailable && typeof item.fixAvailable === 'object') {
    const target = item.fixAvailable.name && item.fixAvailable.version
      ? `${item.fixAvailable.name}@${item.fixAvailable.version}`
      : 'version change';
    return item.fixAvailable.isSemVerMajor ? `${target} (major)` : target;
  }
  return 'no';
};

if (parsed?.metadata?.vulnerabilities) {
  lines.push('| Severity | Count |', '| --- | ---: |');
  for (const severity of ['critical', 'high', 'moderate', 'low']) {
    lines.push(`| ${severity} | ${counts[severity]} |`);
  }
  lines.push(`| **total** | **${counts.total}** |`, '');

  const findings = Object.values(parsed.vulnerabilities || {})
    .filter(Boolean)
    .sort((a, b) => {
      const rank = { critical: 0, high: 1, moderate: 2, low: 3, info: 4 };
      return (rank[a.severity] ?? 5) - (rank[b.severity] ?? 5) || String(a.name).localeCompare(String(b.name));
    });

  if (findings.length > 0) {
    lines.push('### Remaining runtime package findings', '', '| Package | Severity | Direct | Affected range | Fix available |', '| --- | --- | --- | --- | --- |');
    for (const item of findings) {
      lines.push(`| ${item.name || 'unknown'} | ${item.severity || 'unknown'} | ${item.isDirect ? 'yes' : 'no'} | ${String(item.range || '').replaceAll('|', '\\|')} | ${describeFix(item)} |`);
    }
    lines.push('');
  }

  if (counts.critical > 0 || counts.high > 0) {
    process.stdout.write(`::warning title=Production dependency audit::${counts.critical} critical and ${counts.high} high runtime dependency vulnerabilities remain to be triaged before production readiness.\n`);
  }
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
