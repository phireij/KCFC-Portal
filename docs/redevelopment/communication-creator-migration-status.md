# KCFC Communication Creator Migration Status

Date: 2026-09-10
Branch: `redesign/mobile-first-v2`

This document tracks progressive adoption of the shared communication-routing and Inbox metadata helpers. Historical Firestore notification records are not rewritten.

## Shared foundations

- `src/lib/communicationRouting.ts`
  - Inbox always remains the durable record.
  - PWA/Web Push is the primary alert when the member preference and composer allow it.
  - Email is the default partner when member preference and composer allow it.
  - External providers require explicit feature-gate permission, member opt-in and connected state.
  - Composer-level PWA/email suppression is supported without suppressing Inbox.
- `src/lib/notificationRecord.ts`
  - Normalizes source, urgency and channel metadata for new Inbox records.
- `src/lib/communicationAudience.ts`
  - Centralizes current audience eligibility for Public, Parishioners, KCFC Members and Leadership.
  - Disabled accounts are excluded from new operational delivery.
- `src/lib/communicationBatch.ts`
  - De-duplicates recipient UIDs and FCM tokens.
  - Produces the PWA dispatch recipient/token set only from recipients whose routing plan includes PWA.
  - Remains pure and non-sending.
- `src/lib/liturgicalCommunication.ts`
  - Provides pure builders for availability requests, availability-complete notices and published liturgical assignments.
  - Provides batch planners for availability-request and assignment publication recipient sets.
- `src/lib/dutyCommunication.ts`
  - Provides a pure community-duty notification builder and batch planner.
- `src/lib/broadcastCommunication.ts`
  - Provides routine/urgent broadcast builders and batch planning without activating any external provider.
- `scripts/verify-communication-policy.ts`
  - CI-verifies durable Inbox behavior, member preferences, composer gates, connector gates, normalized record construction, audience eligibility and creator-specific builders.
- `scripts/verify-communication-batches.ts`
  - CI-verifies UID/token de-duplication and preference-aware PWA suppression for duty/broadcast batches.

## Creator migration table

| Creator | Current state | Notes |
| --- | --- | --- |
| Updates / Announcements | **Normalized + CI GREEN** | Uses shared audience eligibility, routing policy and notification-record helper. Inbox is retained even when routine announcement alerts are muted. PWA token collection follows the per-recipient routing result. External connectors remain disabled. |
| Liturgical availability request | **Builder + batch planner ready; creator integration pending** | Pure planning emits `sourceType=availability`, preference-aware routing, durable Inbox metadata, deduplicated recipient/token sets and no poll/response mutation. |
| Availability completion notice | **Builder ready; creator integration pending** | Leadership completion builder uses the same availability source and leader deep link. |
| Published liturgical assignment | **Builder + batch planner ready; creator integration pending** | Builder emits assignment source, important urgency and My Ministry deep link; batch planning respects assignment preferences and de-duplicates push targets. |
| Assignment change / republish | Policy ready / integration pending | Important-urgency policy is defined; implementation remains tied to deliberate re-publication. |
| Community duty assignment | **Builder + batch planner ready; legacy creator preserved** | Existing legacy duty engine remains the first-cutover source until integration is regression-tested. |
| Leadership broadcast | **Builder + batch planner ready; legacy creator preserved** | Routine and urgent builders are covered by CI; existing broadcast permission/recipient engine remains untouched for first cutover. |
| Urgent notice | Policy + builder foundation ready | Urgent severity is supported, but no new production urgent-send surface or external escalation is activated. |

## Announcement migration behavior

For each eligible registered Portal account, a new announcement publication now:

1. determines audience eligibility centrally;
2. builds a per-recipient routing plan;
3. creates the KCFC Inbox record regardless of whether routine announcement alert channels are muted;
4. records normalized `sourceId`, `sourceType`, `urgency`, `channels`, audience and routing rationale;
5. includes an FCM token in the push dispatch only when PWA is selected for that recipient and the publisher enabled push;
6. removes duplicate FCM tokens before dispatch;
7. does not activate LINE, Telegram, WhatsApp or Viber.

The existing announcement document continues to use its compatibility `portal` / `push` channel fields. Website synchronization stays `not_requested` and remains separately approval-gated.

## Batch-planning safety rules

All creator-specific builders and batch planners are pure metadata/routing functions. They:

- do not write Firestore;
- do not send PWA/email/external messages;
- do not read provider credentials;
- keep external connector routing disabled;
- preserve Inbox even when routine alert preferences suppress secondary channels;
- de-duplicate recipient UIDs before planning;
- de-duplicate FCM tokens before push execution;
- omit muted recipients from the PWA dispatch set while retaining their Inbox record.

Actual creator integration remains deliberately separate so current operational workflows are not replaced until their regression path is verified.

## Validation evidence

Normalized Announcements head:
`295ad9d11767160b731232210156fe3afeea5018`

GitHub Actions run #92 / id `34443219237`: TypeScript, communication policy, production build and connector guards all PASS.

Liturgical builder verification head:
`cc7fc0a6c027a256867a39a71c5b345863048815`

GitHub Actions run #106 / id `34443618265`: all required CI steps PASS.

Communication batch verification head:
`f7f7e215e7d5c5162acc2cb9798fda1bbb8d33b6`

GitHub Actions run #154 / id `34453312081`: TypeScript, communication policy, communication batch verification, production build and connector guards all PASS.

## Safety invariants

- No historical notification backfill is performed.
- No Firebase UID changes.
- No destructive Firestore migration.
- No live external connector activation.
- No public website publishing cutover.
- No production mass-message test is authorized by this migration.
- A failed push does not remove the Inbox record.

## Next migration order

1. Integrate liturgical availability request + completion builders into the current Polls creator with no poll/response behavior change.
2. Integrate published assignment metadata while preserving explicit roster publication/unpublish.
3. Integrate duty metadata only after legacy duty regression tests are green.
4. Integrate leadership broadcast metadata only after permission/recipient regression tests are green.
5. Add real delivery diagnostics / email execution alignment once isolated staging evidence is available.
