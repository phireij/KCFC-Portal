# Residual Dependency Disposition — 2026-09-11

Branch: `redesign/mobile-first-v2`

Status: production-readiness evidence only. This record does **not** authorize a production merge or deployment.

## Current measured position

The production/runtime audit is now reduced to **2 findings: 0 critical, 0 high, 2 moderate, 0 low**.

Latest exact-clean-head evidence before this disposition refresh: `KCFC Redevelopment CI` run **#1459** / id `34596788624` on head `8ea202c552d88712ffe34b53e7697caa40b6d6b2`. `npm audit --omit=dev` reported exactly two remaining runtime findings:

- `gaxios` — moderate — affected installed range `6.4.0 - 6.7.1`;
- `uuid` — moderate — affected installed range `<11.1.1`.

The previous `esbuild` low finding is no longer present in the production/runtime audit snapshot.

The previously open `qs` moderate was remediated by a supported parent migration from Express 4 to **Express 5.2.1**. The migration was first exercised in an isolated probe with TypeScript, all KCFC redevelopment contracts, production build, live `/api/health` startup and SPA fallback routing. The tested package/lock/server state was then committed to the redevelopment branch and the ordinary `KCFC Redevelopment CI` passed again.

No `npm audit fix --force`, speculative leaf override, or production deployment was used.

## Residual set

| Package | Severity | Current evidence | Disposition |
| --- | --- | --- | --- |
| `uuid` | moderate | `uuid` 9.0.1 remains under the optional Firebase Admin / `@google-cloud/storage` chain. The reviewed advisory is specific to v3/v5/v6 caller-provided output-buffer behavior; the audit requires a fixed `uuid` line above the installed major. | **BOUNDED / OPEN FOR PARENT REMEDIATION.** KCFC source does not import Firebase Admin Storage, `@google-cloud/storage`, or call `getStorage()`. Permanent CI guards that boundary. Reopen reachability review before any Storage activation. |
| `gaxios` | moderate | The affected `gaxios` 6.7.1 copy remains under the optional `@google-cloud/storage` dependency path. Current upstream `gaxios` has moved beyond the affected 6.x line, but the current supported Storage parent still declares the legacy 6.x dependency family. | **BOUNDED / OPEN FOR PARENT REMEDIATION.** Do not force a global leaf override. Treat the Storage path as unused unless a future feature explicitly activates it. |
| `esbuild` | low | The affected nested copy came from `tsx@4.21.0` resolving `esbuild@0.27.7`. A direct top-level `esbuild@0.28.2` probe did not remove that nested copy, so it was rejected. Updating the supported parent to `tsx@4.23.13` together with top-level `esbuild@0.28.2` removed the audit finding. | **CLOSED through supported tooling-parent remediation.** TypeScript, production build and all ordinary redevelopment CI checks passed afterward. |

## Current upstream parent-package check

A fresh upstream review on **2026-09-11** found no supported parent-package upgrade available that removes the two remaining moderate Storage-path findings:

- KCFC already uses `firebase-admin` **14.4.0**.
- `firebase-admin` **14.4.0** is the current npm `latest` release as of this review.
- Current `@google-cloud/storage` **8.1.0** is also the latest stable release surfaced during the review.
- The current Storage release still declares the legacy `gaxios` 6.x dependency family; a simple lock refresh therefore cannot move that path onto current `gaxios` 8.x.
- The vulnerable `uuid` 9.0.1 line requires a newer fixed major; the currently supported Storage dependency chain does not provide that transition for KCFC.

Therefore the correct current action is **containment + visibility**, not a forced override:

1. keep the optional Storage path unused;
2. keep the source-level Storage activation guard in CI;
3. keep `npm audit --omit=dev` visible on every redevelopment CI run;
4. re-check supported Firebase Admin / Google Cloud releases before production approval and whenever Storage functionality is proposed; and
5. do not add a third-party repackaged Storage fork or dependency override solely to make the audit count disappear.

This upstream check is a point-in-time disposition. It should be revisited when either Firebase Admin or Google Cloud Storage publishes a compatible parent release that changes the affected dependency chain.

## Closed finding: `esbuild`

The prior development/tooling tree contained `tsx@4.21.0 -> esbuild@0.27.7`, which was within the low-severity affected range. A direct top-level update to `esbuild@0.28.2` was intentionally tested first and **rejected** because `tsx` still retained its own affected nested copy.

A supported parent update then moved the toolchain to:

- `tsx` **4.23.13**; and
- top-level `esbuild` **0.28.2**.

The remediation probe confirmed the `esbuild` audit finding was absent, then passed TypeScript and the production build before committing only `package.json` / `package-lock.json`. The temporary remediation workflow was removed. Ordinary `KCFC Redevelopment CI` run **#1459** on clean head `8ea202c552d88712ffe34b53e7697caa40b6d6b2` then passed all **58** named checks and recorded **0 low** runtime findings. No override, force-fix or fork was used.


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
- `uuid` moderate: **BOUNDED to currently unused optional Storage path; no supported parent remediation available at the 2026-09-11 upstream check**.
- `gaxios` moderate: **BOUNDED to currently unused optional Storage path for the affected older copy; no supported parent remediation available at the 2026-09-11 upstream check**.
- `esbuild` low: **CLOSED through supported `tsx@4.23.13` + `esbuild@0.28.2` remediation, validated by CI #1459**.
- Production merge/deployment: **still requires explicit user approval** regardless of dependency status.

## Required follow-up

1. Keep the Firebase Admin Storage boundary verifier in permanent CI.
2. Re-check supported Firebase Admin / Google Cloud parent releases before production approval and when those packages publish new compatible versions.
3. Reopen dependency reachability review before adding any Storage-backed feature.
4. Continue to prohibit forced audit fixes, speculative overrides, and third-party repackaged dependency substitutes as audit-only workarounds.
