# KCFC Portal — Staging Readiness Checklist

Status: active redevelopment checklist. Passing this checklist does **not** authorize production deployment.

Executable scenario companion: `staging-test-matrix.md`.
Runtime-isolation companion: `staging-firebase-isolation-contract-2026-09-11.md`.
Deployment-runbook companion: `staging-deployment-runbook-2026-09-11.md`.

## Purpose

The KCFC Portal already has registered members and operational records. Redevelopment therefore uses a staged validation path that protects existing Firebase Auth identities and Firestore data before any production merge or deployment is requested.

## Gate A — Repository and build

- [ ] Redevelopment branch is current with intended `main` baseline.
- [ ] Draft PR contains only reviewed redevelopment changes.
- [x] TypeScript validation passes on the current validated redevelopment checkpoint.
- [x] Production build passes on the current validated redevelopment checkpoint.
- [x] Runtime dependency audit snapshot is recorded by CI.
- [x] Runtime dependency audit has no critical/high findings after validated compatible remediation.
- [x] Remaining moderate/low dependency findings have documented exposure/disposition notes.
- [x] Connector default/safety guards pass in CI.
- [x] Provider-secret browser-exposure guard passes in CI.
- [x] External communication connector flags default to `false`.
- [x] Client and server staging Firebase selection fail closed unless explicit isolated staging environment configuration is supplied.
- [x] Staging client/server Firebase project IDs must match each other and differ from the committed production/default project ID.
- [x] `npm run staging:preflight` is regression-tested in CI with a synthetic isolated staging environment.
- [x] Synthetic staging preflight requires explicit matching client/server VAPID public keys and a server private key rather than relying on inherited/local fallback material.
- [x] Staging preflight requires an explicit HTTPS `APP_URL` and rejects the production Portal hostname; server startup enforces the same boundary.
- [x] Admin mass-email broadcast uses simulation-only behavior in staging even when SMTP credentials are present.
- [x] Staging environment template documents the same browser/server VAPID contract, with the private key server-only and CI-guarded.
- [x] Synthetic staging preflight verifies external connectors OFF and Core-status staging executor OFF.
- [x] Staging app shell renders an explicit `Staging • Test environment` badge only for `VITE_KCFC_RUNTIME_ENV=staging`; default/production runtime renders no staging badge.
- [x] Notification-linked Updates, Inbox filters/history, member/leader availability-request deep links, Resources category history, Community filter history, Updates scope history, and Leadership workspace URL/history navigation are covered by permanent automated guards.
- [x] Login/Google profile creation preserves real email-verification state; forced-true verification fallbacks are prohibited by CI.
- [ ] Real staging environment passes `npm run staging:preflight` with the actual isolated staging configuration.
- [ ] Real staging `APP_URL` is HTTPS, uses the approved non-production hostname, and generated staging links never point to production.
- [ ] Running `/api/health` shows `runtime=staging` and the expected isolated Firebase project/database IDs; no secret fields are present.
- [ ] Staging server starts only with explicit `WEB_PUSH_VAPID_PUBLIC_KEY` + `WEB_PUSH_VAPID_PRIVATE_KEY`; missing keys fail closed before fallback initialization.
- [ ] Real staging build visibly shows the staging environment badge before test data/device registration begins.
- [ ] Legacy fallback pages remain available for critical workflows still being migrated.

Latest exact-head automated evidence before this checklist update: code head `879f7188f4ecf3ff1fb16409d0e10fc1350bb0ba`, `KCFC Redevelopment CI` run **#1186** / id `34582465638`, conclusion **SUCCESS**, with all **57** validation/build/security steps green. This includes staging environment-template parity, Login email-verification migration safety, Leadership workspace URL/history navigation, staging-only environment identification, Schedule URL/history navigation, full-URL same-origin notification tap handling, Updates focus/scope history, Inbox deep-link/history/filter navigation, Resource/Community history navigation, availability member/leader deep-link focus, Home explicit-roster publication privacy, staging isolation/preflight, and the existing governance/build guards.

## Gate B — Data compatibility

- [ ] Existing Firebase UID remains the member identity key in isolated compatibility QA.
- [ ] Existing users can sign in without account recreation.
- [ ] Existing verified / core / leadership states remain readable.
- [ ] Existing announcements remain visible according to current access rules.
- [ ] Existing poll responses remain readable.
- [ ] Existing chore duties remain readable.
- [ ] Existing liturgical assignments remain readable.
- [ ] Legacy assignment publication fallback is verified for historical records.
- [ ] New explicit-publication rosters stay private until published.
- [ ] Existing resources remain readable.
- [ ] Existing accounting transactions and categories remain readable.
- [ ] No destructive migration is required for the first redevelopment cutover.

## Gate C — Authentication and authorization

Test with representative **synthetic staging accounts** for:

- [ ] verified regular member,
- [ ] core/chore member,
- [ ] Lector & Commentator member,
- [ ] Usher member,
- [ ] Altar Server member,
- [ ] ministry leader,
- [ ] President / Administrator,
- [ ] Treasurer,
- [ ] Auditor,
- [ ] disabled account,
- [ ] pending/unverified account.

Verify:

- [ ] unauthorized users cannot access leadership/admin areas,
- [ ] unauthorized users cannot access accounting,
- [ ] ordinary members cannot see draft liturgical rosters,
- [ ] private directory contact fields remain hidden,
- [ ] role-based create/edit/delete actions remain constrained,
- [ ] pre-registered pending member remains email-unverified until Firebase Auth reports verified,
- [ ] pending profile migrates to the real Firebase UID without Auth user recreation.
- [ ] Login/Google profile creation does not set `isEmailVerified=true` unless bootstrap-admin exception, Firebase Auth verification, or a previously true pending verification state justifies it.

## Gate D — Mobile member experience

Validate on representative widths and real devices where possible:

- [ ] Staging builds visibly show `Staging • Test environment` without covering primary navigation or important content.
- [ ] Home is understandable without horizontal scrolling.
- [ ] Bottom navigation has exactly Home / Schedule / Community / Updates / More.
- [ ] More sheet is usable with safe-area insets.
- [ ] Home “My next assignment” opens `/duties?view=mine` directly.
- [ ] Explicit-publication assignments do not appear on Home before `rosterPublished=true`.
- [ ] Schedule can switch All Schedule ↔ My Ministry quickly.
- [ ] Direct `/duties?view=all|mine|manage` URLs open the matching Schedule subview.
- [ ] Browser/mobile Back and Forward restore the previous Schedule subview rather than resetting local-only state.
- [ ] Search/filter reset is obvious when no results are found.
- [ ] Upcoming and History views are readable.
- [ ] Published assignment highlighting makes the member's own role obvious.
- [ ] Community Directory search/filter is comfortable on phone.
- [ ] Community `type` + repeated `ministry` filters survive reload/share and browser/mobile Back/Forward; free-text search remains local.
- [ ] Updates cards/editor are readable on phone.
- [ ] Authorized Updates Published ↔ All + drafts scope survives reload/Back/Forward and does not reveal drafts to unauthorized members; any focused `?id=` is preserved.
- [ ] Inbox list → detail flow works without desktop-style squeezing.
- [ ] Inbox `?tab=` filters restore correctly on reload and Back/Forward while preserving selected-message state.
- [ ] Availability notification links focus/highlight the intended request; leader completion links open leader mode and expand/focus the intended request.
- [ ] Profile and notification setup remain usable at normal and large text sizes.
- [ ] Resources remain usable on mobile.
- [ ] Resource `?category=` selection survives reload/share and browser/mobile Back/Forward; free-text search remains local.
- [ ] Dark mode remains readable where supported.

## Gate E — Notification / PWA acceptance

Use the companion `staging-device-qa-package-2026-09-11.md` and canonical `notification-acceptance-evidence-template-2026-09-11.md`.

### Browser/emulation

- [ ] Staging badge is visible and non-obstructive at representative phone/tablet/desktop widths.
- [ ] Install/help guidance is correct for supported/unsupported browser states.
- [ ] Notification Health reflects permission/install/service-worker/current-endpoint state.
- [ ] Device registration/repair flow is understandable.
- [ ] Send Test remains clearly test-scoped and caller-bound.
- [ ] Test notification opens the intended Portal deep link where applicable, including query-specific routes such as `/duties?view=mine`.
- [ ] When `/duties?view=all` is already open, tapping a `/duties?view=mine` notification navigates the existing KCFC window to My Ministry rather than merely focusing the wrong query state.
- [ ] Update notifications focus/highlight the intended authorized update.
- [ ] Availability member/leader notifications open and focus the intended request, with leader completion links expanding the matching request.
- [ ] Malformed/cross-origin notification destinations fail closed to same-origin KCFC Inbox.
- [ ] Durable Inbox record remains independent of OS notification presentation.
- [ ] No automatic broadcast or inquiry-reply send occurs merely by opening a composer/page.

### Physical baseline

- [ ] Physical iPhone: foreground test recorded.
- [ ] Physical iPhone: background test recorded.
- [ ] Physical iPhone: locked-device test recorded.
- [ ] Physical iPhone: Focus/Silent conditions recorded where relevant.
- [ ] Physical Android tablet: foreground/background/locked baseline recorded.
- [ ] Optional supplemental Android phone evidence recorded when available.
- [ ] Staging badge remains visible/non-obstructive in installed staging PWA where applicable.
- [ ] For every notification case, record separately: transport acceptance, OS presentation, Inbox persistence, and tap/deep-link result.
- [ ] Missing sound alone is not treated as Web Push transport failure.
- [ ] Provider acceptance alone is not treated as proof the user saw/heard the notification.

## Gate F — Leadership / operational safety

- [ ] Focused Website Inquiry reply remains locked to the inquiry sender.
- [ ] Reply requires explicit send + confirmation; opening/editing sends nothing automatically.
- [ ] Focused Member Administration preserves Firebase UID for role/ministry edits.
- [ ] Routine focused admin surfaces do not expose destructive account deletion/credential purge/Core mutation controls.
- [ ] Actual destructive controls remain isolated in Advanced legacy tools.
- [ ] External connector flags remain OFF.
- [ ] Core-status staging executor is server-only, route-isolated and disabled by default.

## Gate G — Dependency/build disposition

Current production audit position at this checkpoint remains:

- 0 critical;
- 0 high;
- 2 moderate (`uuid`, older `gaxios` under Firebase Admin optional Storage path);
- 1 low (`esbuild` under development/tooling path).

- [ ] Firebase Admin Storage non-use boundary remains green.
- [ ] No unsupported forced leaf override has been introduced.
- [ ] Standard Vite chunk-size warning remains visible; warning threshold has not been raised to hide Firebase size.
- [ ] Any later supported parent-package remediation is separately validated before acceptance.

## Gate H — Backup / rollback evidence before production request

The branch contains a rollback plan, not executed production backup evidence.

Before requesting production deployment approval, record:

- [ ] Exact current production commit/deployment identifier.
- [ ] Timestamped Firestore export/backup evidence using the approved production procedure.
- [ ] Confirmation that Firebase Auth users will not be recreated/destructively migrated.
- [ ] Deployable prior application artifact/version or otherwise proven application rollback path.
- [ ] Connector flags confirmed OFF/returnable to OFF.
- [ ] Public website publishing/sync confirmed OFF unless separately approved.
- [ ] Post-deploy smoke-test owner/checklist.
- [ ] Explicit rollback criteria.

No production backup, restore, deploy or rollback execution is authorized by this checklist.

## Production request minimum

Do not request production approval until:

1. latest intended branch head has green redevelopment CI;
2. actual isolated staging `staging:preflight` is retained and staging badge is visibly confirmed;
3. browser/responsive regression evidence is recorded;
4. role/data/workflow staging regression is recorded;
5. physical iPhone + Android notification acceptance is recorded;
6. backup/rollback evidence is recorded;
7. remaining dependency findings have accepted/remediated disposition; and
8. the user explicitly grants production approval.

Even after these gates are satisfied, merge/deploy and other production-affecting actions remain separate explicit approval decisions.
