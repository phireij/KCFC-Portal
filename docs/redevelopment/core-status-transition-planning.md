# Core Member Status Transition Planning

## Purpose

Core Member status is a governance boundary, not a cosmetic profile flag. A Core Member downgrade can remove executive/leadership roles and chore assignments, so the redevelopment treats Core-status changes as a reviewed transition with an impact preview rather than a casual profile toggle.

## Current implementation

The focused Governed Member Editing workspace now includes a dedicated **Membership status** control for Regular Member ↔ Core Member transitions.

The workflow:

- reads the existing verified member profile;
- shows the current Regular/Core status and a separate target-status selector;
- previews Regular Member → Core Member and Core Member → Regular Member transitions before mutation;
- shows roles and chore assignments that will be removed on downgrade;
- preserves valid liturgical ministries during a downgrade;
- identifies Kitchen, Cleaning and cleaning-status assignments as Core-only cleanup targets;
- reflects the compatibility policy that a Core → Regular downgrade removes non-Member organizational roles;
- preserves the existing Firebase Auth UID and never deletes or recreates the account;
- keeps membership-status mutation separate from ordinary role/ministry draft edits so the two workflows cannot be accidentally combined into an unreviewed partial change.

The status control is write-capable only in the isolated staging runtime. Outside staging, the UI remains disabled and explicitly identifies the production approval gate.

## Transition semantics

### Regular Member → Core Member

The upgrade expands eligibility only. It does **not** automatically grant an executive role, committee leadership role, Kitchen/Cleaning membership, or any other ministry assignment. Any subsequent role/ministry assignment must go through the governed Roles & Ministries editor and pass `memberGovernance.ts` validation.

### Core Member → Regular Member

The compatibility policy requires cleanup with the downgrade:

- preserve the permanent `member` role;
- remove other organizational roles;
- remove Kitchen and Cleaning ministry membership;
- remove Cleaning toilet-status markers;
- preserve liturgical ministries such as Lector & Commentator, Usher, Altar Server and Choir where otherwise valid.

The UI exposes this impact before the operator confirms the transition.

## Staging-only write path

The redevelopment branch contains a server-side staging executor in `server/coreStatusStagingExecutor.ts`, a Firestore transaction adapter in `server/firestoreCoreStatusTransactionAdapter.ts`, and a guarded route in `server/coreStatusTransitionRoutes.ts`.

Important boundaries:

- `KCFC_CORE_STATUS_STAGING_EXECUTOR_ENABLED` is present in `.env.example` and defaults to `false`;
- the route hard-blocks every runtime other than `staging`;
- staging activation requires the server-side feature gate to be explicitly enabled;
- the caller must present a verified Firebase ID token;
- the acting profile must be active/verified and hold the `admin` or `president` role;
- application-admin target profiles remain outside routine governed Core-status editing;
- the server builds the mutation plan from the current trusted Firestore profile instead of accepting role/ministry mutations from the browser;
- the reviewed `updatedAt` value is checked before execution and the executor transaction re-checks the complete profile snapshot to reject stale reviews;
- no-op mutation plans are rejected;
- the private `users` update, public `member_directory` projection update, and append-only `leadership_audit` event share one Firestore transaction boundary;
- Firestore Timestamp semantics are preserved for the member revision and audit commit time;
- no Firebase Auth identity is deleted or recreated.

The staging preflight continues to require isolated Firebase identity, a non-production hostname, and external connectors OFF. It now accepts the Core-status executor flag as either `false` (default) or an explicit `true` for isolated staging acceptance testing; this does not authorize production use.

## Operator workflow

Membership-status transitions are deliberately separate from ordinary role/ministry editing:

1. select a verified non-admin member;
2. select Regular Member or Core Member as the target status;
3. review the impact preview;
4. resolve or discard any pending ordinary role/ministry edits before continuing;
5. confirm the status transition;
6. the authenticated server route rebuilds and validates the transition against the current member revision;
7. if still valid, the transaction updates the private profile, public directory projection and audit record atomically.

If another administrator changes the member after the preview, the request fails closed and the operator must refresh and review the transition again.

## Production safety decision

This implementation does **not** authorize production Core-status mutation. Production remains blocked by both runtime checks and the explicit deployment/approval gate. Promotion requires separate production authorization plus fresh evidence that the staging workflow behaves correctly with approved test data.

The staging implementation is intended to close the product gap in Governed Member Editing while preserving the stronger Core-member governance boundary.

## Verification

`scripts/verify-core-status-transition.ts` verifies no-op transitions, Regular → Core preservation, Core → Regular role cleanup, Core → Regular chore cleanup, liturgical-ministry preservation, and no automatic role/ministry grants on upgrade.

`scripts/verify-core-status-mutation-plan.ts` verifies the auditable plan and stale-profile precondition contract.

`scripts/verify-core-status-staging-executor.ts` verifies production/disabled/unauthorized/actor-mismatch rejection, stale-plan rejection, and successful staging-only atomic executor behavior with exactly one audit event.

`scripts/verify-core-status-executor-isolation.ts` verifies that the browser never imports the server-only executor/transaction adapter, that the guarded server route remains staging-only, authenticated and Admin/President-gated, and that `.env.example` keeps the executor disabled by default.

All of these checks run as part of KCFC Redevelopment CI. The CI staging-preflight exercise leaves the executor OFF by default, and CI separately guards `KCFC_CORE_STATUS_STAGING_EXECUTOR_ENABLED=false` in `.env.example`.
