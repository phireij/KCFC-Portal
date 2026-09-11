from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'missing expected text in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1))

# Production readiness register
p = 'docs/redevelopment/production-readiness-evidence-2026-09-11.md'
replace_once(p,
    '- non-secret `/api/health` runtime identity (runtime + Firebase project + Firestore database only);',
    '- non-secret `/api/health` runtime identity (runtime + Firebase project + Firestore database only);\n- synthetic staging runtime-evidence validation that compares a saved health payload to the protected staging runtime/project/database and rejects production hostnames or unexpected response fields;')
replace_once(p,
    '- raw + gzip JavaScript asset-size reporting;',
    '- raw + gzip JavaScript asset-size reporting;\n- complete build-artifact identity manifest generation/verification using the release-candidate source SHA plus SHA-256 and byte size for every `dist` file;')
replace_once(p,
    'Latest validated clean branch checkpoint: `59c288f5ad9e847c490c5fef087ba2f4c684bed6`, `KCFC Redevelopment CI` run **#1404** / id `34593487571`, conclusion **SUCCESS**. All **57** validation/build/security steps passed.',
    'Latest validated clean branch checkpoint: `02ffe54fae82f4dd69a76ee5fb88ee5f907f0b6c`, `KCFC Redevelopment CI` run **#1433** / id `34595526457`, conclusion **SUCCESS**. All **57** validation/build/security steps passed, including staging runtime-evidence validation and complete build-artifact manifest/hash coverage.')
replace_once(p,
    '- `/api/health` exposes only status/time plus runtime, Firebase project ID and Firestore database ID so operators can prove the deployed target without exposing API keys, VAPID material, tokens, credentials or app identifiers;',
    '- `/api/health` exposes only status/time plus runtime, Firebase project ID and Firestore database ID so operators can prove the deployed target without exposing API keys, VAPID material, tokens, credentials or app identifiers;\n- `npm run staging:evidence -- <health-json>` validates a captured health payload against the protected staging environment and rejects unexpected fields, wrong runtime/project/database, or a production Portal hostname;')
replace_once(p,
    'The canonical staging runtime boundary is documented in `staging-firebase-isolation-contract-2026-09-11.md`. The provider-neutral execution procedure is `staging-deployment-runbook-2026-09-11.md`; it prepares isolated staging evidence but does not authorize external resource creation or deployment.',
    'The canonical staging runtime boundary is documented in `staging-firebase-isolation-contract-2026-09-11.md`. The provider-neutral execution procedure is `staging-deployment-runbook-2026-09-11.md`, with the exact health/preflight capture flow in `staging-runtime-evidence-capture-2026-09-11.md`; these prepare isolated staging evidence but do not authorize external resource creation or deployment.')
replace_once(p,
    'Provider/environment backup evidence and exact production deployment-artifact rollback evidence are still required before any production request. `deployment-artifact-rollback-evidence-template-2026-09-11.md` provides the blank evidence form without claiming that those production artifacts/backups already exist.',
    'Repository-side build identity is now captured by `build-artifact-identity-2026-09-11.md` and the verified `dist/kcfc-build-manifest.json` contract. Provider/environment backup evidence and exact production deployment-artifact rollback/redeployability evidence are still required before any production request. `deployment-artifact-rollback-evidence-template-2026-09-11.md` provides the blank evidence form without claiming that those provider artifacts/backups already exist.')

# Staging deployment runbook
p = 'docs/redevelopment/staging-deployment-runbook-2026-09-11.md'
replace_once(p,
    'Latest validated staging-contract checkpoint: `716e920ba685dfab8f9148513847c4f5fc59d517`, with `KCFC Redevelopment CI` run **#1247** / id `34586303040` completing successfully with all **57** validation/build/security steps green.',
    'Latest validated staging/readiness checkpoint: `02ffe54fae82f4dd69a76ee5fb88ee5f907f0b6c`, with `KCFC Redevelopment CI` run **#1433** / id `34595526457` completing successfully with all **57** named validation/build/security steps green. This includes the synthetic staging runtime-evidence validator and complete build-artifact manifest/hash verification.')
replace_once(p,
    'Expected application-level result: HTTP success containing `status: "ok"`, a timestamp, `runtime: "staging"`, the expected isolated `firebaseProjectId`, and the expected `firestoreDatabaseId` (or `(default)`). The response must not contain API keys, VAPID material, tokens, credentials, auth domains, sender IDs, or app IDs.',
    'Expected application-level result: HTTP success containing `status: "ok"`, a timestamp, `runtime: "staging"`, the expected isolated `firebaseProjectId`, and the expected `firestoreDatabaseId` (or `(default)`). The response must not contain API keys, VAPID material, tokens, credentials, auth domains, sender IDs, or app IDs. Follow `staging-runtime-evidence-capture-2026-09-11.md` and run `npm run staging:evidence -- <saved-health-json>` so the captured payload is compared mechanically with the protected staging environment instead of being accepted by visual inspection alone.')
replace_once(p,
    '- `/api/health` result;',
    '- `/api/health` result plus `npm run staging:evidence` PASS output;')
replace_once(p,
    '- `/api/health` successful and reporting the expected staging runtime/project/database identifiers with no secret fields;',
    '- `/api/health` successful and `npm run staging:evidence` PASS confirming the expected staging runtime/project/database identifiers with no unexpected fields;')

# Staging readiness checklist
p = 'docs/redevelopment/staging-readiness-checklist.md'
replace_once(p,
    'Deployment-runbook companion: `staging-deployment-runbook-2026-09-11.md`.',
    'Deployment-runbook companion: `staging-deployment-runbook-2026-09-11.md`.\nRuntime-evidence companion: `staging-runtime-evidence-capture-2026-09-11.md`.')
replace_once(p,
    '- [x] `npm run staging:preflight` is regression-tested in CI with a synthetic isolated staging environment.',
    '- [x] `npm run staging:preflight` is regression-tested in CI with a synthetic isolated staging environment.\n- [x] `npm run staging:evidence -- <health-json>` is regression-tested to reject production hostnames, runtime/project/database mismatches, and unexpected health-response fields.\n- [x] CI generates and verifies a complete build-artifact manifest containing the intended source SHA plus SHA-256/size for every `dist` file.')
replace_once(p,
    '- [ ] Running `/api/health` shows `runtime=staging` and the expected isolated Firebase project/database IDs; no secret fields are present.',
    '- [ ] Running `/api/health` shows `runtime=staging` and the expected isolated Firebase project/database IDs; no secret fields are present.\n- [ ] Saved real-staging `/api/health` JSON passes `npm run staging:evidence -- <health-json>` against the protected staging environment.')
start = 'Latest exact-head automated evidence before this checklist update: code head `879f7188f4ecf3ff1fb16409d0e10fc1350bb0ba`, `KCFC Redevelopment CI` run **#1186** / id `34582465638`, conclusion **SUCCESS**, with all **57** validation/build/security steps green. This includes staging environment-template parity, Login email-verification migration safety, Leadership workspace URL/history navigation, staging-only environment identification, Schedule URL/history navigation, full-URL same-origin notification tap handling, Updates focus/scope history, Inbox deep-link/history/filter navigation, Resource/Community history navigation, availability member/leader deep-link focus, Home explicit-roster publication privacy, staging isolation/preflight, and the existing governance/build guards.'
new = 'Latest exact-head automated evidence before this checklist update: head `02ffe54fae82f4dd69a76ee5fb88ee5f907f0b6c`, `KCFC Redevelopment CI` run **#1433** / id `34595526457`, conclusion **SUCCESS**, with all **57** named validation/build/security steps green. This includes staging preflight plus runtime-evidence validation, notification/privacy contracts, navigation/history guards, governance/build safeguards, and complete build-artifact manifest/hash coverage. Automated evidence does not mark the unchecked real staging/browser/device items below as passed.'
replace_once(p, start, new)
replace_once(p,
    '- [ ] Deployable prior application artifact/version or otherwise proven application rollback path.',
    '- [ ] Repository build manifest/source SHA is retained for the release candidate.\n- [ ] Deployable prior provider application artifact/version or otherwise proven provider rollback path.')

# Staging evidence log
p = 'docs/redevelopment/staging-evidence-log.md'
old = '''Latest exact-head run before this documentation refresh:\n\n- validated head: `967894f0eecbd53c80cffbc9b5e3461390217c98`\n- run: **#845 / id 34567540510**\n- conclusion: **SUCCESS**\n- validation/build/security steps: **39 passed**'''
new = '''Latest exact-head run before this documentation refresh:\n\n- validated head: `02ffe54fae82f4dd69a76ee5fb88ee5f907f0b6c`\n- run: **#1433 / id 34595526457**\n- conclusion: **SUCCESS**\n- named validation/build/security steps: **57 passed**'''
replace_once(p, old, new)
replace_once(p,
    'The current workflow validates dependency installation/audit visibility, TypeScript, communication and liturgical contracts, leadership/member governance, pre-registration safety and email-verification migration, Core-status safeguards, Firebase Admin Storage non-use, client/server staging Firebase isolation, same-origin Web Push worker boundaries, push privacy logging, PWA theme/install metadata, modern iPhone/iPadOS platform detection, synthetic staging preflight, accessibility/mobile navigation, delivery/notification diagnostics, privacy-safe device QA snapshots, caller-bound self-test push isolation, production build/bundle reporting, connector defaults OFF and provider-secret browser guards.',
    'The current workflow validates dependency installation/audit visibility, TypeScript, communication and liturgical contracts, leadership/member governance, pre-registration and email-verification safety, Core-status safeguards, Firebase Admin Storage non-use, client/server staging Firebase isolation, synthetic staging preflight plus runtime-health evidence validation, notification/privacy/service-worker/PWA contracts, accessibility/mobile navigation, delivery/device QA guards, production build/bundle reporting, complete build-artifact manifest/hash coverage, connector defaults OFF and provider-secret browser guards.')
replace_once(p,
    'Result: **PASS in CI #845.**',
    'Result: **PASS in CI #1433.**')
replace_once(p,
    '- CI records raw + gzip JavaScript asset sizes and total JS weight.',
    '- CI records raw + gzip JavaScript asset sizes and total JS weight.\n- CI generates and verifies a complete `dist` artifact manifest tied to the intended source SHA with SHA-256/size for every build file.')
replace_once(p,
    'Specification v4 remains the working redevelopment baseline for Communications + Schedule + Staging Safeguards. The staging device QA package, staging readiness evidence map, production readiness register, dependency disposition and backup/rollback plan are maintained alongside implementation.',
    'Specification v4 remains the working redevelopment baseline for Communications + Schedule + Staging Safeguards. The staging device QA package, staging readiness evidence map, production readiness register, dependency disposition and backup/rollback plan are maintained alongside implementation. The repository now also includes `staging-runtime-evidence-capture-2026-09-11.md` and `build-artifact-identity-2026-09-11.md` for reproducible staging-target and build-identity evidence.')

print('Readiness documentation sync prepared.')
