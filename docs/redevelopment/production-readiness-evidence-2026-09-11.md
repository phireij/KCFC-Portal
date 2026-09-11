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
- persistent/server diagnostic privacy: member-identifying UID/email interpolation is prohibited across governed communication, legacy purge, delivery and subscription-prune diagnostics; operational status/counts remain;
- broadcast simulation diagnostic privacy: no-device fallback logs retain operational status only and do not persist authored broadcast title/body previews;
- broadcast push recipient integrity: announcement and custom-user FCM recipients are derived server-side from eligible user profiles/preferences; client-supplied device-token overrides are prohibited;
- public database diagnostics privacy: the legacy unauthenticated `/api/public/db-diagnostics` user/configuration enumeration route is removed; `/api/health` remains the non-secret runtime identity surface;
- liturgical creator/diff/publication plans;
- leadership broadcast planning/accessibility;
- member governance, pre-registration safety, pre-registration email-verification migration, Login email-verification migration safety and account-status classification;
- Core-status transition/mutation planning plus staging-executor isolation;
- Firebase Admin Storage non-use boundary;
- client/server Firebase runtime isolation for staging;
- non-secret `/api/health` runtime identity (runtime + Firebase project + Firestore database only);
- staging Web Push runtime fail-closed enforcement requiring explicit server VAPID public/private keys before any cache/Firestore/generated-key fallback, and re-throwing staging initialization errors before in-memory fallback key generation;
- staging application URL isolation: explicit HTTPS `APP_URL` is required and production Portal hostnames are rejected by both preflight and server startup;
- staging admin mass-email broadcasts are simulation-only even when SMTP credentials are present;
- staging public-inquiry notification and authorized inquiry-alert SMTP are suppressed/simulated so QA cannot notify the production KCFC mailbox;
- staging verification-email SMTP is suppressed even when SMTP credentials are inherited; the route returns the generated verification link for synthetic onboarding QA instead of sending mail;
- inquiry diagnostics do not persist submitted name/email/message content or raw request headers/body/query, do not log Firestore REST URLs containing API-key query parameters, and public inquiry responses do not return internal backend error detail;
- staging environment template parity, including explicit server-side VAPID public/private variables and browser/server public-key matching;
- explicit staging-only environment badge boundary, with default/production runtime rendering no staging badge;
- same-origin, Firebase-project-agnostic Web Push service-worker boundary;
- notification-linked Updates deep-link focus;
- Updates Published / All + drafts URL-history navigation while preserving focused announcement `id` state;
- notification-linked availability request/completion deep-link focus for both member and leader views;
- Inbox deep-link boundary, including same-origin route enforcement;
- Inbox message-history preservation for notification records;
- Inbox URL-backed filter/history navigation while preserving message deep-link state;
- Resource category URL/history navigation while keeping free-text search local;
- Community Directory member-type/ministry URL/history navigation while keeping free-text search local;
- browser push privacy logging guard preventing VAPID key, PushSubscription and FCM token values from being logged;
- canonical PWA theme/install metadata and shared modern iPhone/iPadOS platform detection across install + notification health;
- synthetic execution of the staging preflight contract;
- leadership accessibility and URL-backed Leadership workspace history navigation;
- mobile navigation contract;
- Schedule URL/history navigation and Home roster-publication privacy boundary;
- delivery diagnostics, current-device notification health, privacy-safe device QA snapshots and self-test recipient isolation;
- production build and resolved-warning guards;
- raw + gzip JavaScript asset-size reporting;
- connector defaults OFF and provider-secret browser guards.

Latest validated clean branch checkpoint: `26cdf8e51c25a115b1b395a1d460b51f9ae105cf`, `KCFC Redevelopment CI` run **#1375** / id `34592829693`, conclusion **SUCCESS**. All **57** validation/build/security steps passed.

The validated staging isolation work establishes:

- explicit `VITE_FIREBASE_*` client configuration takes precedence over the committed compatibility file;
- explicit `FIREBASE_*` server configuration takes precedence over the committed compatibility file;
- `VITE_KCFC_RUNTIME_ENV=staging` fails closed unless explicit staging client Firebase configuration exists;
- `KCFC_RUNTIME_ENV=staging` fails closed unless explicit staging server Firebase configuration exists;
- client and server staging project IDs must differ from the committed production/default project ID;
- `npm run staging:preflight` requires matching client/server Firebase project and database targets;
- staging preflight requires explicit matching client/server VAPID public keys plus a server private key;
- staging preflight requires all external connector flags OFF and the Core-status staging executor OFF;
- the app shell renders an unmistakable `Staging • Test environment` badge only when `VITE_KCFC_RUNTIME_ENV=staging` is explicitly set;
- the staging badge guard fails closed: default/production runtime has no staging badge;
- the preflight itself is exercised in CI with synthetic isolated values and prints environment identifiers/status only, not secrets;
- `/api/health` exposes only status/time plus runtime, Firebase project ID and Firestore database ID so operators can prove the deployed target without exposing API keys, VAPID material, tokens, credentials or app identifiers;
- when `KCFC_RUNTIME_ENV=staging`, the server refuses missing explicit server VAPID keys and also re-throws later Web Push initialization errors before any in-memory fallback key generation;
- staging preflight and server startup require an explicit HTTPS `APP_URL` whose hostname is not the production KCFC Portal, preventing generated staging links from silently targeting production;
- baseline staging routes for broadcast email, inquiry notification/alert email and custom verification email cannot enter real SMTP delivery while `KCFC_RUNTIME_ENV=staging`.

Email-verification migration is guarded in both authenticated bootstrap migration and the Login/Google profile creation path: a pending profile or newly created profile cannot be marked email-verified by an unconditional fallback. Bootstrap admin remains the explicit exception; otherwise migration respects Firebase Auth `emailVerified` or an already-true pending value.

Notification/navigation has permanent automated boundaries: notification records retain their history; Inbox links are constrained to authorized same-origin Portal destinations; query-specific Schedule targets such as `/duties?view=mine` are preserved rather than collapsed to pathname-only navigation; notification-linked Updates can focus/highlight the intended authorized update; availability notification links can focus/highlight the intended member request or expanded leader request; Inbox filters are URL-backed; Resource categories and Community Directory member/ministry filters are URL-backed; and authorized Updates scope can restore Published versus All + drafts through browser history while preserving a focused announcement `id`. Free-text search remains intentionally local on Resources, Community and Updates so typing does not create one browser-history entry per keystroke.

Every later code/dependency change still requires a fresh green run before it is treated as validated evidence. Documentation-only evidence refreshes do not substitute for code CI.

## Dependency position

Current runtime audit: **0 critical, 0 high, 2 moderate, 1 low**.

- `qs` moderate: **closed** through validated Express **5.2.1** migration, which resolves the relevant parent chain to patched `qs` 6.16.0.
- The Express migration was validated through TypeScript, all KCFC contracts, production build, actual server startup, `/api/health`, SPA fallback routing, and ordinary redevelopment CI after commit.
- `uuid` moderate and the affected older `gaxios` copy remain under Firebase Admin's optional `@google-cloud/storage` chain.
- KCFC source currently does not import `firebase-admin/storage`, directly import `@google-cloud/storage`, or call `getStorage()`.
- Permanent CI guards that Storage boundary so future activation cannot silently change the reachability assumption.
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

The canonical staging runtime boundary is documented in `staging-firebase-isolation-contract-2026-09-11.md`. The provider-neutral execution procedure is `staging-deployment-runbook-2026-09-11.md`; it prepares isolated staging evidence but does not authorize external resource creation or deployment.

Before any browser or physical-device QA begins against an actual staging deployment:

1. configure `VITE_KCFC_RUNTIME_ENV=staging` and `KCFC_RUNTIME_ENV=staging`;
2. configure explicit client/server Firebase values for the same isolated staging project/database;
3. ensure that project differs from the committed production/default project;
4. configure explicit staging VAPID keys;
5. keep all external connectors OFF;
6. keep the Core-status staging executor OFF unless a separately reviewed isolated test specifically requires it;
7. run `npm run staging:preflight` and retain the PASS output as staging evidence;
8. confirm the running app visibly shows `Staging • Test environment` before entering synthetic test data or registering test devices.

Automated proof of the preflight and staging-badge logic is complete. **Actual staging-environment preflight and visual evidence are still required.**

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

The browser/device matrix covers Schedule and Inbox history restoration, notification-linked Updates and availability focus, Resources category history, Community Directory type/ministry history, authorized Updates scope history, same-origin notification fallback, Inbox durability/message-history behavior, and visible staging-environment identification.

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
- visible `Staging • Test environment` badge confirmed on the running staging app;
- default/production runtime confirmed not to show that staging badge;
- synthetic test accounts/device registrations only.

### iPhone / iOS PWA

- Add to Home Screen;
- explicit notification permission;
- Web Push registration/repair;
- background and locked-device delivery;
- transport evidence separated from OS banner/sound/vibration behavior, including Focus/mute cases;
- push deep links, including query-specific Schedule, Updates, and availability-request targets;
- staging badge visible and non-obstructive in the installed staging PWA;
- safe-area navigation and More sheet;
- Inbox list → detail, filter-history and message-history retention;
- Schedule All ↔ My Ministry with Back/Forward restoration;
- Resource category, Community Directory type/ministry, and authorized Updates scope Back/Forward restoration.

### Android / Chromium

- install flow;
- permission and registration;
- stale endpoint repair;
- background/locked notification and notification-channel behavior;
- push deep links, including query-specific Schedule, Updates, and availability-request targets;
- staging badge visible and non-obstructive in the staging app;
- navigation, Schedule, Directory, Resources, Updates and Inbox regression;
- Inbox filter/history and message-history retention;
- Resource category, Community Directory type/ministry, and authorized Updates scope Back/Forward restoration.

### Multi-device

- physical iPhone + Android tablet for one synthetic member;
- one stale endpoint plus a valid endpoint;
- transport evidence correlated to durable KCFC Inbox without treating provider acceptance as proof of user-visible delivery.

### Desktop / leadership

- keyboard navigation;
- staging badge visibly distinguishes test from production;
- synthetic pre-registration;
- pending pre-registered member first authentication while email remains unverified, then post-verification transition without UID recreation;
- individual inquiry reply to staging/sink recipient only;
- governed role/ministry change preview + save;
- destructive controls absent from focused routine surfaces;
- accounting compatibility;
- Schedule/roster visibility rules;
- Inbox split view, filter history and message-history behavior;
- Resource category and Community Directory filter-history behavior;
- authorized Updates Published / All + drafts history behavior while preserving focused notification `id` state;
- notification-linked Updates focus;
- notification-linked availability completion focus/expanded leader request;
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

Provider/environment backup evidence and exact production deployment-artifact rollback evidence are still required before any production request. `deployment-artifact-rollback-evidence-template-2026-09-11.md` provides the blank evidence form without claiming that those production artifacts/backups already exist.

## Production-readiness blockers still open

1. Actual isolated staging environment configured and passing `npm run staging:preflight`, with visible staging-environment identification confirmed.
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
