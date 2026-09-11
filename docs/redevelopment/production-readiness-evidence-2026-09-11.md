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

## Automated evidence

Permanent `KCFC Redevelopment CI` validates:

- TypeScript;
- production/runtime audit visibility;
- communication policy and communication batches;
- liturgical creator/diff/publication plans;
- leadership broadcast planning/accessibility;
- member governance, pre-registration safety and account-status classification;
- Core-status transition/mutation planning plus staging-executor isolation;
- Firebase Admin Storage non-use boundary;
- leadership accessibility;
- mobile navigation contract;
- delivery diagnostics and current-device notification health;
- production build and resolved-warning guards;
- raw + gzip JavaScript asset-size reporting;
- connector defaults OFF and provider-secret browser guards.

The full redevelopment CI was green on the accepted Express 5.2.1 branch state and again on the latest branch increments. Every later code/dependency change still requires a fresh green run before it is treated as validated evidence.

## Dependency position

Current runtime audit: **0 critical, 0 high, 2 moderate, 1 low**.

- `qs` moderate: **closed** through validated Express **5.2.1** migration, which resolves the relevant parent chain to patched `qs` 6.16.0.
- The Express migration was validated through TypeScript, all KCFC contracts, production build, actual server startup, `/api/health`, SPA fallback routing, and ordinary redevelopment CI after commit.
- `uuid` moderate and the affected older `gaxios` copy remain under Firebase Admin's optional `@google-cloud/storage` chain.
- KCFC source currently does not import `firebase-admin/storage`, directly import `@google-cloud/storage`, or call `getStorage()`.
- Permanent CI now guards that Storage boundary so future activation cannot silently change the reachability assumption.
- The remaining findings stay visible and should be removed through supported Firebase Admin / Google Cloud parent updates when available and compatible; forced overrides remain prohibited.
- `esbuild` low remains documented as development/tooling exposure because production starts with `node dist/server.cjs`.

See `residual-dependency-disposition-2026-09-11.md`.

## Bundle-performance position

Established earlier measurement:

- original main client chunk: approximately 2.31 MB / 603.5 KB gzip;
- after route lazy-loading: approximately 1.32 MB / 357.1 KB gzip;
- route pages including Admin, Duties, Polls, Accounting, Profile and Inbox load separately.

Additional validated work:

- explicit vendor boundaries for Firebase, Recharts/D3 and Motion;
- normal Vite chunk-size warning remains enabled;
- permanent CI records raw + gzip size for generated JavaScript assets, total JS weight and the standard main entry where identifiable;
- no unverified post-split size figure is claimed in this register.

## Leadership decomposition position

Focused routine workflows now exist for:

- Leadership overview;
- Website inquiries, including individual explicit-confirmation replies locked to the inquiry sender;
- Member communications;
- safe member pre-registration that writes only unverified pending Firestore profiles and leaves Firebase Auth untouched;
- Member approval;
- Roles & Ministries with pre-save change summary and UID preservation;
- Member account-status overview;
- Core-status preview/planning.

Still isolated in Advanced Legacy Tools:

- actual Core-status mutation;
- account disablement;
- profile/member removal;
- credential purge;
- low-frequency/destructive compatibility controls.

No destructive legacy control should be moved into a routine workspace without a separately reviewed governed workflow and staging evidence.

## Staging/device evidence still required

Automated contracts are not a substitute for real-device staging QA.

### iPhone / iOS PWA

- Add to Home Screen;
- explicit notification permission;
- Web Push registration/repair;
- background and locked-device delivery;
- transport evidence separated from OS banner/sound/vibration behavior, including Focus/mute cases;
- push deep link;
- safe-area navigation and More sheet;
- Inbox list → detail;
- Schedule All ↔ My Ministry.

### Android / Chromium

- install flow;
- permission and registration;
- stale endpoint repair;
- background/locked notification and notification-channel behavior;
- push deep link;
- navigation, Schedule, Directory and Inbox regression.

### Multi-device

- two valid registered devices for one synthetic member;
- one stale endpoint plus a valid endpoint;
- transport evidence correlated to durable KCFC Inbox without treating provider acceptance as proof of user-visible delivery.

### Desktop / leadership

- keyboard navigation;
- synthetic pre-registration;
- individual inquiry reply to staging/sink recipient only;
- governed role/ministry change preview + save;
- destructive controls absent from focused routine surfaces;
- accounting compatibility;
- Schedule/roster visibility rules;
- Inbox split view;
- unauthorized-role denial.

## Production-readiness blockers still open

1. Representative staging/device QA, especially real iOS/Android notification behavior.
2. Supported parent remediation or continued bounded disposition for the remaining optional Storage-path `uuid` / `gaxios` findings.
3. Any further leadership decomposition only where it reduces routine LegacyAdmin use without weakening destructive-action isolation.
4. Backup/rollback evidence before a production request.
5. Explicit user approval for production merge/deploy and every separately gated production-sensitive action.

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
