from pathlib import Path

path = Path('docs/redevelopment/production-readiness-evidence-2026-09-11.md')
text = path.read_text()

old = 'Latest validated clean branch checkpoint: `3c4f5379fa89db6691d04dd1daef17eb91c4c725`, `KCFC Redevelopment CI` run **#1303** / id `34590134339`, conclusion **SUCCESS**. All **57** validation/build/security steps passed.'
new = 'Latest validated clean branch checkpoint: `78d81a5feb5f7a997cb9e2826f536418a7242923`, `KCFC Redevelopment CI` run **#1314** / id `34590624438`, conclusion **SUCCESS**. All **57** validation/build/security steps passed.'
if old not in text:
    raise SystemExit('Expected CI #1303 checkpoint not found')
text = text.replace(old, new, 1)

old_privacy = '- persistent server diagnostic privacy: authenticated caller UID/email values and failed-recipient email addresses are not persisted in routine communication diagnostics; operational counts remain;'
new_privacy = '- persistent/server diagnostic privacy: member-identifying UID/email interpolation is prohibited across governed communication, legacy purge, delivery and subscription-prune diagnostics; operational status/counts remain;'
if old_privacy not in text:
    raise SystemExit('Expected server diagnostic privacy bullet not found')
text = text.replace(old_privacy, new_privacy, 1)

path.write_text(text)
