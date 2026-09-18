# KCFC Portal — Communication Event Metadata

## Purpose

New communication records should become progressively easier to route, diagnose and display without rewriting historical Firestore notifications.

The migration is additive and backward-compatible. Existing notification records without these fields remain valid.

## Canonical source types

Use these values for new notification records where applicable:

- `announcement`
- `availability`
- `assignment`
- `duty`
- `broadcast`
- `system`

Assignment changes continue to use `sourceType: assignment` with important urgency and additional change metadata when needed.

## Canonical urgency

- `normal` — routine announcements, availability requests, routine duties, broadcasts.
- `important` — published liturgical assignments and assignment changes.
- `urgent` — genuinely urgent operational notices only.

Urgency does not override device Focus / Do Not Disturb or guarantee sound/vibration behavior.

## Canonical channel names

Routing metadata uses:

- `inbox`
- `pwa`
- `email`
- `line`
- `telegram`
- `whatsapp`
- `viber`
- `sms`

KCFC Inbox is always retained as the durable record for operational communication.

## Notification record shape

New records may add:

```ts
{
  sourceId?: string,
  sourceType?: CommunicationSourceType,
  urgency?: NotificationUrgency,
  channels?: CommunicationChannel[],
  deliveries?: NotificationDelivery[],
}
```

Delivery diagnostics, when present, may use:

- `queued`
- `sent`
- `delivered`
- `failed`
- `skipped`
- `read`

A channel listed in `channels` represents the routing plan for that message. Delivery success must come from `deliveries` or provider-specific evidence rather than from the channel list alone.

## Shared implementation helpers

`src/lib/communicationRouting.ts`
- produces a per-recipient routing plan,
- retains Inbox,
- honors event preferences,
- supports composer-level PWA/email gates,
- requires explicit caller enablement + opt-in + connected state before external providers enter the plan.

`src/lib/notificationRecord.ts`
- produces normalized transport-neutral Inbox payloads,
- de-duplicates channel metadata,
- does not create Firestore timestamps itself.

`src/lib/communicationAudience.ts`
- centralizes current Public / Parishioner / KCFC Member / Leadership eligibility,
- excludes disabled accounts from new operational delivery.

`scripts/verify-communication-policy.ts`
- runs in redevelopment CI,
- verifies Inbox durability, event preferences, composer gates, provider gates, record normalization and audience rules.

## Current creator adoption

### Updates / Announcements — normalized

New announcement publication now:

1. evaluates recipient eligibility with the shared audience helper;
2. builds a per-recipient routing plan;
3. writes a KCFC Inbox record even if the member disabled routine announcement alert channels;
4. records `sourceId`, `sourceType=announcement`, urgency, routing channels, audience and routing rationale;
5. collects an FCM token only when the publisher enabled push and the recipient routing plan includes `pwa`;
6. de-duplicates FCM tokens before dispatch;
7. leaves all external connectors disabled.

Announcement documents still retain their compatibility `portal` / `push` fields. Public website synchronization remains separately gated.

Validation: normalized Announcements head `295ad9d11767160b731232210156fe3afeea5018` passed all redevelopment CI steps in run #92.

### Liturgical availability — pending normalization

Existing request and completion Inbox notifications remain operational. Migration should add:

- `sourceId: poll.id`
- `sourceType: availability`
- `urgency: normal`
- routing channels from the shared planner
- routing rationale for diagnostics when useful

Do not change poll responses or availability semantics as part of this metadata migration.

### Published assignments — pending normalization

Published assignment records should use:

- `sourceId: poll.id`
- `sourceType: assignment`
- `urgency: important`
- route to `/duties?view=mine`

An edited published roster must still unpublish until deliberate re-publication.

### Community duties — pending normalization

Existing legacy duty behavior is preserved for first cutover. When normalized, new duty messages should use:

- `sourceType: duty`
- routine urgency unless there is a genuine urgent change
- durable Inbox first

### Leadership broadcasts — pending normalization

Existing broadcast permissions and recipient selection must remain unchanged during metadata adoption. External providers remain feature-gated OFF.

## Preference behavior

Member event preferences affect alert channels, not the existence of the durable Inbox record.

Examples:

- `announcements=false` → Inbox retained, routine PWA/email suppressed.
- `availability=false` → Inbox retained, routine availability alert channels suppressed.
- `assignments=false` → Inbox retained. Product policy may later decide whether assignment-change alerts should receive stronger treatment, but no bypass is introduced silently.

Composer-level controls can independently turn PWA/email off for one message while still preserving Inbox.

## External provider rule

LINE / Telegram / WhatsApp / Viber may enter a routing plan only when all applicable conditions are true:

1. server/browser feature gate is approved and enabled as appropriate,
2. caller explicitly allows external routing,
3. member opted in for that provider,
4. member has a connected provider account.

The pure routing helper does not activate a connector or read credentials.

## Migration order

1. Announcements — completed.
2. Liturgical availability request + completion notice.
3. Published assignments + assignment changes.
4. Community duties.
5. Leadership broadcasts.
6. Delivery diagnostics / email execution alignment.

Historical notification records remain untouched throughout this migration.
