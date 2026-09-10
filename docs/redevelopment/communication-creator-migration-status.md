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
- `scripts/verify-communication-policy.ts`
  - CI-verifies durable Inbox behavior, member preferences, composer gates, connector gates, normalized record construction and audience eligibility.

## Creator migration table

| Creator | Current state | Notes |
| --- | --- | --- |
| Updates / Announcements | **Normalized + CI GREEN** | Uses shared audience eligibility, routing policy and notification-record helper. Inbox is retained even when routine announcement alerts are muted. PWA token collection follows the per-recipient routing result. External connectors remain disabled. CI run #92 passed all required steps. |
| Liturgical availability request | Pending | Existing member Inbox creation remains operational. Next migration will add `sourceType=availability`, routing channels and preference-aware PWA metadata without changing poll/response data. |
| Availability completion notice | Pending | Leadership completion message remains operational. Next migration will normalize source/urgency metadata. |
| Published liturgical assignment | Pending | Existing roster publication remains operational. Next migration will add assignment routing metadata while preserving explicit roster publication behavior. |
| Assignment change / republish | Pending | Important-urgency policy is defined; implementation will remain tied to explicit republish. |
| Community duty assignment | Pending | Existing legacy duty engine is preserved during first-cutover migration. |
| Leadership broadcast | Pending | Existing broadcast engine is preserved. Migration will retain least-privilege recipient selection and avoid enabling external providers. |
| Urgent notice | Policy ready / creator pending | Shared routing defines urgent severity, but no new production urgent-send surface is activated. |

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

## Validation evidence

Normalized Announcements head:
`295ad9d11767160b731232210156fe3afeea5018`

GitHub Actions:
- workflow: `KCFC Redevelopment CI`
- run: #92 / id `34443219237`
- TypeScript: PASS
- synthetic communication policy: PASS
- production build: PASS
- connector default-OFF guard: PASS
- provider-secret browser guard: PASS

## Safety invariants

- No historical notification backfill is performed.
- No Firebase UID changes.
- No destructive Firestore migration.
- No live external connector activation.
- No public website publishing cutover.
- No production mass-message test is authorized by this migration.
- A failed push does not remove the Inbox record.

## Next migration order

1. Liturgical availability request + completion notice.
2. Published assignment + assignment-change notifications.
3. Community duty notifications.
4. Leadership broadcasts.
5. Delivery diagnostics / email execution alignment once staging evidence is available.
