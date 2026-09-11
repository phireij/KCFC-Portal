from pathlib import Path

path = Path('docs/redevelopment/production-readiness-evidence-2026-09-11.md')
source = path.read_text()
old_privacy = '- persistent/server diagnostic privacy: member-identifying UID/email interpolation is prohibited across governed communication, legacy purge, delivery and subscription-prune diagnostics; operational status/counts remain;\n'
new_privacy = old_privacy + '- broadcast simulation diagnostic privacy: no-device fallback logs retain operational status only and do not persist authored broadcast title/body previews;\n'
if old_privacy not in source:
    raise SystemExit('Diagnostic privacy evidence line not found')
source = source.replace(old_privacy, new_privacy, 1)
old_checkpoint = 'Latest validated clean branch checkpoint: `34502d7270b43f41632a3cb615ecaddc67ee0890`, `KCFC Redevelopment CI` run **#1359** / id `34592481946`, conclusion **SUCCESS**. All **57** validation/build/security steps passed.'
new_checkpoint = 'Latest validated clean branch checkpoint: `26cdf8e51c25a115b1b395a1d460b51f9ae105cf`, `KCFC Redevelopment CI` run **#1375** / id `34592829693`, conclusion **SUCCESS**. All **57** validation/build/security steps passed.'
if old_checkpoint not in source:
    raise SystemExit('Prior checkpoint not found')
source = source.replace(old_checkpoint, new_checkpoint, 1)
path.write_text(source)
