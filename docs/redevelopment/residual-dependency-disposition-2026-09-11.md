# Residual Dependency Disposition — 2026-09-11

Branch: `redesign/mobile-first-v2`

Status: production-readiness evidence only. This record does **not** authorize a production merge or deployment.

## Purpose

The current runtime audit has already been reduced to four residual entries with no critical or high runtime finding. This record separates findings that can be dispositioned from findings that still need package-owner/advisory reachability evidence before production approval.

No `npm audit fix --force`, speculative package override, or production dependency rewrite is authorized by this document.

## Current residual set

| Package | Audit severity | Current evidence | Disposition |
| --- | --- | --- | --- |
| `qs` | moderate | Runtime/transitive. The normal non-forced `npm audit fix --omit=dev` did not change the locked tree. | **OPEN — trace owner + advisory reachability.** Do not override solely to clear the audit count. |
| `uuid` | moderate | Runtime/transitive in the Google Cloud dependency family. | **OPEN — trace exact parent and affected execution path.** Prefer a supported parent-package fix when available. |
| `gaxios` | moderate | Runtime/transitive Google Cloud dependency and part of the remaining `uuid` chain. | **OPEN — evaluate together with the owning Google Cloud parent.** Avoid isolated override until compatibility is proven. |
| `esbuild` | low | Reported through the `tsx` development-tooling chain. `tsx` is a development dependency; production start executes `node dist/server.cjs`. | **PRODUCTION EXPOSURE LOW / TOOLING-ONLY PATH.** Keep visible in the full dependency audit and update through supported tooling versions when compatible. |

## Exposure boundary

### Production server/runtime

The production package scripts build a browser bundle with Vite and a bundled CommonJS server entry with esbuild, then start the deployed server with:

`node dist/server.cjs`

The `tsx` runner is used by the local/development `dev` script and CI verification commands; it is not the production start command. That supports treating the residual low `esbuild` entry under the `tsx` chain as a development/tooling exposure rather than a deployed-server execution dependency.

This does **not** remove the finding from audit visibility. It documents why it does not currently block production readiness at the same level as a reachable runtime vulnerability.

### Runtime moderate findings

`qs`, `uuid`, and `gaxios` remain open because package name + severity alone is not sufficient evidence to declare them unreachable. Before the production dependency gate can be closed, the exact installed parent chain and advisory-specific execution path must be recorded.

Until then:

- no forced audit fix;
- no speculative `overrides` entry;
- no downgrade of audit visibility;
- no claim that the three moderate findings are harmless;
- supported parent-package upgrades remain preferred over leaf overrides.

## Required closure evidence for the three moderate entries

For each remaining runtime finding, record:

1. exact installed version and advisory identifier;
2. direct/transitive owner chain from the KCFC dependency tree;
3. browser, server, connector, build-only, or unused-path classification;
4. whether the affected API/path is actually exercised by KCFC production flows;
5. supported remediation path, if one exists;
6. TypeScript + production build + redevelopment regression evidence for any accepted dependency change.

## Release-gate effect

- Critical/high runtime dependency gate: **CLEAR at the current measured branch state.**
- Low `esbuild`/`tsx` production-exposure disposition: **DOCUMENTED as tooling-only / low production exposure.**
- Moderate runtime dependency gate (`qs`, `uuid`, `gaxios`): **OPEN pending owner/advisory reachability evidence.**
- Production merge/deployment: **STILL REQUIRES EXPLICIT USER APPROVAL even after all dependency findings are dispositioned.**
