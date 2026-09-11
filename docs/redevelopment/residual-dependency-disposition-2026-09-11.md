# Residual Dependency Disposition — 2026-09-11

Branch: `redesign/mobile-first-v2`

Status: production-readiness evidence only. This record does **not** authorize a production merge or deployment.

## Purpose

The current runtime audit has already been reduced to four residual package entries with no critical or high runtime finding. This record maps the remaining moderate findings to their current public advisories and the installed copies we can identify, without treating package presence alone as proof of exploitability.

No `npm audit fix --force`, speculative package override, or production dependency rewrite is authorized by this document.

## Current residual set

| Package | Audit severity | Locked-tree / advisory evidence | Disposition |
| --- | --- | --- | --- |
| `qs` | moderate | The lockfile contains `qs` **6.14.2** plus a nested `body-parser` copy at **6.16.0**. `GHSA-4mjr-xmp4-gh2g` / `CVE-2026-82417` affects `qs >=2.2.5 <=6.15.3`; `GHSA-x5fp-wj9c-mxmx` / `CVE-2026-82562` affects `qs >=6.14.2 <=6.15.3`. Both are patched in 6.16.0. | **OPEN, NARROWED — the 6.14.2 copy is inside the affected ranges; the nested 6.16.0 copy is outside them.** Map the 6.14.2 owner/call path and use a supported parent update rather than a blanket override. |
| `uuid` | moderate | Lockfile resolves `uuid` **9.0.1** as an optional transitive dependency. `GHSA-w5hq-g745-h8pq` / `CVE-2026-41907` affects versions `<11.1.1` and specifically concerns the `v3`/`v5`/`v6` APIs when caller-provided output buffers/offsets are used. | **OPEN, NARROWED — installed version is affected, but KCFC reachability depends on the owning Google Cloud/gaxios path invoking the vulnerable buffer-output APIs.** Prefer a supported parent-package fix. |
| `gaxios` | moderate | Lockfile contains `gaxios` **7.1.4** plus an optional `@google-cloud/storage` nested copy at **6.7.1**. The older Google Cloud path is also where the transitive `uuid` 9.x family appears. | **OPEN — evaluate together with the owning Google Cloud/Auth/Storage parent.** Do not independently force `gaxios` or `uuid` across parent compatibility boundaries. |
| `esbuild` | low | Reported through the `tsx` development-tooling chain. `tsx` is a development dependency; production start executes `node dist/server.cjs`. | **PRODUCTION EXPOSURE LOW / TOOLING-ONLY PATH.** Keep visible in the full dependency audit and update through supported tooling versions when compatible. |

## Advisory-specific interpretation

### `qs` 6.14.2

Two current reviewed advisories now make the installed-copy distinction important:

1. `GHSA-4mjr-xmp4-gh2g` / `CVE-2026-82417` — denial of service involving attacker-controlled `constructor.isBuffer` during an affected `qs.parse(...)` → `qs.stringify(...)` style flow. Patched in `qs` 6.16.0.
2. `GHSA-x5fp-wj9c-mxmx` / `CVE-2026-82562` — array-limit bypass when comma parsing and bracket-array syntax are combined. Patched in `qs` 6.16.0.

The KCFC lockfile's `qs` 6.14.2 copy falls inside both affected ranges, while the nested 6.16.0 copy is already patched for both. This means a global statement that “qs is patched” would be incorrect, but a global override is also not justified without validating the owner package.

KCFC does not currently document use of `comma: true`, `plainObjects: true`, or an explicit application-level `qs.stringify` round trip. That reduces evidence for those exact exploit preconditions but is **not** enough to close the finding because Express/body-parser query/form parsing remains part of the server request boundary. The supported parent chain should therefore be upgraded/probed rather than relying on configuration assumptions.

### `uuid` 9.0.1

`GHSA-w5hq-g745-h8pq` / `CVE-2026-41907` is narrower than a generic UUID-generation flaw. The vulnerable behavior is in the `v3`, `v5`, and `v6` API methods when an external output buffer and offset are supplied; ordinary UUID APIs such as `v4` are not the affected path described by the advisory.

The installed `uuid` 9.0.1 version is inside the affected range, but it is optional/transitive rather than a KCFC direct dependency. Production disposition therefore depends on whether the owning Google Cloud/gaxios path can exercise those specific buffer-writing methods with attacker-influenced buffer/offset inputs. Until that owner/API reachability is proven or the parent dependency is upgraded, the finding remains open.

### `gaxios`

The lockfile contains two material versions rather than one homogeneous package state. The older nested `gaxios` 6.7.1 copy belongs to an optional `@google-cloud/storage` path, while a newer 7.1.4 copy is also installed for current Google auth support. Because the residual audit output groups findings by package and npm can report transitive paths together, the correct remediation unit is the owning Google Cloud/Auth/Storage package family, not an isolated leaf override.

## Exposure boundary

### Production server/runtime

The production package scripts build a browser bundle with Vite and a bundled CommonJS server entry with esbuild, then start the deployed server with:

`node dist/server.cjs`

The `tsx` runner is used by the local/development `dev` script and CI verification commands; it is not the production start command. That supports treating the residual low `esbuild` entry under the `tsx` chain as a development/tooling exposure rather than a deployed-server execution dependency.

This does **not** remove the finding from audit visibility. It documents why it does not currently block production readiness at the same level as a reachable runtime vulnerability.

### Runtime moderate findings

Current classification is now:

- `qs`: **affected installed copy confirmed**; exact server owner/call-path remediation still open.
- `uuid`: **affected installed version confirmed**; vulnerable API reachability through the optional cloud path still open.
- `gaxios`: **multiple installed copies confirmed**; remediation must be evaluated at the supported parent-package family level.

Until parent/remediation validation is complete:

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
- `qs` moderate gate: **OPEN, but affected copy/advisories are now identified.**
- `uuid` moderate gate: **OPEN, but affected version and vulnerable API family are now identified.**
- `gaxios` moderate gate: **OPEN pending parent-family remediation/reachability evidence.**
- Production merge/deployment: **STILL REQUIRES EXPLICIT USER APPROVAL even after all dependency findings are dispositioned.**

## Public advisory references

- GitHub Advisory Database: `GHSA-4mjr-xmp4-gh2g` (`CVE-2026-82417`), patched in `qs` 6.16.0.
- GitHub Advisory Database: `GHSA-x5fp-wj9c-mxmx` (`CVE-2026-82562`), patched in `qs` 6.16.0.
- GitHub Advisory Database: `GHSA-w5hq-g745-h8pq` (`CVE-2026-41907`), patched in supported `uuid` lines beginning at 11.1.1 / 12.0.1 / 13.0.1.
