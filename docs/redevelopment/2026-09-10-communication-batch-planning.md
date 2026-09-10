# KCFC Portal — Communication Batch Planning Increment

Date: 2026-09-10
Branch: `redesign/mobile-first-v2`

## Purpose

Prepare the existing notification creators for safe migration onto the shared communication policy without changing current Firestore write paths or activating any new transport.

## Added in this increment

### Reusable recipient batch planner

`src/lib/communicationBatch.ts` now provides a pure batch planner that:

- de-duplicates recipients by Firebase UID;
- preserves KCFC Inbox records even when secondary alerts are muted;
- includes a recipient in the PWA dispatch set only when the routing policy selects PWA;
- de-duplicates FCM tokens;
- never sends a message;
- never reads provider credentials;
- never activates LINE, Telegram, WhatsApp, Viber or SMS.

### Liturgical planning

`src/lib/liturgicalCommunication.ts` now exposes batch planners for:

- liturgical availability requests;
- published liturgical assignments.

The planners carry member notification preferences, connected-app metadata and FCM tokens into the shared routing policy while keeping external connector delivery disabled.

### Community duties

`src/lib/dutyCommunication.ts` now exposes a batch planner for community duty assignment notifications.

### Leadership broadcasts

`src/lib/broadcastCommunication.ts` now exposes a batch planner for routine and urgent broadcasts. The urgent flag affects normalized urgency metadata but does not authorize a send by itself.

## Why this is staged before creator replacement

The current Polls, Duties and Broadcast creator implementations are operational and include Firestore writes, push dispatch and/or email behavior. Replacing those paths in one step would create unnecessary regression risk.

The safer sequence is:

1. define pure single-recipient policy builders;
2. define and test pure batch recipient planning;
3. verify recipient de-duplication, preference handling and token de-duplication in CI;
4. integrate one creator at a time;
5. preserve the existing creator as the fallback until staging evidence is collected;
6. only then remove obsolete compatibility code.

## Validation

CI now runs two synthetic communication suites:

- `scripts/verify-communication-policy.ts`
- `scripts/verify-communication-batches.ts`

The batch suite verifies:

- muted duty/broadcast recipients retain Inbox but are removed from PWA dispatch;
- duplicate recipient UIDs collapse to one planned notification;
- duplicate FCM tokens collapse to one token;
- urgent broadcast metadata remains urgent;
- no external connector is selected by the batch layer.

## Explicitly not changed

This increment does **not**:

- send any production message;
- alter historical notification records;
- change Firebase UID or member documents;
- change poll/response/assignment data;
- enable external connectors;
- enable public website synchronization;
- merge or deploy the redevelopment branch.

## Next integration order

1. Liturgical availability request creator.
2. Availability completion notice.
3. Published roster / assignment notification creator.
4. Community duty assignment creator.
5. Leadership BroadcastTool.
6. Email/PWA delivery diagnostics after isolated staging evidence.

Every integration remains subject to the existing production approval gates.
