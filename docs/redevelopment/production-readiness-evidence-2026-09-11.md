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
- member governance, pre-registration safety, pre-registration email-verification migration and account-status classification;
- Core-status transition/mutation planning plus staging-executor isolation;
- Firebase Admin Storage non-use boundary;
- leadership accessibility;
- mobile navigation contract;
- delivery diagnostics, current-device notification health, privacy-safe device QA snapshots and self-test recipient isolation;
- production build and resolved-warning guards;
- raw + gzip JavaScript asset-size reporting;
- connector defaults OFF and provider-secret browser guards.

Latest validated code/CI head before this documentation-only refresh: `93e2cdd070a7c49fb1243eb1bec2ec5f6d7afc1a`, `KCFC Redevelopment CI` run #770, conclusion **success**. All 33 validation/build/security steps passed, including the new pre-registration email-verification migration guard.

The onboarding regression fixed on that validated head ensures a pending pre-registered member is not automatically marked email-verified merely because the pending profile exists. Bootstrap admin remains the explicit exception; otherwise the migration respects Firebase Auth `emailVerified` or an already-true pending value.

Every later code/dependency change still requires a fresh green run before it is treated as validated evidence. Documentation-only evidence refreshes do not substitute for code CI.

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

## Staging/device QA package

The canonical device acceptance procedure is documented in `staging-device-qa-package-2026-09-11.md`, with evidence classes in `staging-readiness-evidence-map-2026-09-11.md`.

It uses this sequence:

1. automated CI/contracts;
2. browser responsive/mobile emulation;
3. Android Emulator where useful;
4. physical iPhone acceptance;
5. physical Android tablet acceptance;
6. preferably an additional KCFC member Android phone for representative real-world Android coverage.

Every notification test separately records:

- transport acceptance;
- actual OS presentation (banner/lock screen/sound/vibration); and
- durable KCFC Inbox persistence.

No emulator result may be represented as physical-device evidence.

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
- pending pre-registered member first authentication while email remains unverified, then post-verification transition without UID recreation;
- individual inquiry reply to staging/sink recipient only;
- governed role/ministry change preview + save;
- destructive controls absent from focused routine surfaces;
- accounting compatibility;
- Schedule/roster visibility rules;
- Inbox split view;
- unauthorized-role denial.

## Backup / rollback readiness

The canonical rollback requirements are documented in `backup-rollback-plan-2026-09-11.md`.

The plan establishes:

- Firebase UID preservation and no Auth recreation;
- application/version rollback as the preferred first response;
- destructive data restoration only as a separately reviewed and explicitly approved last resort;
- required release/build/CI/environment evidence before production approval;
- notification-specific rollback checks;
- post-rollback non-destructive smoke verification;
- a strict separation between readiness documentation and actual production backup/restore execution.

Provider/environment backup evidence and exact production deployment-artifact rollback evidence are still required before any production request.

## Production-readiness blockers still open

1. Representative staging/device QA, especially real iOS/Android notification behavior.
2. Supported parent remediation or continued bounded disposition for the remaining optional Storage-path `uuid` / `gaxios` findings.
3. Any further leadership decomposition only where it reduces routine LegacyAdmin use without weakening destructive-action isolation.
4. Provider/environment backup evidence plus exact deployment-artifact rollback evidence before a production request.
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
