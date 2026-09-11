from pathlib import Path

path = Path('server.ts')
source = path.read_text()
old = 'console.error(`[WEBPUSH SEND ERROR] Failed to deliver to endpoint ${subscription?.endpoint}:`, err.message);'
new = 'console.error(`[WEBPUSH SEND ERROR] Failed to deliver Web Push notification:`, err.message);'
if old not in source:
    raise SystemExit('server Web Push endpoint logging marker not found')
source = source.replace(old, new)
path.write_text(source)
