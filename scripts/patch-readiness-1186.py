from pathlib import Path

# Production readiness register
p = Path('docs/redevelopment/production-readiness-evidence-2026-09-11.md')
s = p.read_text()
s = s.replace('- staging Web Push runtime fail-closed enforcement requiring explicit server VAPID public/private keys before any cache/Firestore/generated-key fallback;\n', '- staging Web Push runtime fail-closed enforcement requiring explicit server VAPID public/private keys before any cache/Firestore/generated-key fallback;\n- staging application URL isolation: explicit HTTPS `APP_URL` is required and production Portal hostnames are rejected by both preflight and server startup;\n- staging admin mass-email broadcasts are simulation-only even when SMTP credentials are present;\n')
old = 'Latest validated code checkpoint: `b67f1e8767276830c74a08850199040046441f30`, `KCFC Redevelopment CI` run **#1141** / id `34581079376`, conclusion **SUCCESS**. All **57** validation/build/security steps passed.'
new = 'Latest validated code checkpoint: `879f7188f4ecf3ff1fb16409d0e10fc1350bb0ba`, `KCFC Redevelopment CI` run **#1186** / id `34582465638`, conclusion **SUCCESS**. All **57** validation/build/security steps passed.'
if old not in s: raise SystemExit('production readiness checkpoint marker missing')
s = s.replace(old, new)
s = s.replace('- when `KCFC_RUNTIME_ENV=staging`, the server now refuses to start Web Push with missing explicit server VAPID keys instead of falling through to cached, Firestore, or generated credentials.\n', '- when `KCFC_RUNTIME_ENV=staging`, the server now refuses to start Web Push with missing explicit server VAPID keys instead of falling through to cached, Firestore, or generated credentials;\n- staging preflight and server startup require an explicit HTTPS `APP_URL` whose hostname is not the production KCFC Portal, preventing generated staging links from silently targeting production;\n- the admin broadcast-email route cannot enter real SMTP delivery while `KCFC_RUNTIME_ENV=staging`; it remains simulation-only even if SMTP credentials are inherited.\n')
p.write_text(s)

# Staging checklist
p = Path('docs/redevelopment/staging-readiness-checklist.md')
s = p.read_text()
old = 'Latest exact-head automated evidence before this checklist update: code head `b67f1e8767276830c74a08850199040046441f30`, `KCFC Redevelopment CI` run **#1141** / id `34581079376`, conclusion **SUCCESS**, with all **57** validation/build/security steps green.'
new = 'Latest exact-head automated evidence before this checklist update: code head `879f7188f4ecf3ff1fb16409d0e10fc1350bb0ba`, `KCFC Redevelopment CI` run **#1186** / id `34582465638`, conclusion **SUCCESS**, with all **57** validation/build/security steps green.'
if old not in s: raise SystemExit('staging checklist checkpoint marker missing')
s = s.replace(old, new)
anchor = '- [x] Synthetic staging preflight requires explicit matching client/server VAPID public keys and a server private key rather than relying on inherited/local fallback material.\n'
if anchor not in s: raise SystemExit('checklist automated anchor missing')
s = s.replace(anchor, anchor + '- [x] Staging preflight requires an explicit HTTPS `APP_URL` and rejects the production Portal hostname; server startup enforces the same boundary.\n- [x] Admin mass-email broadcast uses simulation-only behavior in staging even when SMTP credentials are present.\n')
anchor = '- [ ] Real staging environment passes `npm run staging:preflight` with the actual isolated staging configuration.\n'
if anchor not in s: raise SystemExit('checklist empirical anchor missing')
s = s.replace(anchor, anchor + '- [ ] Real staging `APP_URL` is HTTPS, uses the approved non-production hostname, and generated staging links never point to production.\n')
p.write_text(s)

# Staging deployment runbook
p = Path('docs/redevelopment/staging-deployment-runbook-2026-09-11.md')
s = p.read_text()
old = 'Latest validated staging-contract checkpoint: `b67f1e8767276830c74a08850199040046441f30`, with `KCFC Redevelopment CI` run **#1141** / id `34581079376` completing successfully with all **57** validation/build/security steps green.'
new = 'Latest validated staging-contract checkpoint: `879f7188f4ecf3ff1fb16409d0e10fc1350bb0ba`, with `KCFC Redevelopment CI` run **#1186** / id `34582465638` completing successfully with all **57** validation/build/security steps green.'
if old not in s: raise SystemExit('runbook checkpoint marker missing')
s = s.replace(old, new)
old = 'Both are mandatory. The application and `staging:preflight` fail closed if staging is only partially declared.'
new = 'Both are mandatory. The application and `staging:preflight` fail closed if staging is only partially declared. Also set `APP_URL` to the exact non-production HTTPS staging origin; both preflight and server startup reject a missing, non-HTTPS, or production-Portal `APP_URL`.'
if old not in s: raise SystemExit('runbook runtime marker missing')
s = s.replace(old, new)
anchor = 'Provider credentials for LINE, Telegram, WhatsApp or Viber are not needed for baseline staging QA and should remain absent.\n'
if anchor not in s: raise SystemExit('runbook connector marker missing')
s = s.replace(anchor, anchor + '\nFor baseline staging, the admin mass-email broadcast endpoint remains simulation-only even if SMTP credentials are present. This prevents an inherited SMTP configuration from turning a staging broadcast test into live outbound mail. Single-account email verification/inquiry flows remain separate empirical QA cases and must use synthetic/test recipients under the applicable approval boundary.\n')
old = '- staging-only Admin authentication/identity confirmed;\n'
if old not in s: raise SystemExit('runbook completion marker missing')
s = s.replace(old, old + '- approved non-production HTTPS `APP_URL` confirmed and generated links checked against the staging origin;\n')
p.write_text(s)
