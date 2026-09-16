# KCFC Portal — Core-status staging activation handoff — 2026-09-15

## Source of truth

- Repository: `phireij/KCFC-Portal`
- Branch: `redesign/mobile-first-v2`
- Application head exercised by the current staging build: `99229433e9750862443a2a3a4e18f6d8c4b5d0f4`
- Draft PR: #1 — must remain OPEN / DRAFT / NOT MERGED
- Production `main`: `653cc7229600fd7baff17a21a21f12d267b66d2b` — must remain untouched
- Current exercised staging build: `build-2026-09-15-006`

This handoff is for isolated Firebase/App Hosting staging only. It does not authorize production deployment, production Core-status changes, production data mutation, PR merge, connector activation, or Firebase Auth account recreation.

## Current accepted staging checkpoint — updated 2026-09-16

The initial deployment/activation sequence described below has been materially exercised. The current accepted posture is:

- staging build `build-2026-09-15-006` is current for application head `99229433e9750862443a2a3a4e18f6d8c4b5d0f4`;
- `/api/health` is healthy;
- the governed Membership Status workflow is present in staging;
- the Core-status staging executor has been restored to `false`;
- the approved staging-only test profile `Staging QA` is a Regular Member with no ministries;
- `leadership_audit` contains exactly two existing Core-status transition records from the controlled staging work;
- an attempted additional Regular → Core upgrade did not commit, and the audit count remained exactly two;
- production `main` remains unchanged and Draft PR #1 remains open/draft/unmerged at the accepted checkpoint.

The detailed evidence/status record is `docs/redevelopment/core-status-staging-evidence-2026-09-16.md`.

Do not repeat already accepted staging checks merely for caution. Re-run only checks materially affected by a later deployment, a temporarily enabled executor test, or evidence of regression.

## Repository state ready for staging

The Governed Member Editing workspace contains a separate Membership Status control for Regular Member ↔ Core Member transitions.

The server-side transition route:

- accepts authenticated requests only;
- derives actor identity from a verified Firebase ID token;
- authorizes active Admin/President actors only;
- restricts the target to an active verified non-Admin member;
- rebuilds the transition plan from canonical Firestore data;
- rejects stale `updatedAt` preconditions;
- hard-blocks any runtime other than `staging`;
- requires explicit `KCFC_CORE_STATUS_STAGING_EXECUTOR_ENABLED=true`;
- atomically updates `users/{uid}` and `member_directory/{uid}` and appends `leadership_audit` evidence;
- preserves the Firebase Auth account and UID;
- returns sanitized generic errors for unexpected provider/runtime failures.

Regular → Core expands eligibility only and grants no role or ministry automatically.

Core → Regular preserves the permanent Member role and otherwise-valid liturgical ministries, while removing Core-only organizational roles, Kitchen/Cleaning membership, and cleaning-status markers according to the governed transition plan.

## Important Web Push correction for current staging preflight

Use the repository's current `scripts/staging-preflight.mjs` as the authoritative contract.

The Firebase FCM browser VAPID public key and the native Web Push server VAPID public key must be **distinct**. Do not configure them as the same key.

Required shape:

```text
VITE_FCM_VAPID_KEY=<Firebase/FCM browser public VAPID key>
WEB_PUSH_VAPID_PUBLIC_KEY=<dedicated native Web Push staging public key>
WEB_PUSH_VAPID_PRIVATE_KEY=<matching dedicated native Web Push staging private key, server-only>
```

Never expose or copy the private key into screenshots, logs, PR text, browser code, or chat.

## Completed staging activation sequence

The safe sequence for the current build was:

1. verify the live branch head and Draft PR #1;
2. confirm the existing isolated Firebase project/App Hosting staging resources;
3. deploy the exact branch head with external connectors disabled;
4. first deploy with `KCFC_CORE_STATUS_STAGING_EXECUTOR_ENABLED=false`;
5. verify the visible staging marker and healthy `/api/health` identity;
6. verify Governed Member Editing exposes the Membership Status workflow;
7. temporarily enable the executor only in isolated staging for controlled acceptance;
8. exercise approved staging-only mutation behavior;
9. inspect audit/profile state without exposing credentials or secrets;
10. restore `KCFC_CORE_STATUS_STAGING_EXECUTOR_ENABLED=false` after the controlled test window.

That executor-off posture is now the required resting state.

## Accepted evidence from controlled staging work

At the current checkpoint:

- `Staging QA` is back to Regular Member with no ministries;
- exactly two Core-status `leadership_audit` records exist;
- an attempted additional upgrade did not commit;
- no third audit event was created by that attempt;
- the executor is disabled again.

This accepted state must be treated as the baseline for remaining tests. Do not alter it casually between tests.

## Remaining empirical work

### Stale-plan concurrency rejection

Still required. Prove that a reviewed transition based on an outdated `updatedAt`/member snapshot is rejected without:

- changing `users/{uid}`;
- changing `member_directory/{uid}`;
- appending a `leadership_audit` event.

The executor must stay false before and after the test and be enabled only for the minimum authorized isolated-staging test window.

### Core-only role + Cleaning → Regular cleanup

Still required with approved staging-only data. Establish a Core Member that has both:

- a Core-only organizational role; and
- Cleaning membership (plus any applicable cleaning-status marker under test).

Then apply Core → Regular and verify atomically:

- `isCoreMember=false`;
- permanent `member` remains;
- Core-only organizational role is removed;
- Cleaning and applicable cleaning-status marker are removed;
- otherwise-valid liturgical ministries are preserved if present;
- `member_directory/{uid}` reflects the final state consistently;
- exactly one new audit event is appended for the committed transition;
- Firebase Auth UID/account is unchanged.

Do not use a real KCFC member or create/alter unapproved staging identity data merely to obtain this evidence.

### Physical iPhone / Android tablet PWA and Web Push QA

Still required separately. For each physical device record transport acceptance, OS presentation, durable Inbox persistence, and tap/deep-link behavior. Do not capture private VAPID material, Firebase ID tokens, FCM tokens, PushSubscription endpoints, passwords, or unrelated member data.

### Toilet-cleaning assignment

Still deferred until approved eligible staging data exists: a staging chore poll and an eligible Core Cleaning member with toilet-cleaning authorization. Do not create or mutate real-member data to unblock this test.

## Executor operating rule going forward

`KCFC_CORE_STATUS_STAGING_EXECUTOR_ENABLED=false` is the resting state and must remain so except during a separately authorized, tightly controlled staging-only mutation test.

Before any temporary enablement:

1. re-confirm the exact isolated staging project/runtime/backend;
2. confirm production `main` and Draft PR boundaries remain unchanged;
3. confirm the intended staging target and expected audit count/profile state;
4. enable the flag only for the minimum required test window;
5. capture non-secret PASS/FAIL evidence;
6. restore the flag to `false` immediately afterward;
7. verify the target profile and audit count match the expected final state.

## Acceptance expectations

### Regular → Core

- `isCoreMember` becomes true.
- Existing roles and ministries remain unchanged.
- No Core-only role/ministry is granted automatically.
- `member_directory/{uid}.isCoreMember` becomes true in the same transaction boundary.
- Exactly one `leadership_audit` record is appended.
- Auth UID/account remains unchanged.

### Core → Regular

- `isCoreMember` becomes false.
- Non-Member organizational roles are removed according to the governed plan.
- Kitchen/Cleaning and cleaning-status assignments are removed.
- Otherwise-valid liturgical ministries are preserved.
- Public directory projection reflects the resulting status/roles/ministries atomically.
- Exactly one audit record is appended.
- Auth UID/account remains unchanged.

### Rejection cases

- non-staging runtime → denied;
- executor flag false → denied;
- unauthenticated caller → denied;
- non-Admin/non-President actor → denied;
- inactive actor → denied;
- Admin target → denied;
- inactive/unverified target → denied;
- no-op target status → denied;
- stale reviewed revision → denied without mutation.

## Stop conditions

Stop immediately and do not improvise if any of the following occurs:

- production Firebase project/default production identity appears;
- production member data is visible in staging;
- Draft PR #1 is no longer draft/open or `main` has moved unexpectedly;
- external connectors become enabled;
- staging preflight fails;
- `/api/health` does not identify the isolated staging runtime/project/database;
- the deployed revision does not correspond to the intended application SHA;
- the mutation route appears reachable in production;
- a secret, token, PushSubscription endpoint, FCM token, or Web Push private key would need to be exposed;
- safe empirical testing would require creating a new identity or modifying a real member without explicit approval;
- profile state or audit count changes unexpectedly before a controlled test begins.

## Post-activation posture

The executor is now disabled again and should remain disabled between tests. Production remains hard-blocked by runtime checks and is not authorized for Core-status mutation. A separate explicit approval is required before any future production-capable promotion.
