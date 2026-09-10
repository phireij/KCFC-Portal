# KCFC Communication Creator Migration Status

Date: 2026-09-10
Branch: `redesign/mobile-first-v2`

This document tracks progressive adoption of shared communication routing, durable KCFC Inbox records, and transport evidence. Historical Firestore notification records are not rewritten.

## Shared foundations

- `communicationRouting.ts` keeps KCFC Inbox as the durable source of truth, applies event-class preferences, supports independent PWA/email gates, and keeps external connectors approval-gated.
- `notificationRecord.ts`, `notificationPersistence.ts` and `communicationFirestore.ts` normalize new Inbox records, initialize planned secondary transports as `queued`, preserve existing ledgers, and retain exact notification IDs by recipient for later delivery evidence.
- `communicationBatch.ts` de-duplicates recipient UIDs and FCM tokens and exposes independent PWA, email and optional-provider recipient sets.
- `liturgicalCommunication.ts`, `liturgicalCreatorPlan.ts`, `liturgicalAssignmentDiff.ts` and `liturgicalPublicationPlan.ts` cover availability, completion, initial publication, revision publication and no-change republish behavior.
- `dutyCommunication.ts` provides normalized community-duty planning.
- `broadcastCommunication.ts` and `broadcastCreatorPlan.ts` provide normalized leadership broadcast planning, personalization, preference-aware recipient sets, and Web Push-only dispatch eligibility.
- `deliveryDiagnostics.ts` defines queued/sent/delivered/failed/skipped/read state handling.
- `pwaDeliveryEvidence.ts` reduces FCM + native Web Push transport attempts to an honest per-member `sent`, `failed` or `skipped` result without claiming device delivery.
- `currentDeviceNotificationHealth.ts` provides the next-stage current-browser endpoint evaluation so another device's saved subscription is not treated as proof that this device is healthy.

## Creator migration table

| Creator | Current state | Notes |
| --- | --- | --- |
| Updates / Announcements | **Integrated + CI GREEN** | Shared audience/routing/notification schema; Inbox survives muted routine alerts; PWA recipients are preference-aware. |
| Liturgical availability request | **Integrated + CI GREEN** | Poll creation remains compatible while normalized availability Inbox records are appended. |
| Availability completion notice | **Integrated + CI GREEN** | Completion uses shared planning and a one-time completion marker. |
| Published liturgical assignment | **Integrated + CI GREEN** | Publication metadata and normalized assignment Inbox records are committed atomically. |
| Assignment change / republish | **Integrated + CI GREEN** | Revised publication targets only affected members; unchanged republish emits no duplicate alert. |
| Community duty auto-assignment | **Integrated + CI GREEN** | Existing assignment algorithm is unchanged; durable duty Inbox records use normalized source metadata. |
| Leadership broadcast Portal/PWA | **Integrated + transport evidence added** | Disabled profiles are excluded; recipient IDs/tokens are de-duplicated; exact Inbox records are correlated with per-member FCM/Web Push transport results. |
| Leadership broadcast Email | **Integrated + CI GREEN** | Existing Gmail execution remains; recipients follow broadcast + `emailPartner` preferences. |
| Urgent notice | **Policy + builder foundation ready** | No new live urgent-send surface or external escalation is active. |

## PWA delivery-result persistence

New secondary channels start as `queued`; this means planned for execution, not sent. The leadership broadcast PWA endpoint now resolves target profiles once, records FCM and native Web Push attempts per member, and aggregates the result using these semantics:

- `sent`: at least one transport accepted the message;
- `failed`: one or more transports were attempted and none succeeded;
- `skipped`: the member was targeted but no deliverable endpoint was attempted;
- `delivered`: never inferred from FCM/Web Push acceptance;
- `read`: remains separate user evidence.

The broadcast creator supplies an exact `notificationIdsByUser` map generated when Inbox records are written. Before persisting a PWA result, the server fetches each supplied notification and verifies that its stored `userId` matches the member whose transport evidence is being recorded. Arbitrary or mismatched notification IDs are ignored.

This gives the existing Inbox delivery-diagnostics UI real backend transport evidence without rewriting historical notifications or making optimistic delivery claims.

## Web Push-only reliability correction

Leadership PWA dispatch now triggers whenever the routing plan has at least one PWA recipient, even when the FCM-token list is empty. This is important for iPhone/iPad Home-Screen users and other browsers reachable only through a stored native Web Push subscription. The server resolves those subscriptions from the targeted user IDs.

CI includes a synthetic Web Push-only member to guard against reintroducing the old `pushTokens.length > 0` requirement.

## Current-device notification health foundation

The existing Notification Health screen can count endpoints stored for the profile, but a profile may contain subscriptions from several devices. `currentDeviceNotificationHealth.ts` now provides a pure comparison between the browser's active Web Push endpoint and the stored profile subscriptions, returning `registered`, `unregistered`, `no_subscription`, or `unknown`.

The next UI increment will use this result so the health screen can distinguish “some device is registered” from “this device is registered,” without changing registration data destructively.

## Validation evidence

- Community-duty normalization: run `34456736739` — PASS.
- Leadership broadcast Portal/PWA migration: run `34457278564` — PASS.
- Broadcast email-routing migration: run `34457885367` — PASS.
- PWA delivery-evidence staged validation: run `34460436185` — PASS including staged TypeScript/build and connector guards.
- PWA delivery-evidence application: run `34460739624` — PASS; server + BroadcastTool changes typechecked and built before commit.
- Web Push-only dispatch staged validation: run `34461110197` — PASS including synthetic Web Push-only routing and staged TypeScript/build.
- Web Push-only dispatch application: run `34461269377` — PASS; migrated BroadcastTool source typechecked and built before commit.

## Safety invariants

- No Firebase UID changes or user recreation.
- No destructive Firestore migration or historical notification backfill.
- No live connector activation.
- No public website publishing cutover.
- No production mass-message test is executed by CI.
- Temporary migration runners are removed after application.
- A failed secondary transport never removes the durable Inbox record.
- A queued/planned transport is never presented as delivered without evidence.
- FCM/Web Push transport acceptance is recorded as `sent`, never `delivered`.

## Next work

1. Integrate current-browser Web Push endpoint inspection into the Notification Health UI and repair guidance.
2. Add email execution-result persistence with the same exact-record/evidence rules rather than optimistic success flags.
3. Continue isolated staging and role-regression scenarios for broadcast, liturgical publication and duty flows.
4. Continue mobile accessibility/device QA.
5. Keep external connectors and public website synchronization disabled until explicit approval.
