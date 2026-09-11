from pathlib import Path

path = Path('docs/redevelopment/production-readiness-evidence-2026-09-11.md')
source = path.read_text()
source = source.replace(
    '- persistent/server diagnostic privacy: member-identifying UID/email interpolation is prohibited across governed communication, legacy purge, delivery and subscription-prune diagnostics; operational status/counts remain;\n',
    '- persistent/server diagnostic privacy: member-identifying UID/email interpolation is prohibited across governed communication, legacy purge, delivery and subscription-prune diagnostics; operational status/counts remain;\n- broadcast push recipient integrity: announcement and custom-user FCM recipients are derived server-side from eligible user profiles/preferences; client-supplied device-token overrides are prohibited;\n- public database diagnostics privacy: the legacy unauthenticated `/api/public/db-diagnostics` user/configuration enumeration route is removed; `/api/health` remains the non-secret runtime identity surface;\n'
)
old_checkpoint = 'Latest validated clean branch checkpoint: `78d81a5feb5f7a997cb9e2826f536418a7242923`, `KCFC Redevelopment CI` run **#1314** / id `34590624438`, conclusion **SUCCESS**. All **57** validation/build/security steps passed.'
new_checkpoint = 'Latest validated clean branch checkpoint: `34502d7270b43f41632a3cb615ecaddc67ee0890`, `KCFC Redevelopment CI` run **#1359** / id `34592481946`, conclusion **SUCCESS**. All **57** validation/build/security steps passed.'
if old_checkpoint not in source:
    raise SystemExit('Expected prior validated checkpoint not found')
source = source.replace(old_checkpoint, new_checkpoint, 1)
path.write_text(source)
