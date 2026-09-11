from pathlib import Path

server = Path('server.ts')
s = server.read_text()
start_marker = 'app.post("/api/auth/send-verification", async (req, res) => {'
end_marker = '// Secure API endpoint to retrieve diagnostic service logs'
start = s.index(start_marker)
end = s.index(end_marker, start)
section = s[start:end]
old = '      if (smtpHost && smtpUser && smtpPass) {'
new = '      const allowVerificationEmailDelivery = runtimeEnvironment !== "staging";\n      if (allowVerificationEmailDelivery && smtpHost && smtpUser && smtpPass) {'
if old not in section:
    raise SystemExit('verification SMTP condition marker missing')
section = section.replace(old, new, 1)
s = s[:start] + section + s[end:]
server.write_text(s)

verifier = Path('scripts/verify-staging-verification-email-isolation.ts')
verifier.write_text('''import fs from 'node:fs';\n\nconst source = fs.readFileSync('server.ts', 'utf8');\nconst startMarker = 'app.post("/api/auth/send-verification", async (req, res) => {';\nconst endMarker = '// Secure API endpoint to retrieve diagnostic service logs';\nconst start = source.indexOf(startMarker);\nconst end = source.indexOf(endMarker, start);\nif (start < 0 || end < 0) throw new Error('Verification-email route boundary missing');\nconst section = source.slice(start, end);\n\nconst required = [\n  'const allowVerificationEmailDelivery = runtimeEnvironment !== "staging";',\n  'if (allowVerificationEmailDelivery && smtpHost && smtpUser && smtpPass) {',\n  'verificationLink: emailSent ? undefined : verificationLink',\n];\nfor (const marker of required) {\n  if (!section.includes(marker)) throw new Error(`Staging verification-email isolation marker missing: ${marker}`);\n}\nif (section.includes('if (smtpHost && smtpUser && smtpPass) {')) {\n  throw new Error('Verification-email route still contains an unguarded SMTP delivery condition');\n}\nconsole.log('Staging verification-email isolation: PASS');\n''')
