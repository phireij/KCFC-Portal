# KCFC Portal — Staging Readiness Checklist

Status: active redevelopment checklist. Passing this checklist does **not** authorize production deployment.

Executable scenario companion: `staging-test-matrix.md`.

## Purpose

The KCFC Portal already has registered members and operational records. Redevelopment therefore uses a staged validation path that protects existing Firebase Auth identities and Firestore data before any production merge or deployment is requested.

## Gate A — Repository and build

- [ ] Redevelopment branch is current with intended `main` baseline.
- [ ] Draft PR contains only reviewed redevelopment changes.
- [ ] TypeScript validation passes.
- [ ] Production build passes.
- [ ] Connector default/safety guards pass.
- [ ] No secret, token or production credential is committed.
- [ ] External communication connector flags default to `false`.
- [ ] Legacy fallback pages remain available for critical workflows still being migrated.

## Gate B — Data compatibility

- [ ] Existing Firebase UID remains the member identity key.
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
- [ ] role-based create/edit/delete actions remain constrained.

## Gate D — Mobile member experience

Validate on representative widths and real devices where possible:

- [ ] Home is understandable without horizontal scrolling.
- [ ] Bottom navigation has exactly Home / Schedule / Community / Updates / More.
- [ ] More sheet is usable with safe-area insets.
- [ ] Schedule can switch All Schedule ↔ My Ministry quickly.
- [ ] Search/filter reset is obvious when no results are found.
- [ ] Upcoming and History views are readable.
- [ ] Published assignment highlighting makes the member's own role obvious.
- [ ] Community Directory search/filter is comfortable on phone.
- [ ] Updates cards/editor are readable on phone.
- [ ] Inbox list → detail flow works without desktop-style squeezing.
- [ ] Profile preferences remain usable with large text.
- [ ] Resource Library cards and add-resource sheet work on phone.
- [ ] Install KCFC panel uses the navy/royal-blue system rather than legacy olive styling.

## Gate E — Liturgical availability and assignment workflow

- [ ] Authorized leader can create a multi-Mass availability request.
- [ ] Eligible ministry members receive the request in KCFC Inbox.
- [ ] Member can select all available Masses.
- [ ] Member can save and revise while request is open.
- [ ] Member can explicitly indicate unavailable for all listed dates.
- [ ] Leader sees response progress.
- [ ] Availability matrix accurately reflects latest member responses.
- [ ] Assignment candidates are constrained by ministry + submitted availability.
- [ ] Duplicate role assignment checks work.
- [ ] Closing/reopening availability behaves correctly.
- [ ] Final roster is invisible before explicit publication for new cycles.
- [ ] Publishing creates assigned-member Inbox notifications.
- [ ] Editing a published assignment unpublishes the roster until reviewed again.
- [ ] My Ministry deep link opens the correct personal schedule view.

## Gate F — Notification / PWA reliability

### iOS/iPadOS

- [ ] Safari Share → Add to Home Screen guidance is clear.
- [ ] Notification enable action is unavailable before required install state.
- [ ] Permission request occurs from explicit member interaction.
- [ ] Device registration succeeds.
- [ ] Notification Health shows installed state, permission and endpoint count correctly.
- [ ] Test notification can be sent.
- [ ] Test notification opens the intended Portal deep link where applicable.

### Android / Chromium

- [ ] Native install prompt works where supported.
- [ ] Manual browser-menu install fallback is understandable.
- [ ] Notification permission can be enabled.
- [ ] Device registration succeeds.
- [ ] Test notification can be sent.
- [ ] Repair / refresh registration works after a stale registration scenario.

### General

- [ ] Installation and notification-registration responsibilities are separated (install panel does not duplicate push registration logic).
- [ ] Multiple devices per member are supported.
- [ ] Expired/invalid endpoints do not break message creation.
- [ ] Inbox message remains available even when push fails.
- [ ] Browser/OS sound and vibration are treated as best-effort rather than guaranteed.

## Gate G — Communications

- [ ] KCFC Inbox is created first for operational messages.
- [ ] PWA is treated as primary alert channel.
- [ ] Email partner preference is respected where email routing is used.
- [ ] Announcement / availability / assignment notification preference is respected.
- [ ] Urgent-notice policy is documented and not abused for routine posts.
- [ ] Routing metadata remains backward-compatible with old notification records.
- [ ] Canonical source/provider types compile and include duty/source semantics.
- [ ] LINE / Telegram / WhatsApp / Viber are visibly optional.
- [ ] External provider toggles cannot send unless secure account link exists.
- [ ] Browser UI feature flags expose no provider credential.
- [ ] All external connector feature flags remain disabled before approval.

## Gate H — Resources

- [ ] Existing resource links open correctly.
- [ ] Search works by title/description/ministry/type.
- [ ] Ministry filters work.
- [ ] Authorized leader can add a resource.
- [ ] Unauthorized member cannot add/delete resources.
- [ ] Delete confirmation works.
- [ ] No resource becomes public automatically.

## Gate I — Accounting

The first redevelopment cutover preserves the existing accounting engine.

- [ ] Existing ledger loads.
- [ ] Income/expense totals match production baseline export/sample.
- [ ] Existing categories load.
- [ ] Treasurer can create/edit transactions.
- [ ] Auditor/President approval logic remains correct.
- [ ] Receipt handling remains unchanged.
- [ ] CSV export works.
- [ ] Unauthorized user cannot access Accounting.
- [ ] No test transaction is written to production.

## Gate J — Admin

The first redevelopment cutover preserves the existing admin engine.

- [ ] Pending member approvals load.
- [ ] Existing member roles/ministries load.
- [ ] Leadership ordering/permissions are unchanged.
- [ ] Existing broadcasts remain available only to authorized roles.
- [ ] Website inquiries continue to load.
- [ ] Admin settings remain available.
- [ ] No production user is deleted or disabled during QA.
- [ ] No mass production broadcast is sent during QA.

## Gate K — Accessibility and resilience

- [ ] Keyboard focus is visible.
- [ ] Core actions meet minimum touch target guidance.
- [ ] Body text remains readable at normal size.
- [ ] Larger configured reading sizes do not make primary navigation unusable.
- [ ] Form labels remain associated and understandable.
- [ ] Empty states explain recovery actions.
- [ ] Loading and error states do not strand users.
- [ ] Dark mode remains legible.
- [ ] WCAG AA contrast is targeted for essential content/actions.

## Gate L — Backup and rollback before production request

Before any production merge/deploy approval is requested:

- [ ] Export/backup current Firestore data.
- [ ] Record current production commit / deployment identifier.
- [ ] Confirm Firebase Auth users are not part of a destructive migration.
- [ ] Confirm rollback path to prior production build.
- [ ] Confirm connector feature flags can remain/return OFF.
- [ ] Confirm public website sync remains OFF unless separately approved.
- [ ] Prepare smoke-test owner/checklist for immediately after deployment.

## Explicit production approval required

Even when every checkbox above is green, the following remain approval-gated:

- merge to production `main` when it triggers/feeds production release,
- production deployment/cutover,
- destructive migration,
- bulk user mutation,
- live external connector activation,
- mass outbound messaging test,
- public website publishing cutover.
