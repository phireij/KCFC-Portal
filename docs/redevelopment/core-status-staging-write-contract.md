# Core Member Status — Staging Write Contract

## Purpose

This document defines the staging-only write contract for the governed Regular Member ↔ Core Member workflow. It does **not** authorize production Core-status changes.

The current redevelopment branch implements the contract through:

- `src/lib/coreStatusMutationPlan.ts` for deterministic transition planning and revision preconditions;
- `server/coreStatusStagingExecutor.ts` for the staging-only execution guard;
- `server/firestoreCoreStatusTransactionAdapter.ts` for the atomic Firestore write boundary;
- `server/coreStatusTransitionRoutes.ts` for authenticated Admin/President server access;
- the Membership status control in `src/components/admin/MemberRoleEditor.tsx` for operator review and confirmation.

The executor remains disabled by default in `.env.example` and is hard-blocked outside the staging runtime.

## Required planning step

Every proposed Core-status change is converted into a `CoreStatusMutationPlan` using `src/lib/coreStatusMutationPlan.ts`.

The plan captures:

- target Firebase UID;
- authenticated actor UID;
- required review reason;
- before/after Core status;
- complete before/after role snapshot;
- complete before/after ministry snapshot;
- cleanup roles and ministries;
- expected profile revision (`updatedAt`) for stale-write detection;
- an audit payload describing the transition.

The browser may request only the target member, desired Core status, reviewed revision and reason. The server rebuilds the role/ministry transition from the current trusted Firestore profile; it does not accept browser-supplied cleanup lists as authority.

## Authorization boundary

The route requires a Firebase ID token and then reads the acting profile from Firestore. Execution is allowed only when the actor is active, verified and holds `admin` or `president`.

Routine governed status editing excludes target profiles that carry the application `admin` role. This keeps application administration separate from KCFC organizational membership-status management.

## Stale-write protection

The request carries the member revision that was reviewed in the UI. The server compares it with the trusted plan's expected revision before entering the executor.

Inside the Firestore transaction, `coreStatusPlanStillMatches()` re-checks the complete status/role/ministry snapshot plus `updatedAt` immediately before mutation. This prevents an operator from applying a preview after another administrator has already changed the member.

## Atomic write requirement

For every committed transition, the following operations share one Firestore transaction boundary:

1. re-read the private member profile;
2. verify target UID and expected revision/snapshot;
3. apply `isCoreMember`, roles, ministries and a fresh `updatedAt` to `users/{uid}`;
4. rebuild and replace the sanitized `member_directory/{uid}` projection (or remove it if the member is no longer eligible for projection);
5. append one `leadership_audit` event containing actor, target, reason and before/after values.

A Core → Regular transition therefore cannot leave a member temporarily downgraded while retaining Core-only leadership/chore privileges, and the public member directory cannot intentionally lag the committed private status transition.

## Upgrade semantics

Regular → Core changes eligibility only. The write must not automatically grant leadership roles, Kitchen/Cleaning membership or other ministries. Those assignments remain separate governed actions.

## Downgrade semantics

Core → Regular follows the compatibility policy modeled by `planCoreStatusTransition()`:

- preserve the permanent `member` role;
- remove other organizational roles;
- remove Kitchen and Cleaning membership;
- remove Cleaning toilet-status markers;
- preserve otherwise-valid liturgical ministries.

The UI must show the cleanup preview before confirmation.

## Audit record

Committed transitions write an append-only `leadership_audit` record with:

- action: `core_status_change`;
- source: `staging_core_status_executor`;
- actor UID;
- target UID;
- reason;
- before snapshot;
- after snapshot;
- expected reviewed revision;
- committed timestamp.

Audit records must not contain authentication credentials, tokens or unrelated private profile fields.

## Staging-only execution gate

The write path is unavailable unless both conditions are true:

- `KCFC_RUNTIME_ENV=staging`;
- `KCFC_CORE_STATUS_STAGING_EXECUTOR_ENABLED=true` has been explicitly configured for the isolated staging deployment.

The repository default remains `KCFC_CORE_STATUS_STAGING_EXECUTOR_ENABLED=false`. `scripts/staging-preflight.mjs` accepts an explicit true value only in a runtime that has already passed the staging isolation checks; it continues to reject the production hostname/default Firebase project and requires all external connectors OFF.

Before production promotion, isolated staging still needs empirical evidence for approved data covering:

- upgrade leaves roles/ministries unchanged;
- downgrade removes Core-only privileges atomically;
- stale reviews are rejected;
- unauthorized actors are rejected;
- audit records are written exactly once per committed transition;
- `member_directory` reflects the committed status/role/ministry projection;
- Firebase Auth UID is unchanged and no Auth user is deleted or recreated;
- no unrelated Firestore collections are mutated.

No synthetic account should be created and no real member record should be modified solely for this acceptance test without the applicable operator approval.

## Production approval gate

Production Core-status mutation remains approval-gated. Passing CI, deploying the code to staging, or enabling the isolated staging feature flag does not authorize production use. A production deployment must retain a separate explicit approval step and fresh regression evidence.
