# KCFC Portal — Dependency Security Disposition — 2026-09-12

Branch: `redesign/mobile-first-v2`

Status: **repository security evidence only.** This document does not authorize production merge/deploy, package overrides, connector activation, or any production mutation.

## Purpose

Record the current supported-upstream disposition for the remaining moderate runtime audit findings on the optional Firebase Admin Storage dependency path, and prevent speculative dependency overrides from being mistaken for a supported remediation.

## Current repository position

The redevelopment branch currently declares:

- `firebase-admin`: `^14.4.0`
- no direct `@google-cloud/storage` dependency
- no `@google/genai` dependency
- no KCFC application import/use of Firebase Admin Storage; the repository CI permanently guards that assumption.

The current package lock resolves the optional Firebase Admin Storage chain to:

- `@google-cloud/storage` `8.1.0`
- nested `gaxios` `6.7.1`

`gaxios` `6.7.1` declares `uuid` `^9.0.1` as a dependency. The April 2026 `uuid` advisory affects versions below `11.1.1` (as well as vulnerable 12.0.0/13.0.0 releases), so the old `gaxios` line remains the relevant dependency path behind the bounded moderate finding.

## Upstream check — 2026-09-12

Current upstream package metadata was re-checked before changing anything:

1. `firebase-admin` `14.4.0` is the current published release.
2. The upstream `firebase-admin` `14.4.0` package declares optional dependencies:
   - `@google-cloud/firestore`: `^9.1.0`
   - `@google-cloud/storage`: `^8.1.0`
3. The KCFC lockfile already resolves that Storage optional dependency to `8.1.0`.
4. The KCFC lockfile still resolves the Storage-side `gaxios` line to `6.7.1`.
5. `gaxios` 7.x no longer carries the old `uuid` dependency, but moving an `@google-cloud/storage` consumer from its declared `gaxios` 6.x range to a 7.x/8.x line would be a major-version override rather than a parent-supported update.

Relevant upstream references checked:

- Firebase Admin Node SDK package metadata: https://github.com/firebase/firebase-admin-node/blob/v14.4.0/package.json
- Firebase Admin npm package: https://www.npmjs.com/package/firebase-admin
- Google gaxios 6.7.1 package metadata: https://github.com/googleapis/gaxios/blob/v6.7.1/package.json
- uuid advisory GHSA-w5hq-g745-h8pq: https://github.com/uuidjs/uuid/security/advisories/GHSA-w5hq-g745-h8pq
- Google Cloud Storage npm package: https://www.npmjs.com/package/@google-cloud/storage

## Decision

**Do not add a forced `gaxios` or `uuid` override at this checkpoint.**

Reasoning:

- the repository is already on the current Firebase Admin release and current optional Storage major;
- the remaining vulnerable path is optional and not used by KCFC application source;
- CI guards the no-Storage-use assumption;
- forcing a major transitive override would move outside the parent package's declared compatibility range and could create an untested authentication/storage behavior change;
- the remaining audit severity is bounded to the optional Storage path, with no supported parent-package remediation currently available.

A leaf override may only be reconsidered if there is a separate reviewed compatibility test demonstrating that the parent package supports it. It must not be introduced merely to make the audit count read zero.

## Supported remediation trigger

Revisit this finding when any of the following occurs:

1. `@google-cloud/storage` publishes a supported release whose declared dependency chain resolves to a non-vulnerable `gaxios`/`uuid` path;
2. `firebase-admin` publishes a supported release that advances its optional Storage dependency to that remediated line;
3. upstream Firebase/Google guidance documents a supported compatible override; or
4. KCFC begins using Firebase Admin Storage, in which case the current "unreachable optional path" risk classification must be re-opened immediately before that feature is accepted.

When a supported parent remediation exists, update dependencies with npm so `package.json` and the v3 lockfile are regenerated atomically, then require the full KCFC CI/build/security gate before accepting the change.

## Unused Google GenAI cleanup — completed

The previously unused `@google/genai` package has now been removed from both `package.json` and the npm v3 lockfile using `npm uninstall` in an isolated GitHub Actions runner.

The cleanup was accepted only after the one-shot workflow verified all of the following before committing:

- `@google/genai` was absent from `package.json`;
- `node_modules/@google/genai` was absent from `package-lock.json`;
- a fresh `npm ci` succeeded from the regenerated lockfile;
- `npm run lint` succeeded; and
- `npm run build` succeeded.

The temporary cleanup workflow self-deleted after the validated commit. No manual lockfile surgery, dependency override, production deployment, or provider mutation was performed.

## Release implication

This disposition does not clear the empirical staging/device/rollback gates and does not approve production. Dependency cleanup is now reduced to the supported upstream-parent remediation watch for the optional Firebase Admin Storage chain; the separate unused `@google/genai` cleanup item is closed.
