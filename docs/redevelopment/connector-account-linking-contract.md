# KCFC Portal — Optional Communication Connector Account-Linking Contract

Status: **design / implementation contract only**. No external connector is activated by this document.

## Purpose

KCFC Inbox remains the durable record and PWA/Web Push remains the primary alert channel. Optional messaging applications can reinforce selected alerts for members who explicitly connect them.

Initial priority:

1. LINE
2. Telegram
3. WhatsApp — future / conditional
4. Viber — low priority

No secondary messaging app is required for KCFC membership or Portal use.

## Non-negotiable security rules

- Firebase Auth UID is the KCFC identity key.
- External platform user IDs are mapped to Firebase UID only on the server.
- LINE channel secrets, access tokens, Telegram bot tokens and future provider tokens are server-side only.
- No external credential may be stored in `users/{uid}` or browser local storage.
- OAuth/state tokens and account-link challenges must be short-lived and single-use.
- Connector callbacks must validate provider signatures or callback secrets before accepting identity claims.
- A member must explicitly initiate connection from an authenticated KCFC session.
- Disconnect must immediately stop new sends to that provider and revoke/delete the KCFC-side mapping where provider APIs permit.
- External connectors remain OFF unless their server feature flag is enabled.

## Member data model

The user profile may contain only display-safe connection state:

```ts
connectedCommunicationApps?: Array<{
  provider: 'line' | 'telegram' | 'whatsapp' | 'viber';
  status: 'connected' | 'pending' | 'disconnected';
  connectedAt?: Timestamp;
  displayName?: string;
}>
```

It must not contain provider access tokens, refresh tokens, bot tokens, signing secrets, raw OAuth state, or webhook secrets.

Server-side mapping collection recommendation:

```text
communication_connectors/{provider}/accounts/{providerUserId}
  firebaseUid
  providerUserId
  displayName
  consentVersion
  connectedAt
  disconnectedAt
  lastVerifiedAt
  status
```

A reverse lookup can be maintained in a protected server-only collection if required for efficient sends.

## Connection lifecycle

### 1. Begin

Authenticated member selects **Connect** for a provider.

Server verifies:

- user session,
- provider feature flag,
- provider configuration,
- user is not disabled.

Server creates a short-lived link challenge containing:

- random challenge ID,
- Firebase UID,
- provider,
- createdAt / expiresAt,
- single-use state,
- return path.

### 2. Provider authorization / identity proof

Provider-specific mechanism proves the provider account identity.

LINE preferred flow:

- Official Account / LINE Login or supported account-link mechanism,
- provider callback validates state and provider signature,
- provider user ID is captured server-side.

Telegram preferred flow:

- member opens the KCFC bot from a signed one-time deep-link challenge,
- bot webhook receives the challenge and Telegram user ID,
- webhook validates bot/callback secret and challenge expiry,
- server binds Telegram user ID to Firebase UID.

### 3. Confirm

Server writes the protected mapping and updates only display-safe connection state on the user profile.

Portal shows:

- Connected,
- optional provider display name,
- Test action when provider sending is enabled,
- Disconnect action.

### 4. Disconnect

Member requests disconnect from an authenticated KCFC session.

Server:

- disables/deletes the provider mapping,
- updates user connection state to disconnected or removes the record,
- records audit metadata,
- stops provider routing immediately.

## Proposed API contracts

Routes are contracts only until implemented behind disabled feature flags.

### Start connection

`POST /api/communication-connectors/:provider/connect/start`

Authenticated.

Response:

```json
{
  "provider": "line",
  "status": "pending",
  "authorizationUrl": "provider-or-kcfc-link-url",
  "expiresAt": "ISO-8601"
}
```

### Connection status

`GET /api/communication-connectors/:provider/status`

Authenticated.

Response:

```json
{
  "provider": "line",
  "status": "connected",
  "displayName": "optional display name"
}
```

### Disconnect

`POST /api/communication-connectors/:provider/disconnect`

Authenticated and CSRF/session protected.

### Test message

`POST /api/communication-connectors/:provider/test`

Authenticated. Must rate-limit per user/provider. Available only when the provider is enabled and the member is connected.

## Routing behavior

Every operational message first creates a KCFC Inbox record.

Channel routing then evaluates:

1. message audience,
2. message urgency,
3. member notification preference,
4. provider connection state,
5. provider feature flag,
6. quota / cost guard,
7. delivery eligibility.

Recommended normal hierarchy:

- Inbox: always for eligible recipients.
- PWA: primary alert when enabled.
- Email: default partner when the member allows it and event policy calls for email.
- LINE / Telegram: only when connected + opted in + event routing allows it.
- WhatsApp / Viber: future only.
- SMS: future paid escalation only.

## Delivery diagnostics

Inbox records may expose display-safe delivery metadata:

```ts
deliveries?: Array<{
  channel: CommunicationChannel;
  status: 'queued' | 'sent' | 'delivered' | 'failed' | 'skipped' | 'read';
  updatedAt?: Timestamp;
  detail?: string;
}>
```

Do not expose provider tokens, request signatures, raw API responses, or sensitive provider identifiers in client-visible delivery diagnostics.

## LINE quota guard

Before a production LINE send, routing must check the applicable plan/quota configuration. General announcements should not consume constrained quota if Inbox + PWA + email are sufficient. Reserve limited quota for higher-value operational alerts unless the account plan changes.

## Telegram guard

Telegram may be lower-cost, but connection is still opt-in and must never replace the KCFC Inbox record.

## Audit events

Record server-side audit events for:

- connection started,
- connection confirmed,
- connection failed,
- disconnect requested,
- disconnect completed,
- test message attempted,
- provider send attempted,
- provider send failed,
- quota guard skipped a send.

Audit events should reference Firebase UID and internal message/source IDs rather than copying message content unnecessarily.

## Production approval gates

External connector activation requires explicit approval after all of the following are complete:

- staging callback URL configured,
- provider signature validation tested,
- account-link challenge expiry tested,
- duplicate-link / account-takeover cases tested,
- disconnect tested,
- test-message rate limiting verified,
- Firestore/server rules reviewed,
- quota/cost guard verified,
- privacy disclosure prepared,
- rollback / feature-flag disable tested.

Until that gate, connector environment flags remain `false`.
