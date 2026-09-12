# Core Member Status — Staging Write Contract

## Purpose

This document defines the minimum contract for a future write-capable Core Member status workflow. It does **not** authorize production Core-status changes and does not itself add any Firestore mutation endpoint.

## Required planning step

Every proposed Core-status change must first be converted into a `CoreStatusMutationPlan` using `src/lib/coreStatusMutationPlan.ts`.

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

## Stale-write protection

A write executor must reject a plan if `coreStatusPlanStillMatches()` is false immediately before mutation. This prevents an operator from applying a preview after another administrator has already changed the member's status, roles or ministries.

The future server-side executor must repeat this protection transactionally; client-side matching alone is not sufficient.

## Atomic write requirement

For Core → Regular transitions, `isCoreMember`, roles and ministries must be changed together. The executor must never leave a member temporarily downgraded while retaining Core-only leadership/chore privileges.

Recommended transaction boundary:

1. re-read the member profile;
2. verify target UID and expected revision/snapshot;
3. verify the acting user is authorized;
4. apply `isCoreMember`, roles, ministries and a fresh `updatedAt` atomically;
5. append a non-destructive audit event containing actor, target, reason and before/after values;
6. return the committed revision to the caller.

## Upgrade semantics

Regular → Core changes eligibility only. The write must not automatically grant leadership roles, Kitchen/Cleaning membership or other ministries. Those assignments remain separate governed actions.

## Downgrade semantics

Core → Regular follows the current compatibility policy already modeled by `planCoreStatusTransition()`:

- preserve the permanent `member` role;
- remove other organizational roles;
- remove Kitchen and Cleaning membership;
- remove Cleaning toilet-status markers;
- preserve otherwise-valid liturgical ministries.

## Audit record

A future audit collection should use append-only records. At minimum each record should contain:

- action: `core_status_change`;
- actor UID;
- target UID;
- reason;
- before snapshot;
- after snapshot;
- server timestamp;
- committed member revision/reference.

Audit records must not contain authentication credentials, tokens or unrelated private profile fields.

## Staging-only execution gate

A write-capable implementation must initially be unavailable in production. Before promotion it must prove in isolated staging:

- upgrade leaves roles/ministries unchanged;
- downgrade removes Core-only privileges atomically;
- stale plans are rejected;
- unauthorized actors are rejected;
- audit records are written exactly once per committed transition;
- rollback procedure is documented and tested;
- no Firebase Auth user is deleted or recreated;
- no unrelated Firestore collections are mutated.

## Production approval gate

Production Core-status mutation remains approval-gated. Passing CI or staging tests does not authorize production use.
