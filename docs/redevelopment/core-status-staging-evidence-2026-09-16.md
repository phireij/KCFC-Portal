# KCFC Portal — Core-status staging acceptance evidence — 2026-09-16

## Scope

This record captures the current isolated-staging checkpoint for the governed Regular Member ↔ Core Member workflow. It is an evidence/status record only. It does not authorize production deployment, production Core-status mutation, Draft PR merge, live connector activation, Firebase Auth recreation, or use of production member data.

## Repository / deployment checkpoint

- Repository: `phireij/KCFC-Portal`
- Branch: `redesign/mobile-first-v2`
- Application head exercised by the current staging build: `f83ab686e8e29943a767789817686403fc0faaf1`
- Production `main`: `653cc7229600fd7baff17a21a21f12d267b66d2b` — unchanged
- Draft PR #1: OPEN / DRAFT / NOT MERGED at the checkpoint
- Staging build: `build-2026-09-16-000` — current for the exercised application code
- Core-status staging executor: `true` in the isolated staging backend for the authorized active acceptance period
- `/api/health`: returned `status: "ok"`, runtime `staging`, Firebase project `kcfc-portal-staging`, and Firestore database `(default)`
- External connector flags remained off and the deployed UI displayed the `STAGING • TEST ENVIRONMENT` banner

Repository documentation/test-hardening commits made after this evidence record may advance the branch head without changing the application bundle represented by `build-2026-09-16-000`. Any future staging deployment must use the then-current exact head and repeat only the checks materially affected by that deployment.

## Staging test identity state

The approved staging-only test profile labeled `Staging QA` is currently:

- Regular Member;
- no ministries assigned.

Do not alter real KCFC member records to extend this evidence. New synthetic identities or new staging member mutations require their applicable explicit approval.

## Core-status mutation / audit evidence

At the completed Cleaning cleanup checkpoint:

- `leadership_audit` contains exactly **four** Core-status transition records: the two pre-existing records plus one controlled Regular → Core transition and one controlled Core → Regular transition performed on 2026-09-16;
- the intermediate governed role/ministry edits did not append Core-status audit records;
- the final downgrade appended exactly one Core-status audit record;
- no stale-plan rejection audit record exists because the live UI invalidated and cleared the reviewed plan as soon as the concurrent member revision arrived, before the old request could be submitted.

This is evidence of the observed staging state, not a claim that the server-side stale-request rejection has been empirically completed.

## User authorization update — 2026-09-16

The user explicitly clarified that the Core-status staging executor should not be kept disabled throughout the testing period and instructed that it be enabled so the workflow can be tested properly.

For the active isolated-staging acceptance period, this authorizes:

- `KCFC_CORE_STATUS_STAGING_EXECUTOR_ENABLED=true` on the isolated staging backend;
- keeping that flag enabled while the approved Core-status acceptance tests are carried out;
- use of the already-approved staging-only test identity/data for those tests;
- no production mutation, no real-member mutation merely for evidence, no live connectors, and no secret exposure.

The flag should return to `false` when the Core-status acceptance/testing period is complete or immediately if isolation/safety checks fail. This supersedes the earlier evidence wording that required the executor to be disabled between each controlled staging test.

## Automated contract hardening after the empirical checkpoint

Repository test coverage was strengthened after the exercised staging build without changing the accepted staging data:

- stale-plan rejection now asserts the entire member snapshot remains byte-for-byte equivalent at the test-model level, not only `isCoreMember`;
- stale-plan rejection continues to require zero audit append;
- the successful downgrade contract continues to verify removal of Core-only organizational roles while preserving otherwise-valid liturgical ministry membership;
- a dedicated Cleaning downgrade case now verifies removal of `cleaning_leader`, `cleaning`, and `cleaning_toilet_ok`, preservation of permanent `member`, and exactly one audit append;
- production-runtime, disabled-executor, unauthorized-actor, and actor-mismatch rejections continue to assert no member mutation and zero audit append.

These are automated repository safeguards only. They do **not** replace the remaining empirical Firestore/directory/audit acceptance tests listed below.

## Empirical result — Core-only role + Cleaning downgrade cleanup

The approved `Staging QA` identity was exercised only in isolated staging:

1. Regular → Core committed with the existing Firebase Auth UID preserved.
2. `Cleaning Leader` plus `Cleaning` were assigned through Governed Member Editing.
3. A concurrent governed edit changed the Core-only role to `Cleaning Sub-Leader` while preserving `Cleaning`.
4. A fresh Core → Regular transition preview explicitly listed `Cleaning Sub-Leader` and `Cleaning` for removal.
5. The committed downgrade returned the profile to Regular Member.

Post-transition observations:

- `users/92wkikALiZYldr8wcCcr7oicfPb2`: `isCoreMember=false`, roles contain only permanent `member`, and ministries are empty;
- `member_directory/92wkikALiZYldr8wcCcr7oicfPb2`: `isCoreMember=false`, roles contain only `member`, ministries are empty, and the UID is unchanged;
- no Cleaning role, Cleaning ministry, or cleaning-status marker is present;
- the application reports `Staging QA` as `REGULAR MEMBER · 0 MINISTRIES` and states that the existing account identity was preserved and the transition was audited;
- `leadership_audit` contains exactly four Core-status records, with exactly one new record for the final downgrade.

No liturgical ministry was present in the approved pre-test profile, so liturgical preservation was not empirically exercised in this run; it remains covered by the repository contract tests.

## Accepted current posture

The following are accepted for this checkpoint and should not be repeated merely for caution unless a later deployment or regression affects them:

- current staging build identity `build-2026-09-16-000` at `f83ab686e8e29943a767789817686403fc0faaf1`;
- healthy `/api/health` result;
- isolated staging runtime already established by the preceding staging acceptance;
- Governed Member Editing / Membership Status workflow present in the exercised build;
- `Staging QA` restored to Regular Member with no ministries;
- exactly four Core-status audit records after the controlled upgrade and downgrade;
- Core-only role and Cleaning downgrade cleanup empirically passed for the approved staging identity;
- executor activation remains authorized and enabled while the remaining stale-request acceptance work is incomplete.

## Remaining empirical work

### 1. Stale-plan concurrency rejection

Still required. The test must prove that a reviewed transition based on an old member revision is rejected without changing `users/{uid}`, `member_directory/{uid}`, or appending a `leadership_audit` event.

The executor may remain enabled for this active isolated-staging acceptance period after exact staging identity is re-confirmed.

### 2. Core-only role + Cleaning downgrade cleanup

Empirically passed for the approved staging identity, subject to the explicit note above that no liturgical ministry was present to exercise preservation in this run.

### 3. Physical-device PWA / Web Push

Still required separately on:

- physical iPhone;
- physical Android tablet.

Record transport acceptance, OS presentation, durable Inbox persistence, and tap/deep-link behavior separately. Do not expose Web Push private material, Firebase ID tokens, FCM tokens, or PushSubscription endpoints in evidence.

### 4. Toilet-cleaning assignment

Still deferred until approved staging data exists: a staging chore poll plus an eligible Core Cleaning member with toilet-cleaning authorization. Do not create or alter a real member merely to unblock this test.

## Executor operating rule during the active testing period

`KCFC_CORE_STATUS_STAGING_EXECUTOR_ENABLED=true` is authorized for the current isolated-staging acceptance period.

Before empirical mutation testing, re-confirm staging project/backend/runtime identity and the expected pre-test target/audit state. Keep production and external connectors unchanged. Return the flag to `false` once Core-status acceptance is complete or immediately if any stop condition occurs.

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
