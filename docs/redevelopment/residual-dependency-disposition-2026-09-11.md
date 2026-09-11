# Residual Dependency Disposition — 2026-09-11

Branch: `redesign/mobile-first-v2`

Status: production-readiness evidence only. This record does **not** authorize a production merge or deployment.

## Purpose

The current runtime audit has already been reduced to four residual entries with no critical or high runtime finding. This record separates findings that can be dispositioned from findings that still need package-owner/advisory reachability evidence before production approval.

No `npm audit fix --force`, speculative package override, or production dependency rewrite is authorized by this document.

## Current residual set

| Package | Audit severity | Locked-tree evidence | Disposition |
| --- | --- | --- | --- |
| `qs` | moderate | Lockfile contains top-level/transitive `qs` 6.14.2 and a nested `body-parser` copy at 6.16.0. The normal non-forced `npm audit fix --omit=dev` did not alter the locked tree. | **OPEN — map the advisory to the affected installed copy and runtime call path.** Do not override solely to clear the audit count. |
| `uuid` | moderate | Lockfile resolves `uuid` 9.0.1 as an optional transitive dependency. The parent dependency block using it also depends on proxy support and `node-fetch` 2.x, placing it in a server/cloud-support path rather than the browser application shell. | **OPEN — identify the exact parent package/advisory path before remediation.** Prefer a supported parent-package fix when available. |
| `gaxios` | moderate | Lockfile contains `gaxios` 7.1.4 plus an optional `@google-cloud/storage` nested copy at 6.7.1. `gtoken` 8.0.0 depends on `gaxios` ^7.0.0. | **OPEN — map the advisory to the affected copy and owning Google Cloud/auth path.** Avoid isolated override until compatibility is proven. |
| `esbuild` | low | Reported through the `tsx` development-tooling chain. `tsx` is a development dependency; production start executes `node dist/server.cjs`. | **PRODUCTION EXPOSURE LOW / TOOLING-ONLY PATH.** Keep visible in the full dependency audit and update through supported tooling versions when compatible. |

## Exposure boundary

### Production server/runtime

The production package scripts build a browser bundle with Vite and a bundled CommonJS server entry with esbuild, then start the deployed server with:

`node dist/server.cjs`

The `tsx` runner is used by the local/development `dev` script and CI verification commands; it is not the production start command. That supports treating the residual low `esbuild` entry under the `tsx` chain as a development/tooling exposure rather than a deployed-server execution dependency.

This does **not** remove the finding from audit visibility. It documents why it does not currently block production readiness at the same level as a reachable runtime vulnerability.

### Runtime moderate findings

The lockfile narrows the package/version investigation but does not by itself establish advisory reachability:

- `qs`: at least two installed copies are present (`6.14.2` and nested `6.16.0`), so the audit advisory must be matched to the affected copy before disposition.
- `uuid`: installed at `9.0.1` as an optional transitive dependency in a server/cloud-support chain; the exact owner still needs to be named from the audit/owner tree before closure.
- `gaxios`: both `7.1.4` and an optional `@google-cloud/storage` nested `6.7.1` copy exist; the audit finding must be mapped to the affected version/parent path.

Until that advisory-specific mapping is complete:

- no forced audit fix;
- no speculative `overrides` entry;
- no downgrade of audit visibility;
- no claim that the three moderate findings are harmless;
- supported parent-package upgrades remain preferred over leaf overrides.

## Required closure evidence for the three moderate entries

For each remaining runtime finding, record:

1. exact affected installed version and advisory identifier;
2. direct/transitive owner chain from the KCFC dependency tree;
3. browser, server, connector, build-only, or unused-path classification;
4. whether the affected API/path is actually exercised by KCFC production flows;
5. supported remediation path, if one exists;
6. TypeScript + production build + redevelopment regression evidence for any accepted dependency change.

## Release-gate effect

- Critical/high runtime dependency gate: **CLEAR at the current measured branch state.**
- Low `esbuild`/`tsx` production-exposure disposition: **DOCUMENTED as tooling-only / low production exposure.**
- Moderate runtime dependency gate (`qs`, `uuid`, `gaxios`): **OPEN pending advisory-to-installed-copy and owner/reachability evidence.**
- Production merge/deployment: **STILL REQUIRES EXPLICIT USER APPROVAL even after all dependency findings are dispositioned.**
