# Liturgical Creator Integration Boundary

Date: 2026-09-10  
Branch: `redesign/mobile-first-v2`

## Purpose

This note defines the final safe boundary between the rebuilt liturgical planning UI and the communication delivery layer before the current `Polls.tsx` creators are migrated.

The goal is to change notification metadata and recipient planning without changing the proven Firestore poll, response, assignment, close/reopen, publish or unpublish behavior.

## Polls-ready pure plans

`src/lib/liturgicalCreatorPlan.ts` now accepts the same high-level inputs already available to `Polls.tsx`:

- verified eligible ministry member profiles;
- all member profiles for leadership lookup;
- poll ID and title;
- poll creator UID;
- assigned or affected member UIDs.

It exposes four pure plans:

1. availability-request creator plan;
2. availability-completion creator plan;
3. published-roster creator plan;
4. assignment-change creator plan.

These plans preserve member preferences, connector-account state and FCM token information while excluding disabled profiles from new operational delivery.

## Persistence boundary

`src/lib/communicationPersistencePlan.ts` and `src/lib/notificationPersistence.ts` separate routing from Firestore-specific timestamps.

The future `Polls.tsx` integration should therefore follow this boundary:

1. build the appropriate creator plan;
2. materialize its notification records using `serverTimestamp()`;
3. write those records to the existing `notifications` collection in the same Firestore batch as the existing creator action where atomicity is currently expected;
4. keep poll/assignment writes unchanged;
5. execute PWA/email only through separately approved transport code;
6. never infer that a planned channel was actually delivered.

## Compatibility rules

The creator migration must not:

- rename or move the `polls` collection;
- rewrite existing `polls/{id}/responses` documents;
- alter assignment-map shape;
- change availability eligibility semantics;
- publish draft rosters implicitly;
- notify disabled profiles;
- activate LINE, Telegram, WhatsApp or Viber;
- backfill historical notifications;
- create or recreate Firebase Auth users.

## Assignment-change rule

Editing a published roster already returns the roster to unpublished review state. The assignment-change notification must only be created after a leader deliberately republishes the revised roster. It must not be sent at edit time.

This avoids notifying members about an intermediate draft and keeps the durable Inbox aligned with the final published schedule.

## Validation gate

Before direct `Polls.tsx` integration is considered ready, CI must pass:

- TypeScript validation;
- communication policy verification;
- communication batch verification;
- Polls-ready liturgical creator-plan verification;
- production build;
- external connector default-OFF guard;
- provider-secret browser-exposure guard.

No production send test is part of this gate.
