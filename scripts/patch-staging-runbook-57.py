from pathlib import Path
p = Path('docs/redevelopment/staging-deployment-runbook-2026-09-11.md')
s = p.read_text()
old = 'The latest validated configuration checkpoint before this runbook was created is `b4baee6cb1611cf67eacf2b570a7c3db29196549`, with `KCFC Redevelopment CI` run **#1088** / id `34578756178` completing successfully with all **54** validation/build/security steps green.'
new = 'Latest validated staging-contract checkpoint: `b67f1e8767276830c74a08850199040046441f30`, with `KCFC Redevelopment CI` run **#1141** / id `34581079376` completing successfully with all **57** validation/build/security steps green.'
if old not in s: raise SystemExit('runbook checkpoint marker missing')
s = s.replace(old, new)
old = 'The browser public key and server public key must match. The private key must never use a `VITE_*` name or otherwise enter the browser bundle.'
new = 'The browser public key and server public key must match. The private key must never use a `VITE_*` name or otherwise enter the browser bundle. When `KCFC_RUNTIME_ENV=staging`, the server itself fails closed if either explicit server VAPID key is missing; it must not fall through to cached, Firestore, or generated VAPID material.'
if old not in s: raise SystemExit('runbook VAPID marker missing')
s = s.replace(old, new)
old = 'Expected application-level result: HTTP success with `status: "ok"` and a timestamp.\n\nA successful health check proves only that the application server is running. It does **not** prove Firebase isolation, notification delivery, authorization, or device acceptance; those require the steps below.'
new = 'Expected application-level result: HTTP success containing `status: "ok"`, a timestamp, `runtime: "staging"`, the expected isolated `firebaseProjectId`, and the expected `firestoreDatabaseId` (or `(default)`). The response must not contain API keys, VAPID material, tokens, credentials, auth domains, sender IDs, or app IDs.\n\nA matching health response proves the running server selected the intended runtime/project/database identifiers. It does **not** prove Firebase Admin credential scope, notification delivery, authorization, or device acceptance; those require the steps below.'
if old not in s: raise SystemExit('runbook health marker missing')
s = s.replace(old, new)
s = s.replace('- `/api/health` successful;\n', '- `/api/health` successful and reporting the expected staging runtime/project/database identifiers with no secret fields;\n')
p.write_text(s)
