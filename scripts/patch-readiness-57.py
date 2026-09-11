from pathlib import Path

p = Path('docs/redevelopment/production-readiness-evidence-2026-09-11.md')
s = p.read_text()
s = s.replace('- client/server Firebase runtime isolation for staging;\n', '- client/server Firebase runtime isolation for staging;\n- non-secret `/api/health` runtime identity (runtime + Firebase project + Firestore database only);\n- staging Web Push runtime fail-closed enforcement requiring explicit server VAPID public/private keys before any cache/Firestore/generated-key fallback;\n')
old = 'Latest validated code checkpoint: `b4baee6cb1611cf67eacf2b570a7c3db29196549`, `KCFC Redevelopment CI` run **#1088** / id `34578756178`, conclusion **SUCCESS**. All **54** validation/build/security steps passed.'
new = 'Latest validated code checkpoint: `b67f1e8767276830c74a08850199040046441f30`, `KCFC Redevelopment CI` run **#1141** / id `34581079376`, conclusion **SUCCESS**. All **57** validation/build/security steps passed.'
if old not in s:
    raise SystemExit('readiness checkpoint marker missing')
s = s.replace(old, new)
s = s.replace('- the preflight itself is exercised in CI with synthetic isolated values and prints environment identifiers/status only, not secrets.\n', '- the preflight itself is exercised in CI with synthetic isolated values and prints environment identifiers/status only, not secrets;\n- `/api/health` exposes only status/time plus runtime, Firebase project ID and Firestore database ID so operators can prove the deployed target without exposing API keys, VAPID material, tokens, credentials or app identifiers;\n- when `KCFC_RUNTIME_ENV=staging`, the server now refuses to start Web Push with missing explicit server VAPID keys instead of falling through to cached, Firestore, or generated credentials.\n')
p.write_text(s)

p = Path('docs/redevelopment/staging-readiness-checklist.md')
s = p.read_text()
old = 'Latest exact-head automated evidence before this checklist update: code head `b4baee6cb1611cf67eacf2b570a7c3db29196549`, `KCFC Redevelopment CI` run **#1088** / id `34578756178`, conclusion **SUCCESS**, with all **54** validation/build/security steps green.'
new = 'Latest exact-head automated evidence before this checklist update: code head `b67f1e8767276830c74a08850199040046441f30`, `KCFC Redevelopment CI` run **#1141** / id `34581079376`, conclusion **SUCCESS**, with all **57** validation/build/security steps green.'
if old not in s:
    raise SystemExit('checklist checkpoint marker missing')
s = s.replace(old, new)
anchor = '- [ ] Real staging environment passes `npm run staging:preflight` with the actual isolated staging configuration.\n'
if anchor not in s:
    raise SystemExit('checklist staging marker missing')
s = s.replace(anchor, anchor + '- [ ] Running `/api/health` shows `runtime=staging` and the expected isolated Firebase project/database IDs; no secret fields are present.\n- [ ] Staging server starts only with explicit `WEB_PUSH_VAPID_PUBLIC_KEY` + `WEB_PUSH_VAPID_PRIVATE_KEY`; missing keys fail closed before fallback initialization.\n')
p.write_text(s)
