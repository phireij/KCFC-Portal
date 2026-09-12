# KCFC Portal — Build Artifact Identity Evidence — 2026-09-11

Branch: `redesign/mobile-first-v2`

Status: **build/readiness evidence only.** This does not authorize deployment, production merge, rollback, restore, connector activation, live messaging, or any production mutation.

## Purpose

Tie a future KCFC deployment artifact back to an exact source commit and the exact files produced by the repository build.

After `npm run build`, CI generates `dist/kcfc-build-manifest.json` and verifies it before the build is treated as ready evidence. CI then retains only that non-secret manifest as a GitHub Actions artifact for 30 days; it does not upload environment files, credentials or the full runtime filesystem.

## Manifest contents

The manifest contains only non-secret build identity data:

- manifest version;
- full 40-character source commit SHA;
- file count;
- total byte count; and
- for every build file under `dist` other than the manifest itself:
  - relative path;
  - byte size; and
  - SHA-256 digest.

No environment-variable values, credentials, tokens, Firebase configuration, VAPID material, member data, or runtime secrets are written into the manifest.

## CI source identity

CI sets `KCFC_SOURCE_SHA` to the pull-request head SHA for PR validation and to `github.sha` for ordinary branch pushes. This avoids treating GitHub's temporary PR merge commit as the release-candidate source identity.

Local generation falls back to `git rev-parse HEAD` when `KCFC_SOURCE_SHA` is not supplied.

## Verification contract

`scripts/verify-build-artifact-manifest.mjs` fails if:

- the manifest is missing or malformed;
- the source SHA is not a full Git SHA;
- file count or total bytes do not match;
- a path is absolute, traverses upward, is duplicated, or points to the manifest itself;
- a listed file is missing;
- any listed byte size differs;
- any listed SHA-256 digest differs; or
- the manifest does not cover the complete build-file set under `dist`.

The final condition is important: a manifest cannot pass while silently omitting an untracked build file.

## Future staging/production evidence use

For an actual staging deployment, retain the validated manifest with the deployment/revision identifier and the staging evidence record.

For a future explicitly approved production release, the deployment evidence should correlate:

1. release-candidate source SHA;
2. successful full CI run for that SHA;
3. validated `kcfc-build-manifest.json`;
4. provider artifact/image/revision identifier;
5. provider digest/checksum where available; and
6. selected last-known-good provider artifact/revision for rollback.

The repository manifest proves what the repository built. Its GitHub Actions artifact proves the manifest was retained for the configured evidence window. Neither proves what a hosting provider deployed, nor that a previous provider artifact is still redeployable. Provider-specific rollback evidence therefore remains an open release gate.

## Current retained evidence — 2026-09-12

Latest branch checkpoint:

- source/head: `7278998c072591e6667682bab7358d2d2b2e91ec` (documentation-only checkpoint on top of the validated code/config state);
- CI run: #1631 / `34668140521` — **SUCCESS**;
- retained artifact: `kcfc-build-manifest-7278998c072591e6667682bab7358d2d2b2e91ec`;
- artifact id: `10288749545`;
- archive digest: `sha256:54450c9df171ef15ceb23c38702fcc4c797877e5b61d2e40b8052f19b664bbc5`;
- retention expiry: 2026-10-12.

Latest substantive code/config checkpoint beneath that documentation head:

- source: `9764c502ae6386fd182f9834fe7b129a881a9e05`;
- push CI #1629 / `34668011181` — **SUCCESS**;
- exact-head PR CI #1630 / `34668012763` — **SUCCESS**;
- retained artifact: `kcfc-build-manifest-9764c502ae6386fd182f9834fe7b129a881a9e05`;
- artifact id: `10289604349`;
- archive digest: `sha256:58ee866bdea5adb7e78932543c9fc806f8d8954b4d5bdca830a841104089ef34`;
- retention expiry: 2026-10-12.

These are repository-side artifacts only. They do **not** establish Firebase/App Hosting deployment identity, provider backup availability, or redeployability of a last-known-good provider revision. Those remain provider-side release gates to capture separately.
