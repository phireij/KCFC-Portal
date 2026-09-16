# KCFC Portal — Core-status staging activation handoff — 2026-09-15

## Current accepted checkpoint — updated 2026-09-16

- Repository: `phireij/KCFC-Portal`
- Branch: `redesign/mobile-first-v2`
- Exercised staging application head: `99229433e9750862443a2a3a4e18f6d8c4b5d0f4`
- Exercised staging build: `build-2026-09-15-006`
- Production `main`: `653cc7229600fd7baff17a21a21f12d267b66d2b` — unchanged
- Draft PR #1: must remain OPEN / DRAFT / NOT MERGED
- `/api/health`: healthy at the accepted staging checkpoint
- Core-status staging executor: provider state was previously restored to `false`; user has now explicitly authorized enabling it in isolated staging for the active acceptance/testing period
- `Staging QA`: Regular Member, no ministries
- `leadership_audit`: exactly two existing Core-status records from controlled staging work
- attempted additional Regular → Core upgrade: did not commit; audit count remained two

The branch may advance with documentation or automated-test hardening without changing the accepted `build-2026-09-15-006` staging application bundle. Treat `docs/redevelopment/core-status-staging-evidence-2026-09-16.md` as the evidence/status companion to this handoff.

This handoff is for isolated Firebase/App Hosting staging only. It does not authorize production deployment, production Core-status changes, production data mutation, PR merge, connector activation, Firebase Auth account recreation, or secret exposure.

## Governed Core-status contract

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

## User authorization for the staging acceptance period

On 2026-09-16 the user explicitly clarified that the Core-status staging executor should **not** be kept disabled throughout testing and instructed that it be enabled so the workflow can be tested properly.

Accordingly, for the active isolated-staging acceptance period:

- `KCFC_CORE_STATUS_STAGING_EXECUTOR_ENABLED=true` is authorized on the isolated staging backend;
- the flag may remain enabled while the approved Core-status acceptance tests are being performed;
- production remains blocked by the independent runtime guard and is not authorized;
- all external connectors remain disabled;
- only approved staging-only identities/data may be mutated;
- no real KCFC member record may be altered merely to obtain evidence;
- the flag should be returned to `false` after the Core-status acceptance/testing period is complete or if any isolation stop condition is triggered.

This authorization supersedes the earlier handoff wording that required a separate approval for every temporary executor window during the same staging acceptance period.

## Automated contract hardening after the accepted staging build

Automated repository coverage now additionally verifies:

- stale reviewed state leaves the entire member test snapshot unchanged and appends no audit record;
- rejected production/disabled/unauthorized/actor-mismatch execution leaves the full member snapshot unchanged;
- a successful Core → Regular downgrade removes Core-only organizational roles while preserving otherwise-valid liturgical membership;
- a dedicated Cleaning downgrade removes `cleaning_leader`, `cleaning`, and `cleaning_toilet_ok`, preserves `member`, and appends exactly one audit record.

This automated coverage is a guardrail only. It does not replace the remaining empirical Firestore/directory/audit work.

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

## Remaining empirical work

### 1. Stale-plan concurrency rejection

Still required. A controlled isolated-staging test must demonstrate that a reviewed transition based on an old member revision is rejected without modifying `users/{uid}`, `member_directory/{uid}`, or appending `leadership_audit`.

The executor is authorized to remain enabled during this active acceptance period, provided the staging identity/isolation checks remain green.

### 2. Core-only role + Cleaning downgrade cleanup

Still required. Using approved staging-only data, establish a Core Member with a Core-only organizational role and Cleaning assignment, then verify Core → Regular:

- sets `isCoreMember=false`;
- preserves permanent `member`;
- removes the Core-only organizational role;
- removes Cleaning and any cleaning-status marker;
- preserves otherwise-valid liturgical ministries if present;
- updates `member_directory/{uid}` consistently inside the transaction boundary;
- appends exactly one audit record;
- preserves Firebase Auth UID/account.

### 3. Physical-device PWA / Web Push

Still required separately on a physical iPhone and physical Android tablet. Record transport acceptance, OS presentation, durable Inbox persistence, and tap/deep-link behavior separately.

### 4. Toilet-cleaning assignment

Still deferred until approved staging data exists: a staging chore poll and an eligible Core Cleaning member with toilet-cleaning authorization.

## Executor operating rule during the authorized testing period

For the active isolated-staging acceptance period, `KCFC_CORE_STATUS_STAGING_EXECUTOR_ENABLED=true` is authorized.

Before relying on it for a mutation test:

1. verify the exact isolated staging project/backend/URL and healthy `/api/health`;
2. confirm no production/default identity or production data is visible;
3. confirm the approved staging-only target/data and expected pre-test audit count;
4. perform only the planned staging acceptance test;
5. capture non-secret evidence;
6. verify post-test target state, directory projection, audit count, and healthy staging runtime.

Return the flag to `false` when the Core-status staging acceptance period is complete, or immediately if an isolation/safety stop condition is triggered.

Do not create new synthetic accounts or alter real KCFC members merely to obtain acceptance evidence without explicit approval.

## Rejection expectations

- non-staging runtime → denied;
- executor flag false → denied;
- unauthenticated caller → denied;
- non-Admin/non-President actor → denied;
- inactive actor → denied;
- Admin target → denied;
- inactive/unverified target → denied;
- no-op target status → denied;
- stale reviewed revision → denied without mutation or audit append.

## Stop conditions

Stop immediately and do not improvise if any of the following occurs:

- production Firebase project/default production identity appears;
- production member data is visible in staging;
- Draft PR #1 is no longer draft/open or `main` moves unexpectedly;
- external connectors become enabled;
- staging preflight fails;
- `/api/health` does not identify the isolated staging runtime/project/database;
- the deployed revision does not correspond to the intended staging build/commit;
- the mutation route appears reachable in production;
- a secret/private key/token would need to be exposed;
- safe empirical testing would require an unapproved account/member mutation;
- the target profile or audit count differs unexpectedly before a controlled test starts.

## Post-acceptance posture

After the Core-status staging acceptance period is complete, restore the executor to `false`. Production remains hard-blocked by runtime checks and is not authorized for Core-status mutation. A separate explicit approval is required before any future production-capable promotion.
