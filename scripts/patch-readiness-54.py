from pathlib import Path
import re

# Production readiness register
path = Path('docs/redevelopment/production-readiness-evidence-2026-09-11.md')
text = path.read_text()
text = text.replace(
    '- client/server Firebase runtime isolation for staging;\n',
    '- client/server Firebase runtime isolation for staging;\n- staging environment template parity, including explicit server-side VAPID public/private variables and browser/server public-key matching;\n'
)
text, count = re.subn(
    r'Latest validated code checkpoint: `[^`]+`, `KCFC Redevelopment CI` run \*\*#\d+\*\* / id `\d+`, conclusion \*\*SUCCESS\*\*\. All \*\*\d+\*\* validation/build/security steps passed\.',
    'Latest validated code checkpoint: `b4baee6cb1611cf67eacf2b570a7c3db29196549`, `KCFC Redevelopment CI` run **#1088** / id `34578756178`, conclusion **SUCCESS**. All **54** validation/build/security steps passed.',
    text,
    count=1,
)
if count != 1:
    raise SystemExit('production readiness checkpoint pattern not found exactly once')
text = text.replace(
    'The canonical staging runtime boundary is documented in `staging-firebase-isolation-contract-2026-09-11.md`.',
    'The canonical staging runtime boundary is documented in `staging-firebase-isolation-contract-2026-09-11.md`. The provider-neutral execution procedure is `staging-deployment-runbook-2026-09-11.md`; it prepares isolated staging evidence but does not authorize external resource creation or deployment.'
)
text = text.replace(
    'Provider/environment backup evidence and exact production deployment-artifact rollback evidence are still required before any production request.',
    'Provider/environment backup evidence and exact production deployment-artifact rollback evidence are still required before any production request. `deployment-artifact-rollback-evidence-template-2026-09-11.md` provides the blank evidence form without claiming that those production artifacts/backups already exist.'
)
path.write_text(text)

# Staging readiness checklist
path = Path('docs/redevelopment/staging-readiness-checklist.md')
text = path.read_text()
if 'Deployment-runbook companion:' not in text:
    text = text.replace(
        'Runtime-isolation companion: `staging-firebase-isolation-contract-2026-09-11.md`.\n',
        'Runtime-isolation companion: `staging-firebase-isolation-contract-2026-09-11.md`.\nDeployment-runbook companion: `staging-deployment-runbook-2026-09-11.md`.\n'
    )
anchor = '- [x] Synthetic staging preflight requires explicit matching client/server VAPID public keys and a server private key rather than relying on inherited/local fallback material.\n'
if anchor in text and 'Staging environment template documents the same browser/server VAPID contract' not in text:
    text = text.replace(
        anchor,
        anchor + '- [x] Staging environment template documents the same browser/server VAPID contract, with the private key server-only and CI-guarded.\n'
    )
text, count = re.subn(
    r'Latest exact-head automated evidence before this checklist update: code head `[^`]+`, `KCFC Redevelopment CI` run \*\*#\d+\*\* / id `\d+`, conclusion \*\*SUCCESS\*\*, with all \*\*\d+\*\* validation/build/security steps green\.[^\n]*',
    'Latest exact-head automated evidence before this checklist update: code head `b4baee6cb1611cf67eacf2b570a7c3db29196549`, `KCFC Redevelopment CI` run **#1088** / id `34578756178`, conclusion **SUCCESS**, with all **54** validation/build/security steps green. This includes staging environment-template parity, Login email-verification migration safety, Leadership workspace URL/history navigation, staging-only environment identification, Schedule URL/history navigation, full-URL same-origin notification tap handling, Updates focus/scope history, Inbox deep-link/history/filter navigation, Resource/Community history navigation, availability member/leader deep-link focus, Home explicit-roster publication privacy, staging isolation/preflight, and the existing governance/build guards.',
    text,
    count=1,
)
if count != 1:
    raise SystemExit('staging checklist checkpoint pattern not found exactly once')
path.write_text(text)

# Backup/rollback plan: link the concrete evidence template.
path = Path('docs/redevelopment/backup-rollback-plan-2026-09-11.md')
text = path.read_text()
if 'deployment-artifact-rollback-evidence-template-2026-09-11.md' not in text:
    text = text.replace(
        'It does **not** authorize deployment, production writes, destructive restoration, Firebase Auth recreation, public cutover, or any other approval-gated action.\n',
        'It does **not** authorize deployment, production writes, destructive restoration, Firebase Auth recreation, public cutover, or any other approval-gated action.\n\nCompanion evidence form: `deployment-artifact-rollback-evidence-template-2026-09-11.md`. The form is intentionally blank until real provider/artifact/backup evidence is captured.\n'
    )
path.write_text(text)
