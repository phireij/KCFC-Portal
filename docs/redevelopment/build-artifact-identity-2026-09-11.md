# KCFC Portal — Build Artifact Identity Evidence — 2026-09-11

Branch: `redesign/mobile-first-v2`

Status: **build/readiness evidence only.** This does not authorize deployment, production merge, rollback, restore, connector activation, live messaging, or any production mutation.

## Purpose

Tie a future KCFC deployment artifact back to an exact source commit and the exact files produced by the repository build.

After `npm run build`, CI now generates `dist/kcfc-build-manifest.json` and verifies it before the build is treated as ready evidence. CI then retains only that non-secret manifest as a GitHub Actions artifact for 30 days; it does not upload environment files, credentials or the full runtime filesystem.

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

## Current retained evidence

CI #1443 / run `34595996778` for source `49c34b9833b7dc2036a0e1bab948689608108ed4` retained artifact `kcfc-build-manifest-49c34b9833b7dc2036a0e1bab948689608108ed4` (artifact id `10262082863`) with archive digest `sha256:54701b07d5658dbc9045fe4ffa77fbfd6cc8acba986fcc6fe09283b4a306089d`, expiring `2026-10-11T11:51:53Z`. This is repository-side evidence only.
