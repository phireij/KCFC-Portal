# KCFC Communication Creator Migration Status

Date: 2026-09-10
Branch: `redesign/mobile-first-v2`

This document tracks progressive adoption of the shared communication-routing and Inbox metadata helpers. Historical Firestore notification records are not rewritten.

## Shared foundations

- `src/lib/communicationRouting.ts`
  - Inbox always remains the durable record.
  - PWA/Web Push is the primary alert when the member preference and composer allow it.
  - Email is the default partner when the member preference and composer allow it.
  - External providers require explicit feature-gate permission, member opt-in and connected state.
  - Composer-level PWA/email suppression is supported without suppressing Inbox.
  - Routing rationale explains event-class mute, composer suppression, email-partner opt-out, connector feature-gate blocking, connector opt-in and connector connection state separately.
- `src/lib/notificationRecord.ts`
  - Normalizes source, urgency and channel metadata for new Inbox records.
- `src/lib/communicationAudience.ts`
  - Centralizes current audience eligibility for Public, Parishioners, KCFC Members and Leadership.
  - Disabled accounts are excluded from new operational delivery.
- `src/lib/communicationBatch.ts`
  - De-duplicates recipient UIDs and FCM tokens.
  - Produces PWA recipient/token sets only for recipients whose routing plan includes PWA.
  - Produces email recipient IDs independently from PWA routing.
  - Produces per-provider LINE / Telegram / WhatsApp / Viber recipient IDs only when a plan explicitly contains that provider.
  - Remains pure and non-sending.
- `src/lib/communicationRecipient.ts`
  - Converts existing member profiles into transport-neutral recipients and excludes disabled accounts from targeted recipient sets.
- `src/lib/notificationPersistence.ts`
  - Adds database-bound timestamps without moving Firebase concerns into pure planners.
- `src/lib/communicationFirestore.ts`
  - Appends planned Inbox records to an existing Firestore `WriteBatch` without committing it or executing any transport.
- `src/lib/liturgicalCommunication.ts`
  - Provides pure builders for availability requests, availability-complete notices, published liturgical assignments and assignment-change notices.
  - Provides batch planners for availability requests, completion notices, publication and assignment changes.
- `src/lib/liturgicalCreatorPlan.ts`
  - Maps current member profiles and liturgical events into recipient-aware creator plans.
- `src/lib/liturgicalAssignmentDiff.ts`
  - Compares the last published assignment snapshot with the current draft and identifies affected members only.
- `src/lib/liturgicalPublicationPlan.ts`
  - Chooses initial publication, revision or unchanged-republication behavior and increments roster revision safely.
- `src/lib/dutyCommunication.ts`
  - Provides a pure community-duty notification builder and batch planner.
- `src/lib/broadcastCommunication.ts`
  - Provides routine/urgent broadcast builders and batch planning without activating any external provider.
- `src/lib/broadcastCreatorPlan.ts`
  - Adds leadership-composer personalization while excluding disabled profiles and retaining preference-aware Inbox/PWA routing.

## Creator migration table

| Creator | Current state | Notes |
| --- | --- | --- |
| Updates / Announcements | **Normalized + CI GREEN** | Uses shared audience eligibility, routing policy and notification-record helper. Inbox is retained even when routine announcement alerts are muted. PWA token collection follows the per-recipient routing result. External connectors remain disabled. |
| Liturgical availability request | **Integrated + CI GREEN** | Current `Polls.tsx` creator now appends normalized availability Inbox plans while leaving poll creation and response storage behavior intact. |
| Availability completion notice | **Integrated + CI GREEN** | Completion detection now uses the shared leadership completion plan and a one-time `availabilityCompletionNotifiedAt` marker. |
| Published liturgical assignment | **Integrated + CI GREEN** | Initial publication persists the explicit publication state and normalized assignment notifications atomically in the existing Firestore batch. |
| Assignment change / republish | **Integrated + CI GREEN** | Last published assignments are snapshotted; revised publication notifies only affected members, increments `rosterRevision`, and unchanged republication emits no redundant assignment notification. |
| Community duty assignment | **Auto-assignment Inbox normalized; CI validation in progress** | The legacy automatic assignment algorithm is unchanged. Its notification now uses the shared duty schema and durable Inbox semantics. PWA/email remain disabled in this legacy service because it did not previously execute those transports. |
| Leadership broadcast | **Creator planner ready; staged migration under CI validation** | New personalized creator planner excludes disabled accounts and produces preference-aware PWA recipient/token sets. Existing Gmail path remains separate and external connectors remain disabled. |
| Urgent notice | **Policy + builder foundation ready** | Urgent severity is supported, but no new production urgent-send surface or external escalation is activated. |

## Liturgical publication behavior

For a new explicit roster publication:

1. the current assignment set is saved as `lastPublishedAssignments`;
2. `rosterRevision` begins at 1;
3. assigned members receive normalized assignment Inbox records;
4. PWA recipients/tokens are derived from each member's routing plan;
5. publication metadata and Inbox records are committed atomically.

For a later roster edit:

1. editing returns the roster to unpublished review state;
2. the last deliberately published snapshot remains available for comparison;
3. publication computes added, removed and role/date-changed members;
4. only affected members receive an assignment-change notice;
5. `rosterRevision` increments;
6. an unchanged re-publication creates no redundant assignment notification.

Historical/legacy roster behavior remains readable through compatibility fallbacks; no historical documents are rewritten.

## Community-duty migration behavior

`autoAssignDuties` still uses the existing random legacy auto-assignment behavior and writes the same `duties` records. The notification portion now:

- captures the created duty document ID as the notification `sourceId`;
- uses `sourceType=duty` and the shared notification schema;
- keeps the Inbox record durable even if secondary alerts are muted;
- deep-links members to My Ministry / duties;
- reads profile communication preferences when available;
- intentionally disables PWA/email execution in this legacy path until a transport-aware duty cutover is separately validated.

This avoids falsely recording a PWA/email channel that the legacy service never attempted.

## Leadership broadcast migration target

The staged migration preserves the existing target filters, confirmation flow, Gmail sending path and backend PWA endpoint while changing Portal planning so that:

- disabled accounts are excluded;
- duplicate recipient UIDs and FCM tokens are collapsed;
- muted broadcast alerts retain a durable Inbox record but do not receive PWA;
- personalized `[name]`, `{name}`, `[nickname]` and `{nickname}` substitutions remain supported for Inbox records;
- the PWA backend receives only the recipient IDs/tokens selected by routing policy;
- external connectors remain unavailable;
- no mass message is sent by CI or migration validation.

## Validation evidence

- Normalized Announcements head `295ad9d11767160b731232210156fe3afeea5018`: GitHub Actions run #92 / id `34443219237` PASS.
- Liturgical builder verification head `cc7fc0a6c027a256867a39a71c5b345863048815`: GitHub Actions run #106 / id `34443618265` PASS.
- Communication batch verification head `f7f7e215e7d5c5162acc2cb9798fda1bbb8d33b6`: GitHub Actions run #154 / id `34453312081` PASS.
- Cleaned redevelopment head `be119c6354fda4a1c9d237bd3a74bcb2d158a66a`: GitHub Actions run #246 / id `34456375948` PASS.
- Current duty/broadcast migration candidate validation is tracked by the active branch CI and is not marked green in this document until the run completes.

## Safety invariants

- No historical notification backfill is performed.
- No Firebase UID changes.
- No destructive Firestore migration.
- No live external connector activation.
- No public website publishing cutover.
- No production mass-message test is authorized by these migrations.
- CI uses pure/synthetic planner verification and never invokes production send endpoints.
- A failed PWA transport does not remove the durable Inbox record.

## Next migration order

1. Complete CI validation of normalized automatic duty Inbox records.
2. Validate and apply the staged leadership BroadcastTool communication migration on the redevelopment branch only.
3. Remove temporary migration machinery after successful application.
4. Add delivery-attempt diagnostics without claiming successful delivery before transport confirmation.
5. Continue isolated staging, accessibility, mobile-device and role-regression QA before any production approval request.
