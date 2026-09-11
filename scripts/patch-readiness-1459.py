from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'missing expected text in {path}: {old[:180]!r}')
    p.write_text(text.replace(old, new, 1))

# Residual dependency disposition
p = 'docs/redevelopment/residual-dependency-disposition-2026-09-11.md'
replace_once(p,
    'The production/runtime audit is now reduced to **3 findings: 0 critical, 0 high, 2 moderate, 1 low**.',
    'The production/runtime audit is now reduced to **2 findings: 0 critical, 0 high, 2 moderate, 0 low**.')
replace_once(p,
    'Latest exact-clean-head evidence before this disposition refresh: `KCFC Redevelopment CI` run **#1451** / id `34596219092` on head `ff110178d85247d143359e35acb81bf526d1e34c`. `npm audit --omit=dev` reported:\n\n- `gaxios` — moderate — affected installed range `6.4.0 - 6.7.1`;\n- `uuid` — moderate — affected installed range `<11.1.1`;\n- `esbuild` — low — affected installed range `0.27.3 - 0.28.0`.',
    'Latest exact-clean-head evidence before this disposition refresh: `KCFC Redevelopment CI` run **#1459** / id `34596788624` on head `8ea202c552d88712ffe34b53e7697caa40b6d6b2`. `npm audit --omit=dev` reported exactly two remaining runtime findings:\n\n- `gaxios` — moderate — affected installed range `6.4.0 - 6.7.1`;\n- `uuid` — moderate — affected installed range `<11.1.1`.\n\nThe previous `esbuild` low finding is no longer present in the production/runtime audit snapshot.')
replace_once(p,
    '| `esbuild` | low | Reported through the `tsx` development/tooling chain. Production starts with `node dist/server.cjs`. | **LOW PRODUCTION EXPOSURE / TOOLING PATH.** Keep visible and update through supported tooling versions when compatible. |',
    '| `esbuild` | low | The affected nested copy came from `tsx@4.21.0` resolving `esbuild@0.27.7`. A direct top-level `esbuild@0.28.2` probe did not remove that nested copy, so it was rejected. Updating the supported parent to `tsx@4.23.13` together with top-level `esbuild@0.28.2` removed the audit finding. | **CLOSED through supported tooling-parent remediation.** TypeScript, production build and all ordinary redevelopment CI checks passed afterward. |')
insert_after = 'This upstream check is a point-in-time disposition. It should be revisited when either Firebase Admin or Google Cloud Storage publishes a compatible parent release that changes the affected dependency chain.\n'
addition = '''\n## Closed finding: `esbuild`\n\nThe prior development/tooling tree contained `tsx@4.21.0 -> esbuild@0.27.7`, which was within the low-severity affected range. A direct top-level update to `esbuild@0.28.2` was intentionally tested first and **rejected** because `tsx` still retained its own affected nested copy.\n\nA supported parent update then moved the toolchain to:\n\n- `tsx` **4.23.13**; and\n- top-level `esbuild` **0.28.2**.\n\nThe remediation probe confirmed the `esbuild` audit finding was absent, then passed TypeScript and the production build before committing only `package.json` / `package-lock.json`. The temporary remediation workflow was removed. Ordinary `KCFC Redevelopment CI` run **#1459** on clean head `8ea202c552d88712ffe34b53e7697caa40b6d6b2` then passed all **58** named checks and recorded **0 low** runtime findings. No override, force-fix or fork was used.\n\n'''
replace_once(p, insert_after, insert_after + addition)
replace_once(p,
    '- `esbuild` low: **documented as development/tooling exposure**.',
    '- `esbuild` low: **CLOSED through supported `tsx@4.23.13` + `esbuild@0.28.2` remediation, validated by CI #1459**.')

# Production readiness evidence
p = 'docs/redevelopment/production-readiness-evidence-2026-09-11.md'
replace_once(p,
    'Latest validated clean branch checkpoint: `49c34b9833b7dc2036a0e1bab948689608108ed4`, `KCFC Redevelopment CI` run **#1443** / id `34595996778`, conclusion **SUCCESS**. All **58** named validation/build/security steps passed, including staging runtime-evidence validation, complete build-artifact manifest/hash coverage, and retention of the verified manifest as a GitHub Actions artifact.',
    'Latest validated clean branch checkpoint: `8ea202c552d88712ffe34b53e7697caa40b6d6b2`, `KCFC Redevelopment CI` run **#1459** / id `34596788624`, conclusion **SUCCESS**. All **58** named validation/build/security steps passed. The runtime audit is now **0 critical, 0 high, 2 moderate, 0 low**; staging runtime-evidence validation, complete build-artifact manifest/hash coverage and manifest retention all remained green.')
replace_once(p,
    'Current runtime audit: **0 critical, 0 high, 2 moderate, 1 low**.',
    'Current runtime audit: **0 critical, 0 high, 2 moderate, 0 low**.')
replace_once(p,
    '- `esbuild` low remains documented as development/tooling exposure because production starts with `node dist/server.cjs`.',
    '- The former `esbuild` low is **closed** through the supported tooling-parent update to `tsx` 4.23.13 plus top-level `esbuild` 0.28.2; CI #1459 confirms it is absent from `npm audit --omit=dev`.')
replace_once(p,
    'CI #1443 retained manifest artifact `kcfc-build-manifest-49c34b9833b7dc2036a0e1bab948689608108ed4` through 2026-10-11; this is repository evidence only, not provider deployment evidence.',
    'CI #1459 retained manifest artifact `kcfc-build-manifest-8ea202c552d88712ffe34b53e7697caa40b6d6b2` (artifact id `10261723910`, archive digest `sha256:b523ba2c7062b58e4d2451726a9e435140ded21934548c160b5f9f984c7d5ccb`) through `2026-10-11T12:01:45Z`; this is repository evidence only, not provider deployment evidence.')

# Checklist
p = 'docs/redevelopment/staging-readiness-checklist.md'
text = Path(p).read_text()
text = text.replace('0 critical, 0 high, 2 moderate, 1 low', '0 critical, 0 high, 2 moderate, 0 low')
text = text.replace('head `49c34b9833b7dc2036a0e1bab948689608108ed4`, `KCFC Redevelopment CI` run **#1443** / id `34595996778`', 'head `8ea202c552d88712ffe34b53e7697caa40b6d6b2`, `KCFC Redevelopment CI` run **#1459** / id `34596788624`')
Path(p).write_text(text)

# Evidence log
p = 'docs/redevelopment/staging-evidence-log.md'
text = Path(p).read_text()
text = text.replace('49c34b9833b7dc2036a0e1bab948689608108ed4', '8ea202c552d88712ffe34b53e7697caa40b6d6b2')
text = text.replace('#1443 / id 34595996778', '#1459 / id 34596788624')
text = text.replace('2 moderate, 1 low', '2 moderate, 0 low')
text = text.replace('kcfc-build-manifest-49c34b9833b7dc2036a0e1bab948689608108ed4', 'kcfc-build-manifest-8ea202c552d88712ffe34b53e7697caa40b6d6b2')
text = text.replace('10262082863', '10261723910')
text = text.replace('sha256:54701b07d5658dbc9045fe4ffa77fbfd6cc8acba986fcc6fe09283b4a306089d', 'sha256:b523ba2c7062b58e4d2451726a9e435140ded21934548c160b5f9f984c7d5ccb')
text = text.replace('2026-10-11T11:51:53Z', '2026-10-11T12:01:45Z')
Path(p).write_text(text)

# Evidence map
p = 'docs/redevelopment/staging-readiness-evidence-map-2026-09-11.md'
text = Path(p).read_text()
text = text.replace('head `49c34b9833b7dc2036a0e1bab948689608108ed4`', 'head `8ea202c552d88712ffe34b53e7697caa40b6d6b2`')
text = text.replace('run **#1443** / id `34595996778`', 'run **#1459** / id `34596788624`')
text = text.replace('- 1 low.', '- 0 low.')
text = text.replace('The remaining moderate `uuid` / older `gaxios` findings are within Firebase Admin\'s optional `@google-cloud/storage` path.', 'The remaining moderate `uuid` / older `gaxios` findings are within Firebase Admin\'s optional `@google-cloud/storage` path. The former `esbuild` low is closed through supported `tsx@4.23.13` + `esbuild@0.28.2` remediation.')
Path(p).write_text(text)

# Build artifact identity
p = 'docs/redevelopment/build-artifact-identity-2026-09-11.md'
text = Path(p).read_text()
old = 'CI #1443 / run `34595996778` for source `49c34b9833b7dc2036a0e1bab948689608108ed4` retained artifact `kcfc-build-manifest-49c34b9833b7dc2036a0e1bab948689608108ed4` (artifact id `10262082863`) with archive digest `sha256:54701b07d5658dbc9045fe4ffa77fbfd6cc8acba986fcc6fe09283b4a306089d`, expiring `2026-10-11T11:51:53Z`.'
new = 'CI #1459 / run `34596788624` for source `8ea202c552d88712ffe34b53e7697caa40b6d6b2` retained artifact `kcfc-build-manifest-8ea202c552d88712ffe34b53e7697caa40b6d6b2` (artifact id `10261723910`) with archive digest `sha256:b523ba2c7062b58e4d2451726a9e435140ded21934548c160b5f9f984c7d5ccb`, expiring `2026-10-11T12:01:45Z`.'
if old in text:
    text = text.replace(old, new, 1)
else:
    text = text.replace('49c34b9833b7dc2036a0e1bab948689608108ed4', '8ea202c552d88712ffe34b53e7697caa40b6d6b2').replace('10262082863', '10261723910').replace('sha256:54701b07d5658dbc9045fe4ffa77fbfd6cc8acba986fcc6fe09283b4a306089d', 'sha256:b523ba2c7062b58e4d2451726a9e435140ded21934548c160b5f9f984c7d5ccb').replace('2026-10-11T11:51:53Z', '2026-10-11T12:01:45Z').replace('#1443 / run `34595996778`', '#1459 / run `34596788624`')
Path(p).write_text(text)

print('Readiness 1459 documentation sync prepared.')
