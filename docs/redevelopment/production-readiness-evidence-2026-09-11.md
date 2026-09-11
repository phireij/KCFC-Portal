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
- safe member pre-registration identity/default-state contract;
- Core-status transition/mutation planning;
- staging-only Core-status executor safeguards and isolation;
- leadership accessibility contracts;
- mobile navigation contract;
- delivery diagnostics and current-device notification health contracts;
- production build;
- raw + gzip JavaScript asset-size reporting after the production build;
- resolved-build-warning regression guards;
- connector defaults OFF;
- provider-secret browser exposure guard.

Full redevelopment CI remained green through the focused leadership, bundle-reporting, staging-matrix and advisory-disposition increments. The advisory-disposition head completed PR CI run **#718** successfully before the isolated Express remediation probe was introduced.

Every new code/dependency increment must still obtain a fresh full CI result before being treated as accepted evidence.

## Current dependency position

- Runtime audit baseline before the active Express probe: 0 critical, 0 high, 3 moderate, 1 low.
- `esbuild` under the `tsx` development-tooling path has an explicit low-production-exposure disposition.
- `qs` is now advisory-mapped: the locked 6.14.2 copy is inside the affected ranges for `GHSA-4mjr-xmp4-gh2g` / `CVE-2026-82417` and `GHSA-x5fp-wj9c-mxmx` / `CVE-2026-82562`; the separate nested 6.16.0 copy is already outside both ranges.
- `uuid` 9.0.1 is inside `GHSA-w5hq-g745-h8pq` / `CVE-2026-41907`; the advisory is specific to v3/v5/v6 caller-provided output-buffer behavior, so parent/API reachability remains open.
- `gaxios` exists in multiple installed versions and parent paths; remediation remains parent-family based instead of using a speculative global override.
- Forced audit fixes and speculative overrides remain prohibited.
- A one-time isolated **Express 4.22.2** probe is active on the redevelopment branch to determine whether a supported parent update resolves the affected `qs` copy while preserving all KCFC contracts and production build behavior. No candidate package file is accepted until the probe and subsequent normal CI are green.

See: `residual-dependency-disposition-2026-09-11.md`.

## Current bundle-performance position

Established prior measurement:

- original main client chunk: approximately 2.31 MB / 603.5 KB gzip;
- after route lazy-loading: approximately 1.32 MB / 357.1 KB gzip;
- route pages such as Admin, Duties, Polls, Accounting, Profile and Inbox load separately.

Validated bundle increment:

- explicit shared-vendor boundaries now separate Firebase, charting/D3, and Motion;
- the normal Vite 500 KiB warning remains enabled rather than being hidden through `chunkSizeWarningLimit` changes;
- permanent CI now records raw + gzip size for every generated JavaScript asset, total JavaScript weight and the standard Vite application entry where identifiable;
- the build asset reporting step itself is green in the full redevelopment CI.

GitHub's currently available connector surface confirms the reporting step passed but does not expose the rendered `GITHUB_STEP_SUMMARY` asset table directly. No unverified size figures are copied into this evidence register.

## Leadership decomposition position

Focused routine workflows now exist for:

- Leadership overview;
- Website inquiries, including individual explicit-send email replies with the recipient locked to the inquiry sender;
- Member communications;
- safe member pre-registration that writes only unverified pending Firestore profiles and leaves Firebase Auth untouched;
- Member approval;
- Roles & ministries with pre-save change summary and UID-preservation messaging;
- Member account-status overview;
- Core-status preview/planning.

Still isolated in Advanced Legacy Tools:

- actual Core-status mutation;
- account disablement;
- profile/member removal;
- credential purge;
- legacy compatibility versions of pre-registration and inquiry reply while focused replacements finish staging validation;
- other low-frequency/destructive compatibility controls.

Focused inquiry reply does not auto-send, does not permit changing the inquiry recipient, and does not delete the source inquiry. No live inquiry-reply QA email was sent by redevelopment work.

No destructive legacy control should be moved into a routine workspace until it has a separately reviewed governed workflow and staging evidence.

## Staging/device evidence still required

Automated contract tests are not substitutes for device QA. Before production approval is requested, collect explicit staging evidence for at least:

### iPhone / iOS PWA
- Add to Home Screen flow;
- notification permission from explicit interaction;
- Web Push registration and repair;
- background/locked-device notification behavior;
- transport result recorded separately from OS-controlled banner/sound/vibration behavior, including Focus/mute scenarios;
- test notification deep link;
- safe-area behavior for bottom navigation and More sheet;
- Inbox list → detail navigation;
- Schedule All ↔ My Ministry flow.

### Android / Chromium
- native/manual install path;
- permission + device registration;
- stale-registration repair;
- background/locked-device delivery and notification-channel behavior;
- push deep link;
- mobile navigation, Schedule, Directory and Inbox regression.

### Multi-device notification reliability
- two valid registered devices for one synthetic member;
- one stale/expired endpoint alongside a valid endpoint;
- delivery evidence correlated to the durable Inbox record without equating provider acceptance with user-visible delivery.

### Desktop
- leadership tab keyboard navigation;
- focused member pre-registration using synthetic staging data only;
- focused individual inquiry reply using a staging/sink recipient only;
- governed role/ministry change preview + save;
- confirmation that destructive account/Core controls are absent from focused routine surfaces;
- accounting compatibility surface;
- Schedule/roster publication visibility rules;
- Inbox desktop split view;
- unauthorized-role denial paths.

## Production-readiness blockers still open

1. Complete and disposition the isolated Express 4.22.2 parent-remediation probe; if accepted, rerun normal CI on the actual package/lockfile change.
2. Parent/API reachability or supported remediation closure for the remaining `uuid` / `gaxios` moderate chain after `qs` disposition.
3. Representative staging/device QA evidence, especially real iOS/Android notification behavior.
4. Any further leadership decomposition only where it reduces routine use of LegacyAdmin without weakening destructive-action isolation.
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
