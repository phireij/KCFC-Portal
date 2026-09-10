# KCFC Communication Creator Migration Status

Date: 2026-09-10
Branch: `redesign/mobile-first-v2`

This document tracks progressive adoption of the shared communication-routing and Inbox metadata helpers. Historical Firestore notification records are not rewritten.

## Shared foundations

- `communicationRouting.ts` keeps KCFC Inbox as the durable source of truth, applies event-class preferences, supports independent PWA/email composer gates, and keeps external connectors approval-gated.
- `notificationRecord.ts`, `notificationPersistence.ts` and `communicationFirestore.ts` normalize new Inbox records and preserve database-bound timestamps/atomic batch ownership.
- `communicationBatch.ts` de-duplicates recipient UIDs and FCM tokens and exposes independent PWA, email and optional-provider recipient sets.
- `communicationRecipient.ts` maps current user profiles into communication recipients while excluding disabled accounts from targeted delivery.
- `liturgicalCommunication.ts`, `liturgicalCreatorPlan.ts`, `liturgicalAssignmentDiff.ts` and `liturgicalPublicationPlan.ts` cover availability, completion, initial publication, revision publication and no-change republish behavior.
- `dutyCommunication.ts` provides normalized community-duty planning.
- `broadcastCommunication.ts` and `broadcastCreatorPlan.ts` provide normalized leadership broadcast planning, personalization and preference-aware PWA/email recipient sets.
- `deliveryDiagnostics.ts` defines queued/sent/delivered/failed/skipped/read state handling and deliberately does not equate a planned channel with successful delivery.

## Creator migration table

| Creator | Current state | Notes |
| --- | --- | --- |
| Updates / Announcements | **Integrated + CI GREEN** | Shared audience/routing/notification schema; Inbox survives muted routine alerts; PWA recipients are preference-aware. |
| Liturgical availability request | **Integrated + CI GREEN** | Poll creation remains compatible while normalized availability Inbox records are appended. |
| Availability completion notice | **Integrated + CI GREEN** | Completion uses the shared leadership plan and one-time completion marker. |
| Published liturgical assignment | **Integrated + CI GREEN** | Publication metadata and normalized assignment Inbox records are committed atomically. |
| Assignment change / republish | **Integrated + CI GREEN** | Last published assignment snapshot is retained; revised publication targets only affected members; no-change republish emits no duplicate alert. |
| Community duty auto-assignment | **Integrated + CI GREEN** | Existing assignment algorithm is unchanged; durable duty Inbox records now use normalized source metadata. Legacy auto-duty does not claim PWA/email because it never executed those transports. |
| Leadership broadcast Portal/PWA | **Integrated + CI GREEN** | Disabled profiles excluded; personalized Inbox records retained; PWA recipient IDs/tokens follow each member's broadcast preference and are de-duplicated. |
| Leadership broadcast Email | **Integrated + CI GREEN** | Existing Gmail execution remains intact but the recipient set now follows the shared broadcast + `emailPartner` preferences before sending. No email is sent during CI. |
| Urgent notice | **Policy + builder foundation ready** | Urgent severity exists; no new live urgent-send surface or external escalation is activated. |

## Liturgical publication behavior

For initial explicit publication, the current roster is saved as `lastPublishedAssignments`, `rosterRevision` begins at 1, and assigned members receive normalized assignment records. After a published assignment is edited, the roster returns to unpublished review state while the last published snapshot remains available. Re-publication computes added, removed, date-changed and role-changed members, notifies only those affected, and increments the revision. An unchanged re-publication creates no redundant assignment notification.

Historical records remain readable through compatibility fallbacks and are not rewritten.

## Community-duty behavior

`autoAssignDuties` preserves the current duty-generation logic and Firestore `duties` records. The notification path now captures the created duty ID as `sourceId`, uses `sourceType=duty`, deep-links to My Ministry, and reads the member's communication preferences when available. PWA/email are deliberately suppressed in this legacy path until a transport-aware duty delivery cutover is separately validated.

## Leadership broadcast behavior

The existing leadership target filters, confirmation flow, personalized Gmail content and backend PWA endpoint remain available. The migrated routing layer now:

- excludes disabled accounts before delivery planning;
- collapses duplicate UIDs and FCM tokens;
- keeps a durable Inbox record for Portal broadcasts even when a member mutes broadcast alerts;
- sends PWA only to members whose routing plan includes PWA;
- keeps `[name]`, `{name}`, `[nickname]` and `{nickname}` personalization for Inbox/email;
- filters Gmail recipients through both the broadcast event preference and `emailPartner` preference;
- keeps LINE, Telegram, WhatsApp and Viber disabled;
- performs no real mass-send during CI or migration validation.

## Delivery diagnostics foundation

`deliveryDiagnostics.ts` adds pure state helpers for transport evidence. A planned or queued channel does not count as sent. A channel becomes successful only after a transport explicitly reports `sent`, `delivered`, or `read`; failures/skips remain distinguishable. The existing Inbox already renders delivery diagnostics when `deliveries` metadata is present.

Persisting real transport outcomes is the next step and must only use actual provider/backend responses rather than assumptions.

## Validation evidence

- Announcements normalization: run #92 / `34443219237` — PASS.
- Liturgical builder verification: run #106 / `34443618265` — PASS.
- Communication batch verification: run #154 / `34453312081` — PASS.
- Cleaned redevelopment head `be119c6354fda4a1c9d237bd3a74bcb2d158a66a`: run #246 / `34456375948` — PASS.
- Community-duty normalization commit `f38da2472f8499d60bbbf07d5527458510fc6b63`: run `34456736739` — PASS.
- Broadcast creator + delivery diagnostics + staged Portal/PWA migration validation on `029a09e28917f9c5dc044036069367fd13e64787`: run `34457152546` — PASS.
- One-time leadership broadcast Portal/PWA migration run `34457278564` — PASS; migrated source typechecked and built before commit.
- Broadcast email-routing staged validation on `f76269c63ea76497aab431e5018f3df4bc3767c8`: run `34457749385` — PASS.
- One-time broadcast email-routing migration run `34457885367` — PASS; migrated source typechecked and built before commit.

## Safety invariants

- No Firebase UID changes or user recreation.
- No destructive Firestore migration or historical notification backfill.
- No live connector activation.
- No public website publishing cutover.
- No production mass-message test is executed by CI.
- Migration workflows are temporary and removed after application.
- A failed secondary transport never removes the durable Inbox record.
- A queued/planned channel is never presented as successfully delivered without transport evidence.

## Next work

1. Persist delivery-attempt/result metadata from actual PWA/email execution without overstating delivery.
2. Continue isolated staging and role-regression scenarios for leadership broadcast, liturgical publication and duty flows.
3. Continue mobile accessibility/device QA, including PWA install/notification health behavior.
4. Review dependency-security findings separately and plan non-breaking remediation rather than using forced upgrades.
5. Keep external connectors and public website synchronization disabled until their explicit approval gates.
