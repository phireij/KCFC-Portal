# KCFC Portal — Core-status staging acceptance evidence — 2026-09-16

## Scope

This record captures the current isolated-staging checkpoint for the governed Regular Member ↔ Core Member workflow. It is an evidence/status record only. It does not authorize production deployment, production Core-status mutation, Draft PR merge, live connector activation, Firebase Auth recreation, or use of production member data.

## Repository / deployment checkpoint

- Repository: `phireij/KCFC-Portal`
- Branch: `redesign/mobile-first-v2`
- Application head exercised by the staging build: `99229433e9750862443a2a3a4e18f6d8c4b5d0f4`
- Production `main`: `653cc7229600fd7baff17a21a21f12d267b66d2b` — unchanged
- Draft PR #1: OPEN / DRAFT / NOT MERGED at the checkpoint
- Staging build: `build-2026-09-15-006` — current for the exercised application code
- Core-status staging executor: restored to `false` after controlled staging work
- `/api/health`: healthy at the accepted staging checkpoint

Repository documentation commits made after this evidence record may advance the branch head without changing the application bundle represented by `build-2026-09-15-006`. Any future staging deployment must use the then-current exact head and repeat only the checks materially affected by that deployment.

## Staging test identity state

The approved staging-only test profile labeled `Staging QA` is currently:

- Regular Member;
- no ministries assigned.

Do not alter real KCFC member records to extend this evidence. New synthetic identities or new staging member mutations require their applicable explicit approval.

## Core-status mutation / audit evidence

At this checkpoint:

- `leadership_audit` contains exactly **two** existing Core-status transition records from the controlled staging acceptance work;
- an attempted additional Regular → Core upgrade did **not** commit;
- the audit count remained exactly two after that non-committing attempt;
- no additional Core-status audit record should be inferred from the attempted upgrade;
- the executor has been returned to `false` and is not to remain enabled between controlled mutation tests.

This is evidence of the observed staging state, not a claim that all rejection/concurrency cases are complete.

## Accepted current posture

The following are accepted for this checkpoint and should not be repeated merely for caution unless a later deployment or regression affects them:

- current staging build identity `build-2026-09-15-006`;
- healthy `/api/health` result;
- isolated staging runtime already established by the preceding staging acceptance;
- Governed Member Editing / Membership Status workflow present in the exercised build;
- executor returned to disabled state after controlled mutation work;
- `Staging QA` restored to Regular Member with no ministries;
- exactly two existing Core-status audit records retained;
- the attempted additional upgrade did not commit.

## Remaining empirical work

### 1. Stale-plan concurrency rejection

Still required. The test must prove that a reviewed transition based on an old member revision is rejected without changing `users/{uid}`, `member_directory/{uid}`, or appending a `leadership_audit` event.

Keep `KCFC_CORE_STATUS_STAGING_EXECUTOR_ENABLED=false` before and after the tightly controlled test. Enable it only for the minimum staging-only execution window after exact staging identity is re-confirmed.

### 2. Core-only role + Cleaning downgrade cleanup

Still required. Using approved staging-only data, establish a Core Member with a Core-only organizational role and Cleaning assignment, then verify Core → Regular atomically:

- sets `isCoreMember=false`;
- preserves permanent `member`;
- removes the Core-only organizational role;
- removes Cleaning membership and any cleaning-status marker in scope;
- preserves otherwise-valid liturgical ministries if present;
- updates `member_directory/{uid}` consistently;
- appends exactly one audit record for the committed transition;
- preserves the Firebase Auth UID/account.

Do not manufacture real-member data or use production accounts to satisfy this test.

### 3. Physical-device PWA / Web Push

Still required separately on:

- physical iPhone;
- physical Android tablet.

Record transport acceptance, OS presentation, durable Inbox persistence, and tap/deep-link behavior separately. Do not expose Web Push private material, Firebase ID tokens, FCM tokens, or PushSubscription endpoints in evidence.

### 4. Toilet-cleaning assignment

Still deferred until approved staging data exists: a staging chore poll plus an eligible Core Cleaning member with toilet-cleaning authorization. Do not create or alter a real member merely to unblock this test.

## Executor operating rule

`KCFC_CORE_STATUS_STAGING_EXECUTOR_ENABLED` stays **false by default and between tests**. A future temporary `true` setting is permitted only for a separately authorized, tightly controlled, isolated-staging mutation test. Re-confirm staging project/runtime identity immediately before enabling it and restore it to `false` immediately after evidence is captured.

## Stop conditions

Stop without improvising if any of the following occurs:

- production/default Firebase identity or production member data appears;
- production `main` moves as part of this staging work;
- Draft PR #1 is merged or made non-draft unexpectedly;
- a secret/private key/token would need to be exposed;
- the executor cannot be proven limited to isolated staging;
- the planned empirical test would require an unapproved account/member mutation;
- audit count or target profile changes unexpectedly before a controlled test begins.

## Production boundary

No production action is authorized by this evidence record. Production `main`, production Firebase resources, production member records, public cutover, connector activation, mass messaging, and production Core-status mutation remain out of scope without separate explicit authorization.
