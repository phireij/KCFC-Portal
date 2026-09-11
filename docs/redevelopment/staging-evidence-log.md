# KCFC Portal — Staging Evidence Log

Date opened: 2026-09-10
Last refreshed: 2026-09-11
Branch: `redesign/mobile-first-v2`

This log records evidence gathered during redevelopment. It does **not** authorize production deployment and does not replace the staging-readiness checklist or empirical device acceptance.

## Evidence E-001 — Repository boundary

- Production branch: `main`
- Verified production SHA: `653cc7229600fd7baff17a21a21f12d267b66d2b`
- Redevelopment branch: `redesign/mobile-first-v2`
- Draft PR: #1
- Production `main` remains the redevelopment baseline.
- No production merge or deployment occurred during this evidence collection.

Result: **PASS — production boundary preserved.**

## Evidence E-002 — Current redevelopment CI

GitHub Actions workflow: `KCFC Redevelopment CI`

Latest exact-head run before this documentation refresh:

- validated head: `98c1901cabc6414c7b9e017570dbd27c68d4c6ec`
- run: **#774 / id 34562112607**
- conclusion: **SUCCESS**

The current workflow validates dependency installation/audit visibility, TypeScript, communication and liturgical contracts, leadership/member governance, pre-registration safety and email-verification migration, Core-status safeguards, Firebase Admin Storage non-use, accessibility/mobile navigation, delivery/notification diagnostics, privacy-safe device QA snapshots, caller-bound self-test push isolation, production build/bundle reporting, connector defaults OFF and provider-secret browser guards.

Result: **PASS — exact intended code head validated.**

Documentation-only commits after this head do not replace code CI evidence; any later code/dependency change requires a fresh green exact-head run.

## Evidence E-003 — Communication routing invariants

Executable synthetic checks cover:

- Inbox remains present for normal communication.
- Inbox remains present when routine alerts are muted.
- Composer can disable PWA without removing the durable Inbox record.
- Assignment routing uses important urgency.
- External providers remain excluded while connector gates are disabled.
- Notification records retain routing metadata and de-duplicate delivery destinations.
- Disabled users are excluded from new operational audience delivery.
- Leadership audience requires a leadership role.

Result: **PASS in CI.**

Important: positive connector-routing tests validate pure planning logic only. Actual external connector environment flags remain OFF and no live external message has been sent.

## Evidence E-004 — Notification safety and diagnostics

Permanent automated contracts now cover:

- current-device notification-health logic;
- privacy-safe device QA snapshot generation;
- authenticated self-test push recipient isolation;
- self-test recipient derivation from authenticated caller UID/profile only;
- prohibition on caller-selected arbitrary recipients/member enumeration;
- stale/invalid registration diagnostics;
- KCFC Inbox persistence as durable truth independent of OS presentation.

Result: **PASS in CI.**

Limitation: CI/browser evidence cannot prove physical OS banner, lock-screen, sound, vibration, Focus/Silent behavior, or actual PWA background delivery. Those remain physical-device acceptance items.

## Evidence E-005 — Safe member pre-registration/onboarding

Focused pre-registration creates an unverified pending Firestore profile and does not create/recreate Firebase Auth users or grant leadership access.

The migration path from a pending pre-registration to the real Firebase UID is permanently regression-tested so that:

- the real Firebase UID is preserved as identity;
- pending roles/ministries can migrate without UID recreation;
- existence of a pending profile alone does **not** mark the member email verified;
- Firebase Auth `emailVerified` is respected;
- an already-true pending verification state is preserved;
- bootstrap-admin behavior remains an explicit exception rather than a general promotion path.

Result: **PASS in CI #774.**

Empirical staging still must test first authentication while unverified and the later verified transition using a synthetic member.

## Evidence E-006 — Dependency/security position

Current documented runtime audit position:

- **0 critical**
- **0 high**
- **2 moderate**
- **1 low**

`qs` is closed through the validated Express 5.2.1 migration. Remaining moderate `uuid` / older `gaxios` findings are under Firebase Admin's optional `@google-cloud/storage` path. KCFC does not activate that Storage path, and permanent CI prevents silent activation by forbidding the relevant imports/calls.

Result: **BOUNDED / OPEN FOR SUPPORTED PARENT REMEDIATION.** No forced leaf override or audit suppression is accepted.

## Evidence E-007 — Leadership destructive-action isolation

Focused leadership workspaces cover routine Overview, Website Inquiries, Member Communications and Member Administration. Individual inquiry replies require explicit confirmation and are locked to the inquiry sender. Roles & Ministries provides a pre-save change summary and preserves Firebase UID.

Actual Core-status mutation, account disablement, profile/member removal, credential purge and other destructive compatibility controls remain isolated in Advanced Legacy Tools.

Result: **IMPLEMENTED + AUTOMATED CONTRACT COVERAGE.**

No destructive control is considered staging-approved until representative authorization/denial tests are completed with synthetic roles.

## Evidence E-008 — Bundle/build position

- Route pages are lazy-loaded.
- Firebase, Recharts/D3 and Motion have explicit vendor boundaries.
- Normal Vite chunk-size warnings remain enabled.
- CI records raw + gzip JavaScript asset sizes and total JS weight.
- Production starts with `node dist/server.cjs`.

Earlier measured route-splitting improvement remains approximately 2.31 MB / 603.5 KB gzip to 1.32 MB / 357.1 KB gzip for the main client chunk before later vendor separation. No unverified post-vendor-split figure is claimed here.

Result: **PASS — build/reporting controls present.**

## Evidence E-009 — Specification/documentation QA

Specification v4 remains the working redevelopment baseline for Communications + Schedule + Staging Safeguards. The staging device QA package, staging readiness evidence map, production readiness register, dependency disposition and backup/rollback plan are maintained alongside implementation.

Result: **PASS — readiness documentation present.**

## Empirical evidence still required before production request

Use synthetic/isolated staging data only. Still required:

- browser responsive/mobile regression at representative iPhone/Android widths;
- synthetic role sign-in and authorization/denial matrix;
- representative historical Firestore compatibility in an isolated environment;
- liturgical availability → matrix → assignment → publication end-to-end staging flow;
- pre-registration first sign-in while unverified → later verified transition without UID recreation;
- Resources and Accounting regression against non-production sample data;
- individual inquiry reply only to a staging/sink recipient;
- targeted self-test push only to the authenticated staging tester;
- physical iPhone PWA/Web Push acceptance;
- physical Android tablet acceptance (acceptable as first Android physical baseline);
- preferably an additional member Android phone for broader Android coverage;
- multi-device registration/stale-endpoint behavior;
- backup/rollback proof immediately before any production approval request.

For physical notification acceptance, separately record transport acceptance, OS presentation, durable Inbox persistence and notification-tap/deep-link result. Browser/emulator results must never be labeled as physical-device evidence.

## Production authority

This evidence log grants **no** authority to:

- merge/deploy production;
- mutate production users in bulk;
- delete/recreate Firebase Auth users;
- run destructive migration/restore;
- execute production Core-status changes;
- enable a staging executor against a non-isolated environment;
- send production mass notifications;
- enable live LINE/Telegram/WhatsApp/Viber connectors;
- switch on public website publishing/cutover.

Those remain explicit approval gates.
