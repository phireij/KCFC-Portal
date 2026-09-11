# Production Readiness Evidence Register — 2026-09-11

Branch: `redesign/mobile-first-v2`
Draft PR: #1
Production baseline: `main` remains `653cc7229600fd7baff17a21a21f12d267b66d2b`

Status: **NOT production-approved.** This register collects evidence and open gates; it does not authorize merge, deployment, migration, connector activation, mass messaging, or production Core-status execution.

## Verified repository boundary

- Redevelopment work remains isolated on `redesign/mobile-first-v2`.
- PR #1 remains draft and targets `main`.
- Production `main` has not moved from the recorded baseline.
- Existing production approval gates remain in force.

## Automated evidence already established

The permanent `KCFC Redevelopment CI` validates:

- TypeScript;
- production/runtime audit visibility;
- communication routing and communication batches;
- liturgical creator/diff/publication plans;
- leadership broadcast planning and accessibility;
- member governance and account-status classification;
- Core-status transition/mutation planning;
- staging-only Core-status executor safeguards and isolation;
- leadership accessibility contracts;
- mobile navigation contract;
- delivery diagnostics and current-device notification health contracts;
- production build;
- resolved-build-warning regression guards;
- connector defaults OFF;
- provider-secret browser exposure guard.

The last fully verified pre-increment branch head was green. Every new readiness increment must obtain a fresh full CI result before being treated as accepted evidence.

## Current dependency position

- Runtime audit: 0 critical, 0 high, 3 moderate, 1 low.
- `esbuild` under the `tsx` development-tooling path now has an explicit low-production-exposure disposition.
- `qs`, `uuid`, and `gaxios` remain open pending exact parent/advisory reachability evidence.
- Forced audit fixes and speculative overrides remain prohibited.

See: `residual-dependency-disposition-2026-09-11.md`.

## Current bundle-performance position

Established prior measurement:

- original main client chunk: approximately 2.31 MB / 603.5 KB gzip;
- after route lazy-loading: approximately 1.32 MB / 357.1 KB gzip;
- route pages such as Admin, Duties, Polls, Accounting, Profile and Inbox load separately.

Current increment adds explicit shared-vendor boundaries for Firebase, charting/D3, and Motion without raising `chunkSizeWarningLimit`. Acceptance requires a fresh green production build. The goal is to reduce concentration in the application shell and improve cacheability, not to hide Vite warnings.

## Leadership decomposition position

Focused routine workflows now exist for:

- Leadership overview;
- Website inquiries;
- Member communications;
- Member approval;
- Roles & ministries;
- Member account-status overview;
- Core-status preview/planning.

Still isolated in Advanced Legacy Tools:

- actual Core-status mutation;
- account disablement;
- profile/member removal;
- credential purge;
- legacy Gmail inquiry reply path;
- other low-frequency/destructive compatibility controls.

No destructive legacy control should be moved into a routine workspace until it has a separately reviewed governed workflow and staging evidence.

## Staging/device evidence still required

Automated contract tests are not substitutes for device QA. Before production approval is requested, collect explicit staging evidence for at least:

### iPhone / iOS PWA
- Add to Home Screen flow;
- notification permission from explicit interaction;
- Web Push registration and repair;
- notification sound/banner behavior as allowed by iOS settings;
- test notification deep link;
- safe-area behavior for bottom navigation and More sheet;
- Inbox list → detail navigation;
- Schedule All ↔ My Ministry flow.

### Android / Chromium
- native/manual install path;
- permission + device registration;
- stale-registration repair;
- push deep link;
- mobile navigation, Schedule, Directory and Inbox regression.

### Desktop
- leadership tab keyboard navigation;
- focused member workflows;
- accounting compatibility surface;
- Schedule/roster publication visibility rules;
- Inbox desktop split view;
- unauthorized-role denial paths.

## Production-readiness blockers still open

1. Fresh CI acceptance for the latest branch head after the bundle/disposition increment.
2. Exact owner/advisory reachability closure for `qs`, `uuid`, and `gaxios`.
3. Representative staging/device QA evidence.
4. Remaining leadership decomposition only where it reduces routine use of LegacyAdmin without weakening destructive-action isolation.
5. Backup/rollback evidence before any production request.
6. Explicit user approval for production merge/deploy and every separately gated production-sensitive action.

## Explicitly prohibited without approval

- merging/deploying to production;
- destructive schema/data migration;
- bulk mutation of users;
- deleting/recreating Firebase Auth users;
- production Core-status execution;
- enabling the staging Core-status executor against any non-isolated environment;
- live external connector activation;
- mass outbound production test messaging;
- public website publishing cutover.
