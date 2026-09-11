# KCFC Portal — Backup & Rollback Readiness Plan

**Date:** 2026-09-11  
**Scope:** `redesign/mobile-first-v2` redevelopment branch and any future explicitly approved staging/production release  
**Status:** readiness evidence only — **NOT production approval**

## Purpose

This document defines the backup, rollback, identity-preservation, and verification evidence required before any production deployment of the KCFC Portal redevelopment.

It does **not** authorize deployment, production writes, destructive restoration, Firebase Auth recreation, public cutover, or any other approval-gated action.

## Safety invariants

1. Existing Firebase Auth UID is the canonical member identity and must be preserved.
2. Firebase Auth users must not be deleted and recreated as a migration technique.
3. No destructive Firestore schema migration is permitted as part of routine rollout.
4. Existing records must remain readable; newly introduced communication fields remain optional/backward-compatible.
5. Any restore that can overwrite or delete production data requires explicit approval and a reviewed restore plan.
6. The Core-status staging executor remains disabled and isolated from production.
7. External connectors remain feature-gated OFF unless separately approved.
8. Production merge/deploy/cutover remains explicitly approval-gated.

## Pre-release evidence checklist

Before requesting production approval, capture and retain:

- Exact release commit SHA and PR number.
- Successful full redevelopment CI run on that exact SHA.
- Dependency audit snapshot for the exact release candidate.
- Production build artifact identity/version.
- Current production deployment/version identifier.
- Current Firestore export/backup evidence or provider-supported point-in-time recovery evidence, where configured.
- Firebase Auth export/recovery evidence appropriate to the configured project and retention model.
- Hosting/server configuration snapshot sufficient to reconstruct the currently deployed release.
- Environment-variable inventory by **name only**; never place secret values in repository evidence.
- Roll-forward and rollback operator checklist.
- Representative staging/device QA results, including iPhone and Android notification behavior.
- Named release approver and explicit approval record.

## Application rollback

Preferred application rollback is version-based, not data-destructive:

1. Stop additional release actions.
2. Identify the last known-good production commit/artifact.
3. Re-deploy the last known-good application artifact using the normal deployment mechanism.
4. Do not mutate Firestore/Auth merely to match the older frontend/server unless an incompatibility is proven and separately reviewed.
5. Verify health endpoint/server startup, authentication, Home, Schedule, Community, Updates, Inbox, leadership access gates, and notification registration health.
6. Record rollback SHA/artifact and verification results.

## Data rollback / restore

A data restore is a last-resort operation because it can discard legitimate member activity created after a backup.

Before any restore:

- Determine whether the incident is application-only and can be resolved by application rollback.
- Identify affected collections/documents/accounts and exact incident window.
- Prefer targeted correction over whole-database replacement when safe.
- Preserve Firebase UID relationships.
- Do not delete/recreate Firebase Auth users.
- Produce a restore impact summary, including data that would be lost or overwritten.
- Require explicit user approval before destructive production restore execution.

After an approved restore:

- Reconcile member identity references.
- Verify authorization/role assignments.
- Verify communication records and Inbox history.
- Verify Schedule/publication records.
- Verify account-status/Core-status records.
- Verify no staging/synthetic data entered production.

## Notification-specific rollback checks

Because notification behavior is a high-priority regression area, rollback verification must distinguish:

1. **Transport acceptance** — provider/server accepted delivery and endpoint remains valid.
2. **OS presentation** — banner/lock screen/sound/vibration behavior observed on the physical device.
3. **Durable Inbox persistence** — the KCFC Inbox remains the authoritative user-visible record even when OS presentation is suppressed.

A missing sound alone is not proof of transport failure, particularly on iOS where system settings govern presentation.

## Minimum smoke verification after rollback

Use non-destructive checks only:

- `/api/health` succeeds.
- Existing member can sign in without UID/account recreation.
- Home renders.
- Schedule and published roster browsing render.
- Community Directory renders without private-contact leakage.
- Updates and KCFC Inbox render.
- Leadership route gates remain correct.
- Current-device notification health can be inspected.
- No automatic outbound broadcast/reply occurs.
- External connector flags remain OFF unless explicitly approved.
- Core-status executor remains disabled unless explicitly approved for an isolated staging environment.

## Evidence status as of 2026-09-11

Available on the redevelopment branch:

- Draft PR with production `main` protected.
- Full redevelopment CI and production-build guards.
- Dependency audit visibility and Firebase Admin Storage non-use guard.
- Notification/staging test matrix.
- Data-safety invariants and approval gates.

Still required before production approval:

- Actual provider/environment backup evidence for the target production environment.
- Exact deployment artifact/version rollback evidence.
- Representative real-device staging QA results.
- Explicit production deployment approval.

## Approval boundary

This plan is documentation and readiness preparation only. It does **not** approve or execute:

- merge to `main`,
- production deployment,
- public website cutover,
- production database restore,
- destructive migration,
- Firebase Auth deletion/recreation,
- bulk user mutation,
- live connector activation,
- production Core-status mutation, or
- mass outbound test messaging.
