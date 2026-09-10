# KCFC Communication Creator Migration Status

Date: 2026-09-10
Branch: `redesign/mobile-first-v2`

This document tracks progressive adoption of shared communication routing, durable KCFC Inbox records, and transport evidence. Historical Firestore notification records are not rewritten.

## Shared foundations

- `communicationRouting.ts` keeps KCFC Inbox as the durable source of truth, applies event-class preferences, supports independent PWA/email gates, and keeps external connectors approval-gated.
- `notificationRecord.ts`, `notificationPersistence.ts` and `communicationFirestore.ts` normalize new Inbox records, initialize planned secondary transports as `queued`, preserve existing ledgers, retain exact notification IDs by recipient, and safely attach later transport evidence only after record ownership is re-verified.
- `communicationBatch.ts` de-duplicates recipient UIDs and FCM tokens and exposes independent PWA, email and optional-provider recipient sets.
- `liturgicalCommunication.ts`, `liturgicalCreatorPlan.ts`, `liturgicalAssignmentDiff.ts` and `liturgicalPublicationPlan.ts` cover availability, completion, initial publication, revision publication and no-change republish behavior.
- `dutyCommunication.ts` provides normalized community-duty planning.
- `broadcastCommunication.ts` and `broadcastCreatorPlan.ts` provide normalized leadership broadcast planning, personalization, preference-aware recipient sets, and Web Push-only dispatch eligibility.
- `deliveryDiagnostics.ts` defines queued/sent/delivered/failed/skipped/read state handling.
- `pwaDeliveryEvidence.ts` reduces FCM + native Web Push transport attempts to an honest per-member `sent`, `failed` or `skipped` result without claiming device delivery.
- `currentDeviceNotificationHealth.ts` compares the current browser's active Web Push endpoint with stored profile subscriptions so another device's registration is not treated as proof that this device is healthy.

## Creator migration table

| Creator | Current state | Notes |
| --- | --- | --- |
| Updates / Announcements | **Integrated + CI GREEN** | Shared audience/routing/notification schema; Inbox survives muted routine alerts; PWA recipients are preference-aware. |
| Liturgical availability request | **Integrated + CI GREEN** | Poll creation remains compatible while normalized availability Inbox records are appended. |
| Availability completion notice | **Integrated + CI GREEN** | Completion uses shared planning and a one-time completion marker. |
| Published liturgical assignment | **Integrated + CI GREEN** | Publication metadata and normalized assignment Inbox records are committed atomically. |
| Assignment change / republish | **Integrated + CI GREEN** | Revised publication targets only affected members; unchanged republish emits no duplicate alert. |
| Community duty auto-assignment | **Integrated + CI GREEN** | Existing assignment algorithm is unchanged; durable duty Inbox records use normalized source metadata. |
| Leadership broadcast Portal/PWA | **Integrated + transport evidence** | Exact Inbox records are correlated with per-member FCM/Web Push outcomes; native Web Push-only members remain eligible. |
| Leadership broadcast Email | **Integrated + transport evidence** | Gmail recipients follow broadcast + `emailPartner` preferences; when a durable Inbox record exists, Gmail acceptance/failure is attached to that exact member record. |
| Notification Health | **Integrated + CI GREEN** | Current device is checked independently from other saved endpoints; install, permission, service worker and connectivity remain visible. |
| Urgent notice | **Policy + builder foundation ready** | No new live urgent-send surface or external escalation is active. |

## PWA delivery-result persistence

New secondary channels start as `queued`; this means planned for execution, not sent. The leadership broadcast PWA endpoint resolves target profiles once, records FCM and native Web Push attempts per member, and aggregates the result using these semantics:

- `sent`: at least one transport accepted the message;
- `failed`: one or more transports were attempted and none succeeded;
- `skipped`: the member was targeted but no deliverable endpoint was attempted;
- `delivered`: never inferred from FCM/Web Push acceptance;
- `read`: remains separate user evidence.

The broadcast creator supplies an exact `notificationIdsByUser` map generated when Inbox records are written. Before persisting a PWA result, the server fetches each supplied notification and verifies that its stored `userId` matches the member whose transport evidence is being recorded. Arbitrary or mismatched notification IDs are ignored.

## Gmail delivery-result persistence

When leadership sends a Portal + Email broadcast, the persisted Inbox record is initialized with the email channel as `queued` only for members whose routing preferences permit the email partner channel. After `sendGmail` returns, the client attaches evidence to the exact notification IDs generated for that member:

- Gmail acceptance is recorded as `sent`, not `delivered`;
- Gmail send failure is recorded as `failed` with the returned error detail;
- the notification is re-read and `userId` must still match before mutation;
- other channel evidence is preserved;
- a failure to write diagnostic evidence does not falsely turn the email into success.

Email-only composer mode still uses the existing behavior and does not yet create a durable Inbox record solely for diagnostic correlation. Aligning every email-only leadership broadcast with the KCFC Inbox source-of-truth rule is the next communication workflow refinement.

## Web Push-only reliability correction

Leadership PWA dispatch triggers whenever the routing plan has at least one PWA recipient, even when the FCM-token list is empty. This is important for iPhone/iPad Home-Screen users and other browsers reachable only through a stored native Web Push subscription. The server resolves those subscriptions from the targeted user IDs.

CI includes a synthetic Web Push-only member to guard against reintroducing the old `pushTokens.length > 0` requirement.

## Current-device notification health

Notification Health now inspects the active browser/service-worker Web Push subscription and compares its endpoint with the member profile. It can distinguish:

- this device is registered;
- this device has a subscription that is not registered to the profile;
- other stored endpoints exist but this device has no active subscription;
- the browser cannot provide enough information to make a current-device claim.

The screen refreshes this comparison when stored profile subscriptions load or change, avoiding a false early warning during asynchronous profile hydration.

## Validation evidence

- Community-duty normalization: run `34456736739` — PASS.
- Leadership broadcast Portal/PWA migration: run `34457278564` — PASS.
- Broadcast email-routing migration: run `34457885367` — PASS.
- PWA delivery-evidence staged validation: run `34460436185` — PASS including staged TypeScript/build and connector guards.
- PWA delivery-evidence application: run `34460739624` — PASS; server + BroadcastTool changes typechecked and built before commit.
- Web Push-only dispatch staged validation: run `34461110197` — PASS.
- Web Push-only dispatch application: run `34461269377` — PASS.
- Current-device notification-health staged validation: run `34461873742` — PASS after profile-refresh correction.
- Current-device notification-health application produced branch commit `06d738be6ea661aa1e6682c0a488a07ca7d6c9e8` after successful typecheck/build in the one-time runner.
- Gmail evidence staged validation: run `34462571286` — PASS, including base TypeScript/build, staged migration TypeScript/build and connector guards.
- Gmail evidence application: run `34462701022` — PASS; migrated BroadcastTool source typechecked and built before commit.

## Safety invariants

- No Firebase UID changes or user recreation.
- No destructive Firestore migration or historical notification backfill.
- No live connector activation.
- No public website publishing cutover.
- No production mass-message test is executed by CI.
- Temporary migration runners are removed after application.
- A failed secondary transport never removes the durable Inbox record.
- A queued/planned transport is never presented as delivered without evidence.
- FCM/Web Push/Gmail transport acceptance is recorded as `sent`, never `delivered`.

## Next work

1. Make the durable KCFC Inbox record unconditional for leadership email-only broadcasts while keeping secondary alerts preference-aware.
2. Continue isolated staging and role-regression scenarios for broadcast, liturgical publication and duty flows.
3. Continue mobile accessibility/device QA, especially iOS Home-Screen and Android install/notification paths.
4. Continue progressive leadership-workspace decomposition away from preserved Legacy* surfaces.
5. Keep external connectors and public website synchronization disabled until explicit approval.
