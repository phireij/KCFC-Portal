# Core Member Status Transition Planning

## Purpose

Core Member status is a governance boundary, not a cosmetic profile flag. The current production-era administration behavior can remove executive/leadership roles and chore assignments when a Core Member is downgraded. The redevelopment therefore treats Core-status changes as a reviewed transition with an impact preview, not as a casual toggle.

## Current implementation

The focused Member Administration workspace includes a **read-only Core Member status planner**.

The planner:

- reads existing verified member profiles;
- previews Regular Member → Core Member and Core Member → Regular Member transitions;
- shows roles that would be preserved or removed;
- shows ministries/status assignments that would be preserved or removed;
- keeps liturgical ministries during a downgrade;
- identifies Kitchen, Cleaning and cleaning-status assignments as Core-only cleanup targets;
- reflects the existing legacy policy that a Core → Regular downgrade removes non-Member organizational roles;
- never writes to Firestore;
- never changes Firebase Auth identity;
- never deletes or recreates a member account.

## Transition semantics

### Regular Member → Core Member

The upgrade expands eligibility only. It does **not** automatically grant an executive role, committee leadership role, Kitchen/Cleaning membership, or any other ministry assignment. Any subsequent role/ministry assignment must go through the governed Roles & Ministries editor and pass `memberGovernance.ts` validation.

### Core Member → Regular Member

The current legacy policy requires cleanup before/with downgrade:

- preserve the permanent `member` role;
- remove other organizational roles;
- remove Kitchen and Cleaning ministry membership;
- remove Cleaning toilet-status markers;
- preserve liturgical ministries such as Lector & Commentator, Usher, Altar Server and Choir where otherwise valid.

The planner exposes this impact before any future write-capable workflow is introduced.

## Staging-only executor foundation

The redevelopment branch now contains an **inert, server-side staging executor contract** in `server/coreStatusStagingExecutor.ts` plus a Firestore transaction adapter in `server/firestoreCoreStatusTransactionAdapter.ts`.

Important boundaries:

- no Express/API route invokes the executor;
- no member-facing or leadership UI invokes the executor;
- `KCFC_CORE_STATUS_STAGING_EXECUTOR_ENABLED` is present in `.env.example` and defaults to `false`;
- the executor hard-blocks any environment other than `staging`;
- the reviewed actor UID must match the execution actor;
- execution requires the `admin` or `president` role;
- no-op mutation plans are rejected;
- stale member snapshots are rejected before any mutation;
- the member update and append-only `leadership_audit` record share one transaction adapter boundary;
- the Firestore adapter preserves Firestore Timestamp semantics for `updatedAt` and audit commit time.

This foundation exists so atomicity and rollback behavior can be tested before any route or production-capable switch is considered. It is **not activated**.

## Safety decision

The redevelopment does **not** yet promote Core-status mutation into the routine Member Administration workspace. Actual status changes remain isolated inside Advanced legacy administration until all of the following are complete:

1. a reviewed write plan applies the same pure transition result shown to the operator;
2. staging proves atomic/consistent role + ministry cleanup;
3. audit metadata is recorded for the actor, target and before/after state;
4. destructive side effects outside the `users` profile are explicitly reviewed;
5. rollback behavior is documented and tested;
6. production use receives the applicable approval gate.

The read-only planner is therefore safe to use during redevelopment and staging analysis, but it is intentionally **not** a production Core-status change control.

## Verification

`scripts/verify-core-status-transition.ts` verifies no-op transitions, Regular → Core preservation, Core → Regular role cleanup, Core → Regular chore cleanup, liturgical-ministry preservation, and no automatic role/ministry grants on upgrade.

`scripts/verify-core-status-mutation-plan.ts` verifies the auditable plan and stale-profile precondition contract.

`scripts/verify-core-status-staging-executor.ts` verifies production/disabled/unauthorized/actor-mismatch rejection, stale-plan rejection, and successful staging-only atomic adapter behavior with exactly one audit event.

All three run as part of KCFC Redevelopment CI. CI also guards `KCFC_CORE_STATUS_STAGING_EXECUTOR_ENABLED=false` in `.env.example`.
