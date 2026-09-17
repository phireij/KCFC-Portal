# KCFC Portal — Core-status staging acceptance evidence — 2026-09-16

## Scope

This record captures the isolated-staging evidence for the governed Regular Member ↔ Core Member workflow and the follow-up performed on 2026-09-17. It is an evidence/status record only. It does not authorize production deployment, production Core-status mutation, Draft PR merge, live connector activation, Firebase Auth recreation, or use of production member data.

## Repository / deployment checkpoint

- Repository: `phireij/KCFC-Portal`
- Branch: `redesign/mobile-first-v2`
- Application head exercised by the accepted staging build: `f83ab686e8e29943a767789817686403fc0faaf1`
- Staging build: `build-2026-09-16-000`
- Production `main`: `653cc7229600fd7baff17a21a21f12d267b66d2b` — unchanged
- Draft PR #1: must remain OPEN / DRAFT / NOT MERGED
- `/api/health` at the accepted staging checkpoint returned `status: "ok"`, runtime `staging`, Firebase project `kcfc-portal-staging`, and Firestore database `(default)`
- External connector flags remained off and the deployed UI displayed the `STAGING • TEST ENVIRONMENT` banner

Repository-only documentation/test-hardening commits after the exercised build may advance the branch head without changing the application bundle represented by `build-2026-09-16-000`. Any future staging deployment must use the then-current exact repository head and repeat only checks materially affected by that deployment.

## Historical checkpoint — completed Cleaning cleanup on 2026-09-16

At the completed Cleaning cleanup checkpoint:

- the approved staging-only profile `Staging QA` was returned to Regular Member with no ministries at that moment;
- `leadership_audit` contained exactly **four** Core-status transition records: two pre-existing records plus one controlled Regular → Core transition and one controlled Core → Regular transition performed on 2026-09-16;
- intermediate governed role/ministry edits did not append Core-status audit records;
- the final downgrade appended exactly one Core-status audit record;
- `users/{uid}` and `member_directory/{uid}` agreed on `isCoreMember=false`, permanent `member` preserved, no Cleaning role/ministry/status marker, and the existing Firebase Auth UID preserved;
- the first stale-plan browser attempt was invalidated by the live Firestore listener before an old request could be submitted, so no server-boundary stale-request result was claimed.

The statements above are a **historical checkpoint**, not the current post-follow-up audit/profile baseline.

## User authorization / executor history

During the active isolated-staging acceptance period, the user authorized temporary use of `KCFC_CORE_STATUS_STAGING_EXECUTOR_ENABLED=true` so the governed workflow could be exercised against only the approved staging identity/data.

That authorization never extended to production, real-member mutation merely for evidence, live connectors, secret exposure, Firebase Auth recreation, or public cutover.

### Current executor posture — 2026-09-17

The follow-up test window has been closed and the staging Core-status executor is now **disabled**:

- `KCFC_CORE_STATUS_STAGING_EXECUTOR_ENABLED=false` is the current safe resting posture;
- keep it disabled during repository-only review, CI hardening, PWA/device QA, and evidence reconciliation;
- do not re-enable it merely to repeat an inconclusive browser test;
- any future empirical stale-request attempt must begin with an explicit read-only re-baseline of staging identity, target profile, directory projection, and current Core-status audit count, and must end with the executor returned to `false`.

The route itself returns HTTP 503 while the executor is disabled, before Firebase Auth verification or stale-plan comparison. Therefore an empirical stale-review HTTP 409 cannot be obtained while the safe resting posture remains `false`.

## Automated contract hardening

Repository safeguards already cover:

- stale-plan rejection at the Core-status staging executor/transaction layer with the entire member snapshot unchanged and zero audit append;
- successful downgrade cleanup of Core-only organizational roles and chore ministries while preserving otherwise-valid liturgical ministry membership;
- dedicated Cleaning downgrade cleanup for `cleaning_leader`, `cleaning`, and `cleaning_toilet_ok`;
- rejection outside staging, with executor disabled, for unauthorized actors, and for actor mismatch, without member mutation or audit append.

### Route-level stale-review follow-up — 2026-09-17

A repository-only verifier has been added at `scripts/verify-core-status-route-stale-review.ts` and wired into `npm run lint` so CI executes it without contacting Firebase.

The verifier uses only synthetic in-memory Auth/Firestore stubs and asserts:

1. with the route executor disabled, `/api/admin/core-status/transition` returns HTTP 503 before Auth verification, user reads, or any transaction boundary;
2. with a synthetic staging-enabled route context and a deliberately stale `expectedUpdatedAt`, the route returns HTTP 409 with the sanitized stale-review message;
3. the stale-review route rejection occurs before any Firestore transaction can begin, so the Core-status member/directory/audit mutation boundary is not reached.

This automated route evidence strengthens the exact server HTTP contract. It does **not** convert the September 17 empirical browser attempt into a PASS; the live HTTP 409 result remains inconclusive until a readable browser/server response artifact is actually captured.

## Empirical result — Core-only role + Cleaning downgrade cleanup

The approved `Staging QA` identity was exercised only in isolated staging:

1. Regular → Core committed with the existing Firebase Auth UID preserved.
2. `Cleaning Leader` plus `Cleaning` were assigned through Governed Member Editing.
3. A concurrent governed edit changed the Core-only role to `Cleaning Sub-Leader` while preserving `Cleaning`.
4. A fresh Core → Regular transition preview explicitly listed `Cleaning Sub-Leader` and `Cleaning` for removal.
5. The committed downgrade returned the profile to Regular Member.

At that completed 2026-09-16 checkpoint, private/public profile projection and audit behavior matched the expected contract as recorded above.

## Follow-up server-boundary stale-plan attempt — 2026-09-17

The approved `Staging QA` identity was used exclusively. A concurrent liturgical-ministry revision was committed, and an older reviewed Core-status transition was paused at the authenticated `/api/admin/core-status/transition` XHR/fetch breakpoint and then resumed.

Observed outcome:

- the browser did **not** capture a readable HTTP response artifact;
- therefore the required HTTP 409 stale-review result is **INCONCLUSIVE** and must not be reported as passed;
- the governed cleanup transition restored `Staging QA` to Regular Member while preserving the valid `choir_a` liturgical ministry and the existing Firebase Auth UID;
- no production or external-connector action occurred;
- the controlled follow-up/cleanup produced additional Core-status audit evidence beyond the historical four-record checkpoint.

The exact **post-follow-up** Core-status `leadership_audit` count was not captured in the retained evidence. Do not infer a number from the earlier four-record checkpoint. Before any future Core-status mutation test, establish the current count read-only and use that observed count as the new baseline.

## Current accepted posture — 2026-09-17

The accepted resting state is:

- staging application remains the previously accepted `build-2026-09-16-000` at application head `f83ab686e8e29943a767789817686403fc0faaf1` unless a later deployment is explicitly recorded;
- isolated staging runtime/health evidence remains accepted from the preceding checkpoint;
- external connectors remain off;
- `Staging QA` is Regular Member after cleanup, with valid `choir_a` preserved according to the retained follow-up evidence;
- existing Firebase Auth identity/UID is preserved;
- staging Core-status executor is disabled;
- empirical stale-review HTTP 409 remains **INCONCLUSIVE**;
- the historical four-audit count must not be reused as the current baseline without a fresh read-only observation.

## Remaining safe follow-up work

### 1. Complete repository-only route verification

Let exact-head CI execute `scripts/verify-core-status-route-stale-review.ts`. Treat it as accepted automated evidence only if the exact-head push and pull-request checks pass.

### 2. Re-baseline evidence before any future live Core-status mutation

If another empirical stale-review attempt is later deemed necessary, first capture read-only non-secret evidence for:

- staging project/backend/runtime identity and `/api/health`;
- executor state before the test window;
- current `Staging QA` Core status, roles, ministries, and UID continuity;
- matching `member_directory/{uid}` projection;
- exact current Core-status `leadership_audit` count.

Do not expose Firebase ID tokens, Authorization headers, service-account material, FCM tokens, PushSubscription endpoints, or VAPID private keys.

### 3. Optional final empirical stale-review run

Do not perform this while the executor is disabled. If a final empirical run is later justified, use one tightly bounded isolated-staging window:

1. re-confirm isolation and the read-only baseline;
2. temporarily enable the staging executor;
3. use the normal authenticated UI and DevTools Network with Preserve Log plus the fetch/XHR breakpoint;
4. submit an actually stale reviewed request without inspecting or copying request authorization headers;
5. capture only non-secret evidence showing the HTTP status and sanitized response body;
6. verify no unintended Core-status profile/directory mutation and no Core-status audit append attributable to the rejected stale request;
7. restore the approved QA profile if any controlled setup edit was used;
8. immediately return the executor to `false`.

If the stale request unexpectedly succeeds or state/audit changes contrary to the plan, stop Core-status mutation testing and preserve non-secret evidence rather than improvising further writes.

### 4. Physical-device PWA / Web Push

Still required separately on:

- physical iPhone;
- physical Android tablet.

Record transport acceptance, OS presentation, durable Inbox persistence, and tap/deep-link behavior separately. Do not expose Web Push private material, Firebase ID tokens, FCM tokens, or PushSubscription endpoints in evidence.

### 5. Toilet-cleaning assignment

Still deferred until approved staging data exists: a staging chore poll plus an eligible Core Cleaning member with toilet-cleaning authorization. Do not create or alter a real member merely to unblock this test.

## Stop conditions

Stop without improvising if any of the following occurs:

- production/default Firebase identity or production member data appears;
- production `main` moves as part of this staging work;
- Draft PR #1 is merged or made non-draft unexpectedly;
- a secret/private key/token would need to be exposed;
- the executor cannot be proven limited to isolated staging;
- an empirical test would require an unapproved account/member mutation;
- target profile, directory projection, or audit baseline changes unexpectedly before a controlled test begins.

## Production boundary

No production action is authorized by this evidence record. Production `main`, production Firebase resources, production member records, public cutover, connector activation, mass messaging, and production Core-status mutation remain out of scope without separate explicit authorization.
