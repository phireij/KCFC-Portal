from pathlib import Path

path = Path('docs/redevelopment/production-readiness-evidence-2026-09-11.md')
source = path.read_text()
old = '- broadcast simulation diagnostic privacy: no-device fallback logs retain operational status only and do not persist authored broadcast title/body previews;\n'
new = old + '- notification/onboarding error and diagnostic privacy: Web Push registration, announcement/custom/self-test push and verification-email failures return stable public errors; self-test/verification diagnostics do not persist caller UID/email or raw verification-link values;\n'
if old not in source:
    raise SystemExit('Broadcast diagnostic privacy evidence line not found')
source = source.replace(old, new, 1)
old_checkpoint = 'Latest validated clean branch checkpoint: `26cdf8e51c25a115b1b395a1d460b51f9ae105cf`, `KCFC Redevelopment CI` run **#1375** / id `34592829693`, conclusion **SUCCESS**. All **57** validation/build/security steps passed.'
new_checkpoint = 'Latest validated clean branch checkpoint: `59c288f5ad9e847c490c5fef087ba2f4c684bed6`, `KCFC Redevelopment CI` run **#1404** / id `34593487571`, conclusion **SUCCESS**. All **57** validation/build/security steps passed.'
if old_checkpoint not in source:
    raise SystemExit('Prior validated checkpoint not found')
source = source.replace(old_checkpoint, new_checkpoint, 1)
path.write_text(source)
