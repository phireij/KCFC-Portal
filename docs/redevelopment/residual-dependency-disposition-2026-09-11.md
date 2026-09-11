# Residual Dependency Disposition — 2026-09-11

Branch: `redesign/mobile-first-v2`

Status: production-readiness evidence only. This record does **not** authorize a production merge or deployment.

## Current measured position

The production/runtime audit is now reduced to **3 findings: 0 critical, 0 high, 2 moderate, 1 low**.

The previously open `qs` moderate was remediated by a supported parent migration from Express 4 to **Express 5.2.1**. The migration was first exercised in an isolated probe with TypeScript, all KCFC redevelopment contracts, production build, live `/api/health` startup and SPA fallback routing. The tested package/lock/server state was then committed to the redevelopment branch and the ordinary `KCFC Redevelopment CI` passed again.

No `npm audit fix --force`, speculative leaf override, or production deployment was used.

## Residual set

| Package | Severity | Current evidence | Disposition |
| --- | --- | --- | --- |
| `uuid` | moderate | `uuid` 9.0.1 remains under the optional Firebase Admin / `@google-cloud/storage` chain. The reviewed advisory is specific to v3/v5/v6 caller-provided output-buffer behavior. | **BOUNDED / OPEN FOR PARENT REMEDIATION.** KCFC source does not import Firebase Admin Storage, `@google-cloud/storage`, or call `getStorage()`. Permanent CI now guards that boundary. Reopen reachability review before any Storage activation. |
| `gaxios` | moderate | The affected older `gaxios` copy remains under the optional `@google-cloud/storage` dependency path. A newer auth-related copy is also present elsewhere in the tree. | **BOUNDED / OPEN FOR PARENT REMEDIATION.** Do not force a global leaf override. Treat the Storage path as unused unless a future feature explicitly activates it. |
| `esbuild` | low | Reported through the `tsx` development/tooling chain. Production starts with `node dist/server.cjs`. | **LOW PRODUCTION EXPOSURE / TOOLING PATH.** Keep visible and update through supported tooling versions when compatible. |

## Closed finding: `qs`

The prior lockfile contained an affected `qs` 6.14.2 copy. A supported Express 4.22.2 probe still resolved an affected `qs` line, so that candidate was rejected rather than recorded as remediation.

A separate Express **5.2.1** probe resolved the parent chain to patched `qs` **6.16.0**. The candidate passed:

- dependency resolution and runtime audit capture;
- TypeScript;
- all KCFC redevelopment verification contracts;
- production build;
- real production-server startup on port 3000;
- `/api/health` response;
- SPA fallback routing for a non-API path.

The exact tested package/lock/server state was then committed to `redesign/mobile-first-v2`, the one-time probe was removed, and normal redevelopment CI passed on the committed state. The `qs` moderate is therefore **CLOSED** at the current branch state.

## Firebase Admin Storage exposure boundary

The remaining `uuid` / older `gaxios` chain is installed through Firebase Admin's optional Google Cloud Storage path. KCFC production source currently uses Firebase Admin App / Firestore / Auth / Messaging behavior and does not activate Storage.

Permanent verification now fails if KCFC source introduces any of the following without reopening security review:

- `firebase-admin/storage` import;
- direct `@google-cloud/storage` import;
- `getStorage(...)` API use.

This is a reachability boundary, not a claim that the installed packages are patched. The findings remain visible in the production audit snapshot until the supported parent chain removes them.

## Release-gate effect

- Critical/high runtime dependency gate: **CLEAR**.
- `qs` moderate: **CLOSED through validated Express 5.2.1 migration**.
- `uuid` moderate: **BOUNDED to currently unused optional Storage path; keep visible and pursue supported parent remediation**.
- `gaxios` moderate: **BOUNDED to currently unused optional Storage path for the affected older copy; keep visible and pursue supported parent remediation**.
- `esbuild` low: **documented as development/tooling exposure**.
- Production merge/deployment: **still requires explicit user approval** regardless of dependency status.

## Required follow-up

1. Keep the Firebase Admin Storage boundary verifier in permanent CI.
2. Prefer a supported Firebase Admin / Google Cloud parent update when it removes the remaining affected transitive copies without regressions.
3. Reopen dependency reachability review before adding any Storage-backed feature.
4. Continue to prohibit forced audit fixes and speculative overrides.
