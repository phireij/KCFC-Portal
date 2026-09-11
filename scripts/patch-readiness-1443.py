from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'missing expected text in {path}: {old[:140]!r}')
    p.write_text(text.replace(old, new, 1))

# Production readiness
p = 'docs/redevelopment/production-readiness-evidence-2026-09-11.md'
replace_once(p,
    '- complete build-artifact identity manifest generation/verification using the release-candidate source SHA plus SHA-256 and byte size for every `dist` file;',
    '- complete build-artifact identity manifest generation/verification using the release-candidate source SHA plus SHA-256 and byte size for every `dist` file;\n- 30-day GitHub Actions retention of the verified non-secret build manifest as repository-side release evidence;')
replace_once(p,
    'Latest validated clean branch checkpoint: `02ffe54fae82f4dd69a76ee5fb88ee5f907f0b6c`, `KCFC Redevelopment CI` run **#1433** / id `34595526457`, conclusion **SUCCESS**. All **57** validation/build/security steps passed, including staging runtime-evidence validation and complete build-artifact manifest/hash coverage.',
    'Latest validated clean branch checkpoint: `49c34b9833b7dc2036a0e1bab948689608108ed4`, `KCFC Redevelopment CI` run **#1443** / id `34595996778`, conclusion **SUCCESS**. All **58** named validation/build/security steps passed, including staging runtime-evidence validation, complete build-artifact manifest/hash coverage, and retention of the verified manifest as a GitHub Actions artifact.')
replace_once(p,
    'Repository-side build identity is now captured by `build-artifact-identity-2026-09-11.md` and the verified `dist/kcfc-build-manifest.json` contract.',
    'Repository-side build identity is now captured by `build-artifact-identity-2026-09-11.md` and the verified `dist/kcfc-build-manifest.json` contract. CI #1443 retained manifest artifact `kcfc-build-manifest-49c34b9833b7dc2036a0e1bab948689608108ed4` through 2026-10-11; this is repository evidence only, not provider deployment evidence.')

# Staging readiness checklist
p = 'docs/redevelopment/staging-readiness-checklist.md'
replace_once(p,
    '- [x] CI generates and verifies a complete build-artifact manifest containing the intended source SHA plus SHA-256/size for every `dist` file.',
    '- [x] CI generates and verifies a complete build-artifact manifest containing the intended source SHA plus SHA-256/size for every `dist` file.\n- [x] CI retains only the non-secret verified build manifest as a 30-day GitHub Actions artifact for repository-side release evidence.')
replace_once(p,
    'Latest exact-head automated evidence before this checklist update: head `02ffe54fae82f4dd69a76ee5fb88ee5f907f0b6c`, `KCFC Redevelopment CI` run **#1433** / id `34595526457`, conclusion **SUCCESS**, with all **57** named validation/build/security steps green. This includes staging preflight plus runtime-evidence validation, notification/privacy contracts, navigation/history guards, governance/build safeguards, and complete build-artifact manifest/hash coverage.',
    'Latest exact-head automated evidence before this checklist update: head `49c34b9833b7dc2036a0e1bab948689608108ed4`, `KCFC Redevelopment CI` run **#1443** / id `34595996778`, conclusion **SUCCESS**, with all **58** named validation/build/security steps green. This includes staging preflight plus runtime-evidence validation, notification/privacy contracts, navigation/history guards, governance/build safeguards, complete build-artifact manifest/hash coverage, and 30-day retention of the non-secret verified manifest.')

# Staging evidence log
p = 'docs/redevelopment/staging-evidence-log.md'
replace_once(p,
    '- validated head: `02ffe54fae82f4dd69a76ee5fb88ee5f907f0b6c`\n- run: **#1433 / id 34595526457**\n- conclusion: **SUCCESS**\n- named validation/build/security steps: **57 passed**',
    '- validated head: `49c34b9833b7dc2036a0e1bab948689608108ed4`\n- run: **#1443 / id 34595996778**\n- conclusion: **SUCCESS**\n- named validation/build/security steps: **58 passed**')
replace_once(p,
    'Result: **PASS — build/reporting controls present.**',
    'Result: **PASS — build/reporting controls present.**\n\n## Evidence E-010 — Retained repository build-manifest artifact\n\nCI #1443 retained the verified non-secret manifest produced for source head `49c34b9833b7dc2036a0e1bab948689608108ed4` as GitHub Actions artifact `kcfc-build-manifest-49c34b9833b7dc2036a0e1bab948689608108ed4`. Artifact id: `10262082863`; archive digest: `sha256:54701b07d5658dbc9045fe4ffa77fbfd6cc8acba986fcc6fe09283b4a306089d`; expiration: `2026-10-11T11:51:53Z`.\n\nThis proves repository-side evidence retention only. It does not prove a provider deployment/revision, provider image digest, or redeployable last-known-good provider artifact.\n\nResult: **PASS — repository manifest evidence retained; provider rollback evidence remains OPEN.**')

# Evidence map
p = 'docs/redevelopment/staging-readiness-evidence-map-2026-09-11.md'
replace_once(p,
    '- Build-artifact manifest generation/verification tied to the intended source SHA, with SHA-256/byte-size verification and complete `dist` file coverage.',
    '- Build-artifact manifest generation/verification tied to the intended source SHA, with SHA-256/byte-size verification and complete `dist` file coverage.\n- 30-day GitHub Actions retention of the verified non-secret build manifest as repository-side release evidence.')
replace_once(p,
    '- head `02ffe54fae82f4dd69a76ee5fb88ee5f907f0b6c`\n- `KCFC Redevelopment CI` run **#1433** / id `34595526457`\n- conclusion: **SUCCESS**\n- all **57** named validation/build/security steps completed successfully, including staging runtime-evidence validation and complete build-artifact manifest/hash coverage.',
    '- head `49c34b9833b7dc2036a0e1bab948689608108ed4`\n- `KCFC Redevelopment CI` run **#1443** / id `34595996778`\n- conclusion: **SUCCESS**\n- all **58** named validation/build/security steps completed successfully, including staging runtime-evidence validation, complete build-artifact manifest/hash coverage and manifest retention.')

# Staging deployment runbook
p = 'docs/redevelopment/staging-deployment-runbook-2026-09-11.md'
replace_once(p,
    'Latest validated staging/readiness checkpoint: `02ffe54fae82f4dd69a76ee5fb88ee5f907f0b6c`, with `KCFC Redevelopment CI` run **#1433** / id `34595526457` completing successfully with all **57** named validation/build/security steps green. This includes the synthetic staging runtime-evidence validator and complete build-artifact manifest/hash verification.',
    'Latest validated staging/readiness checkpoint: `49c34b9833b7dc2036a0e1bab948689608108ed4`, with `KCFC Redevelopment CI` run **#1443** / id `34595996778` completing successfully with all **58** named validation/build/security steps green. This includes the synthetic staging runtime-evidence validator, complete build-artifact manifest/hash verification, and retention of the non-secret verified manifest as a GitHub Actions artifact.')

# Build identity doc
p = 'docs/redevelopment/build-artifact-identity-2026-09-11.md'
replace_once(p,
    'After `npm run build`, CI now generates `dist/kcfc-build-manifest.json` and verifies it before the build is treated as ready evidence.',
    'After `npm run build`, CI now generates `dist/kcfc-build-manifest.json` and verifies it before the build is treated as ready evidence. CI then retains only that non-secret manifest as a GitHub Actions artifact for 30 days; it does not upload environment files, credentials or the full runtime filesystem.')
replace_once(p,
    'The repository manifest proves what the repository built. It does **not** by itself prove what a hosting provider deployed, nor that a previous provider artifact is still redeployable. Provider-specific rollback evidence therefore remains an open release gate.',
    'The repository manifest proves what the repository built. Its GitHub Actions artifact proves the manifest was retained for the configured evidence window. Neither proves what a hosting provider deployed, nor that a previous provider artifact is still redeployable. Provider-specific rollback evidence therefore remains an open release gate.\n\n## Current retained evidence\n\nCI #1443 / run `34595996778` for source `49c34b9833b7dc2036a0e1bab948689608108ed4` retained artifact `kcfc-build-manifest-49c34b9833b7dc2036a0e1bab948689608108ed4` (artifact id `10262082863`) with archive digest `sha256:54701b07d5658dbc9045fe4ffa77fbfd6cc8acba986fcc6fe09283b4a306089d`, expiring `2026-10-11T11:51:53Z`. This is repository-side evidence only.')

print('Readiness 1443 documentation sync prepared.')
