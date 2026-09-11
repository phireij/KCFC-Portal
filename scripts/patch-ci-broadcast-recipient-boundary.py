from pathlib import Path

path = Path('.github/workflows/redevelopment-ci.yml')
source = path.read_text()
old = '''          npx tsx scripts/verify-server-diagnostic-privacy.ts\n'''
new = '''          npx tsx scripts/verify-server-diagnostic-privacy.ts\n          npx tsx scripts/verify-broadcast-recipient-token-boundary.ts\n'''
if source.count(old) != 1:
    raise SystemExit('Expected exactly one communication-policy insertion point')
source = source.replace(old, new, 1)
if source.count('verify-broadcast-recipient-token-boundary.ts') != 1:
    raise SystemExit('Broadcast recipient verifier must appear exactly once in CI')
path.write_text(source)
