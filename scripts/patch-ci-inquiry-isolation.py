from pathlib import Path

p = Path('.github/workflows/redevelopment-ci.yml')
s = p.read_text()
old = '''      - name: Verify communication policy\n        run: npx tsx scripts/verify-communication-policy.ts\n'''
new = '''      - name: Verify communication policy\n        run: |\n          npx tsx scripts/verify-communication-policy.ts\n          npx tsx scripts/verify-staging-inquiry-email-isolation.ts\n'''
if old not in s:
    raise SystemExit('communication policy CI marker missing')
s = s.replace(old, new, 1)
p.write_text(s)
