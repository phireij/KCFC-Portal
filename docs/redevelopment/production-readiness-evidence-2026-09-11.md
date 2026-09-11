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
- client/server Firebase runtime isolation for staging;
- same-origin, Firebase-project-agnostic Web Push service-worker boundary;
- Inbox deep-link boundary, including same-origin route enforcement;
- Inbox message-history preservation for notification records;
- browser push privacy logging guard preventing VAPID key, PushSubscription and FCM token values from being logged;
- canonical PWA theme/install metadata and shared modern iPhone/iPadOS platform detection across install + notification health;
- synthetic execution of the staging preflight contract;
- leadership accessibility;
- mobile navigation contract;
- Schedule URL/history navigation and Home roster-publication privacy boundary;
- delivery diagnostics, current-device notification health, privacy-safe device QA snapshots and self-test recipient isolation;
- production build and resolved-warning guards;
- raw + gzip JavaScript asset-size reporting;
- connector defaults OFF and provider-secret browser guards.

Latest validated exact-head checkpoint: `609c2af7274d10b2e130f21ea46899a10b001068`, `KCFC Redevelopment CI` run **#934** / id `34572845014`, conclusion **SUCCESS**. All **44** validation/build/security steps passed.

The validated staging isolation work establishes:

- explicit `VITE_FIREBASE_*` client configuration takes precedence over the committed compatibility file;
- explicit `FIREBASE_*` server configuration takes precedence over the committed compatibility file;
- `VITE_KCFC_RUNTIME_ENV=staging` fails closed unless explicit staging client Firebase configuration exists;
- `KCFC_RUNTIME_ENV=staging` fails closed unless explicit staging server Firebase configuration exists;
- client and server staging project IDs must differ from the committed production/default project ID;
- `npm run staging:preflight` requires matching client/server Firebase project and database targets;
- staging preflight requires explicit matching client/server VAPID public keys plus a server private key;
- staging preflight requires all external connector flags OFF and the Core-status staging executor OFF;
- the preflight itself is exercised in CI with synthetic isolated values and prints environment identifiers/status only, not secrets.

The onboarding regression previously fixed remains covered: a pending pre-registered member is not automatically marked email-verified merely because the pending profile exists. Bootstrap admin remains the explicit exception; otherwise migration respects Firebase Auth `emailVerified` or an already-true pending value.

Notification/Inbox navigation now also has permanent automated boundaries: notification records retain their history, Inbox links are constrained to authorized same-origin Portal destinations, and query-specific Schedule targets such as `/duties?view=mine` are preserved rather than collapsed to pathname-only navigation.

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

## Staging/runtime isolation position

The canonical staging runtime boundary is documented in `staging-firebase-isolation-contract-2026-09-11.md`.

Before any browser or physical-device QA begins against an actual staging deployment:

1. configure `VITE_KCFC_RUNTIME_ENV=staging` and `KCFC_RUNTIME_ENV=staging`;
2. configure explicit client/server Firebase values for the same isolated staging project/database;
3. ensure that project differs from the committed production/default project;
4. configure explicit staging VAPID keys;
5. keep all external connectors OFF;
6. keep the Core-status staging executor OFF unless a separately reviewed isolated test specifically requires it;
7. run `npm run staging:preflight` and retain the PASS output as staging evidence.

Automated proof of the preflight logic is complete. **Actual staging-environment preflight evidence is still required.**

## Staging/device QA package

The canonical device acceptance procedure is documented in `staging-device-qa-package-2026-09-11.md`, with evidence classes in `staging-readiness-evidence-map-2026-09-11.md`.

It uses this sequence:

1. automated CI/contracts;
2. actual isolated staging preflight;
3. browser responsive/mobile emulation;
4. Android Emulator where useful;
5. physical iPhone acceptance;
6. physical Android tablet acceptance;
7. optional supplemental KCFC member Android phone coverage.

Every notification test separately records:

- transport acceptance;
- actual OS presentation (banner/lock screen/sound/vibration);
- durable KCFC Inbox persistence; and
- notification tap/deep-link result.

The canonical `notification-acceptance-evidence-template-2026-09-11.md` requires those signals to be recorded independently before a case can be classified PASS; ambiguous outcomes remain INVESTIGATE.

No emulator result may be represented as physical-device evidence.

## Staging/device evidence still required

Automated contracts are not a substitute for empirical staging/device QA.

### Environment preflight

- actual staging project/database identifiers recorded;
- actual `npm run staging:preflight` PASS retained;
- client/server target parity confirmed;
- staging VAPID configuration confirmed;
- connectors OFF and Core executor OFF confirmed;
- synthetic test accounts/device registrations only.

### iPhone / iOS PWA

- Add to Home Screen;
- explicit notification permission;
- Web Push registration/repair;
- background and locked-device delivery;
- transport evidence separated from OS banner/sound/vibration behavior, including Focus/mute cases;
- push deep link, including query-specific Schedule targets;
- safe-area navigation and More sheet;
- Inbox list → detail and message-history retention;
- Schedule All ↔ My Ministry with Back/Forward restoration.

### Android / Chromium

- install flow;
- permission and registration;
- stale endpoint repair;
- background/locked notification and notification-channel behavior;
- push deep link, including query-specific Schedule targets;
- navigation, Schedule, Directory and Inbox regression;
- Inbox message-history retention.

### Multi-device

- physical iPhone + Android tablet for one synthetic member;
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
- Inbox split view and message-history behavior;
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

1. Actual isolated staging environment configured and passing `npm run staging:preflight`.
2. Representative browser/device QA, especially real iOS/Android notification behavior.
3. Supported parent remediation or continued bounded disposition for the remaining optional Storage-path `uuid` / `gaxios` findings.
4. Any further leadership decomposition only where it reduces routine LegacyAdmin use without weakening destructive-action isolation.
5. Provider/environment backup evidence plus exact deployment-artifact rollback evidence before a production request.
6. Explicit user approval for production merge/deploy and every separately gated production-sensitive action.

## Explicitly prohibited without approval

- merging/deploying to production;
- destructive schema/data migration or restore;
- bulk mutation of users;
- deleting/recreating Firebase Auth users;
- production Core-status execution;
- enabling the staging Core-status executor against any non-isolated environment;
- live external connector activation;
- mass outbound production test messaging;
- public website publishing cutover.
