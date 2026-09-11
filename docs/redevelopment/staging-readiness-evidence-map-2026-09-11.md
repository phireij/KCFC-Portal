# KCFC Portal — Staging Readiness Evidence Map

**Date:** 2026-09-11  
**Branch:** `redesign/mobile-first-v2`  
**Purpose:** distinguish evidence already proven by CI/source review from evidence that still requires an isolated staging environment or physical devices.  
**Production status:** **NOT APPROVED**. This document does not authorize merge, deploy, migration, messaging, connector activation, or public cutover.

## Why this map exists

The staging readiness checklist intentionally contains both automated and empirical gates. A checked automated contract is not the same as a successful staging observation, and a provider-accepted push is not the same as an OS-visible notification.

This map prevents those categories from being conflated.

## Evidence classes

### A — Automated / source-contract evidence

These can be treated as repository evidence when the exact branch head has a green `KCFC Redevelopment CI` run:

- TypeScript validation.
- Production build success.
- Runtime dependency audit visibility.
- Communication policy and batch planning contracts.
- Liturgical creator, assignment-diff and publication-plan contracts.
- Leadership broadcast creator and accessibility contracts.
- Member-governance and safe pre-registration contracts.
- Member account-status classification.
- Core-status transition/mutation planning safeguards.
- Staging Core-status executor isolation and disabled-by-default guard.
- Firebase Admin Storage non-use boundary.
- Leadership accessibility contracts.
- Five-item mobile navigation contract and mobile target/safe-area guards.
- Delivery diagnostics contracts.
- Current-device notification-health logic.
- Privacy-safe device-QA snapshot contract.
- Authenticated self-test push recipient boundary.
- Production bundle build-warning guards and asset-size reporting.
- External connector defaults OFF.
- Browser-exposed provider-secret guard.

Latest fully validated evidence before this document update:

- head `66147350bf73bc21597173a078b1a0927fca9571`
- `KCFC Redevelopment CI` run #759
- conclusion: **success**

Any later code or CI change requires a fresh green run before that later head is considered validated.

## B — Source-review evidence

The following are supported by current implementation review but still require staging regression testing before production readiness:

- Existing Firebase UID is the intended member identity key.
- Safe member pre-registration does not create Firebase Auth users.
- Destructive admin controls remain isolated from focused routine administration.
- Notification self-test derives the destination from the authenticated caller UID and caller profile.
- KCFC Inbox remains the durable message record independent of OS notification presentation.
- External connectors are optional and feature-gated OFF by default.
- Production startup uses `node dist/server.cjs`; development tooling is not the production start path.
- No destructive schema migration is required by the current redevelopment design.

These statements are architecture/source facts, not proof that historical production records have already passed staging regression.

## C — Browser / responsive-emulation evidence still required

These should be completed before asking members to perform final physical-device acceptance:

- Mobile Home layout at representative iPhone/Android widths.
- Bottom navigation ordering, touch targets and More-sheet usability.
- Safe-area behavior.
- Schedule All Schedule ↔ My Ministry browsing.
- Search/filter reset and no-results recovery.
- Community Directory scanability and privacy presentation.
- Updates and Inbox list/detail behavior.
- Profile and notification setup at large text sizes.
- Resource Library mobile behavior.
- Dark-mode readability.
- Keyboard/focus behavior on desktop leadership surfaces.
- Browser-mode notification-health diagnostics.
- Install/help guidance where install cannot be emulated fully.

Browser emulation may prove layout, logic and many permission-flow states. It must not be recorded as physical iOS/Android Web Push evidence.

## D — Isolated staging evidence still required

Use synthetic staging accounts/data only.

### Authentication / authorization

Representative roles must verify:

- verified regular member;
- core/chore member;
- each liturgical ministry role used for assignment filtering;
- ministry leader;
- President / Administrator;
- Treasurer;
- Auditor;
- disabled account;
- pending/unverified account.

Confirm unauthorized leadership/accounting denial, draft-roster privacy, private-directory privacy and role-based action constraints.

### Historical data compatibility

Confirm representative existing-format records remain readable for:

- member profiles;
- announcements;
- poll responses;
- chore duties;
- liturgical assignments including legacy publication state;
- resources;
- accounting transactions/categories.

This must use isolated/copied representative data or another approved non-production method. Do not mutate production to perform compatibility QA.

### Workflow regression

Confirm end-to-end behavior for:

- multi-Mass availability request;
- member response/revision;
- assignment candidate filtering;
- explicit roster publication;
- published-assignment revision returning to review state;
- focused member pre-registration;
- governed role/ministry change preview/save;
- individual website-inquiry reply to a staging/sink recipient only;
- targeted self-test push to the authenticated staging tester.

## E — Physical-device evidence still required

Use the companion `staging-device-qa-package-2026-09-11.md`.

Representative set:

- one physical iPhone;
- one physical Android device (tablet acceptable for first pass);
- preferably one additional KCFC member Android phone.

Physical acceptance must separately record:

1. transport acceptance;
2. actual OS banner/lock-screen/sound/vibration presentation;
3. durable KCFC Inbox persistence;
4. notification tap/deep-link result.

Sound alone is not a transport verdict. Focus/Silent/OS notification settings must be recorded when relevant.

## F — Backup / rollback evidence still required before production request

The branch currently contains a rollback **plan**, not executed production backup evidence.

Before requesting production merge/deploy approval, record:

- exact current production commit/deployment identifier;
- timestamped Firestore export/backup evidence using the approved production procedure;
- confirmation that Firebase Auth accounts are not being recreated or destructively migrated;
- deployable prior application artifact/version or otherwise proven application rollback path;
- connector flags confirmed OFF/returnable to OFF;
- public website publishing/sync confirmed OFF unless separately approved;
- post-deploy smoke-test owner/checklist;
- criteria that trigger rollback.

No production backup, restore, deploy or rollback test is authorized by this document.

## G — Dependency disposition still open

Current runtime audit position remains:

- 0 critical;
- 0 high;
- 2 moderate;
- 1 low.

The remaining moderate `uuid` / older `gaxios` findings are within Firebase Admin's optional `@google-cloud/storage` path. KCFC does not currently activate that Storage path, and CI guards against silent activation. Continue preferring supported parent-package remediation over forced leaf overrides.

## Production request minimum

Do not request production approval until all of the following are true:

- latest intended branch head has green redevelopment CI;
- browser/responsive regression evidence is recorded;
- isolated staging role/data/workflow regression is recorded;
- representative physical-device notification acceptance is recorded;
- backup/rollback evidence is recorded;
- remaining dependency findings retain an explicit accepted disposition or are remediated;
- production approval is explicitly granted by the user.

Even after these conditions are satisfied, production merge/deployment and other approval-gated actions remain separate explicit decisions.
