from pathlib import Path
p = Path('server.ts')
s = p.read_text()
start = s.find('app.post("/api/admin/broadcast-email"')
if start < 0:
    raise SystemExit('broadcast email route not found')
end = s.find('\n  app.', start + 20)
if end < 0:
    end = len(s)
segment = s[start:end]
needle = '      if (smtpHost && smtpUser && smtpPass) {'
if segment.count(needle) != 1:
    raise SystemExit(f'expected one real SMTP condition in broadcast route, found {segment.count(needle)}')
replacement = '      const allowRealBroadcastEmail = runtimeEnvironment !== "staging";\n      if (allowRealBroadcastEmail && smtpHost && smtpUser && smtpPass) {'
segment = segment.replace(needle, replacement)
p.write_text(s[:start] + segment + s[end:])
