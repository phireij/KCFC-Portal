# KCFC External Communication Connector — Account Linking Contract

Status: design/implementation contract only. No live connector is authorized.

## Objective

Allow an authenticated KCFC member to opt in to optional secondary communication channels such as LINE and Telegram without exposing provider credentials or weakening the Firebase UID identity model.

The connector system supplements KCFC Inbox + PWA + Email. It never replaces the Portal Inbox as the durable communication record.

## Providers and priority

1. LINE — first optional connector for Japan-focused member use.
2. Telegram — second optional connector.
3. WhatsApp — future/conditional after current pricing/onboarding validation.
4. Viber — low priority/future.

SMS is a separate future paid escalation path, not an account-linked social connector.

## Identity rule

Firebase UID remains the canonical KCFC identity.

External provider user IDs are server-side attributes mapped to Firebase UID. They are not usernames, primary keys or authentication credentials for the Portal.

Recommended server-side link record fields:

- `uid`
- `provider`
- `providerUserId` (server-side only; never rendered to other members)
- `displayName` (optional member-safe provider label)
- `status` — pending / connected / disconnected
- `connectedAt`
- `disconnectedAt`
- `consentVersion`
- `lastVerifiedAt`
- audit metadata

No provider access token, channel secret, bot token, signing secret or refresh token belongs in the client-readable profile document.

## Feature gates

Server authority:

- `KCFC_CONNECTOR_LINE_ENABLED`
- `KCFC_CONNECTOR_TELEGRAM_ENABLED`
- `KCFC_CONNECTOR_WHATSAPP_ENABLED`
- `KCFC_CONNECTOR_VIBER_ENABLED`

Browser UI availability:

- `VITE_KCFC_LINE_CONNECTOR_ENABLED`
- `VITE_KCFC_TELEGRAM_CONNECTOR_ENABLED`
- `VITE_KCFC_WHATSAPP_CONNECTOR_ENABLED`
- `VITE_KCFC_VIBER_CONNECTOR_ENABLED`

All defaults are OFF.

A browser flag only allows the Portal to expose a Connect/Disconnect surface. It does **not** permit sending. The server flag and valid server credentials remain authoritative for callback/link/send operations.

## Generic linking lifecycle

### 1. Member requests connection

- Member is authenticated with Firebase.
- Client calls a server endpoint for the chosen provider.
- Server verifies Firebase ID token.
- Server verifies that provider connector is enabled.
- Server creates a cryptographically random, one-time, short-lived linking challenge/state bound to Firebase UID + provider.

### 2. Provider authorization / handshake

Provider-specific method may be OAuth, account-link URL, bot start parameter, webhook handshake or official account flow.

The outbound link must contain only the opaque short-lived challenge needed for the provider flow, not the Firebase UID itself.

### 3. Provider callback / webhook

Server:

- validates provider signature/token/callback authenticity,
- resolves the short-lived challenge,
- rejects expired, reused, mismatched or unknown challenge,
- obtains provider user ID from the verified provider payload,
- stores provider user ID → Firebase UID mapping server-side,
- marks connection connected,
- records consent/audit timestamp,
- invalidates the challenge.

### 4. Member sees Connected

The client receives only safe read-model state such as:

- provider,
- status,
- connected timestamp,
- optional display name.

The raw provider account ID is not needed in the normal UI.

### 5. Test connection

When implemented:

- member explicitly presses Test,
- client authenticates to server,
- server verifies connector flag + mapping + member ownership,
- server sends a single self-targeted test message,
- result is recorded in delivery diagnostics,
- quota/cost guard applies before provider send.

A provider test is not a mass messaging path.

### 6. Disconnect

- member explicitly requests disconnect,
- server authenticates Firebase UID,
- server marks mapping disconnected/revoked,
- future routing excludes provider,
- optional channel preference is disabled,
- KCFC Inbox history is retained,
- audit entry records disconnect without retaining unnecessary secrets.

## Provider-specific notes

### LINE

- Use official LINE Messaging API / account-linking capabilities only.
- Validate LINE webhook signatures server-side.
- LINE provider IDs remain server-side.
- Apply quota/cost guard before every outbound provider send.
- Free/paid plan conditions must be rechecked immediately before production activation because pricing can change.

### Telegram

- Use official Telegram Bot API/account-link flow.
- Bot token is server-side only.
- A start/deep-link parameter should contain only a one-time challenge, not Firebase UID.
- Validate that the callback/message containing the challenge belongs to the provider user being linked.

### WhatsApp

- Do not activate until official current onboarding/pricing/template requirements are revalidated.
- Access tokens and verification secrets remain server-side.

### Viber

- Keep low priority and disabled until a separate business decision because new bots operate under commercial terms.

## Sending contract

The connector service receives a transport-neutral request containing:

- Firebase recipient UID(s),
- source event ID/type,
- message template/content,
- urgency,
- requested provider,
- deep link to KCFC Portal.

Before each send, server checks:

1. provider feature flag,
2. valid connector configuration,
3. recipient has connected mapping,
4. recipient opted in to that provider/event class,
5. provider quota/cost guard,
6. deduplication/idempotency key where appropriate.

Server never trusts a client-supplied provider user ID as the destination.

## Delivery diagnostics

Store member-safe state such as queued/sent/delivered/failed/skipped when supported.

Internal diagnostics can contain provider error codes, but secrets/tokens and full provider callback payloads should not be copied into ordinary client-readable documents.

## Security requirements

- One-time challenges have short TTL and single use.
- Challenges are random and unguessable.
- Callback/provider authenticity is verified.
- CSRF/state protection applies to OAuth-style flows.
- Rate limit connect/test endpoints.
- Enforce Firebase authentication on user-initiated operations.
- Enforce leadership authorization on audience/mass-send operations.
- Never log provider secrets.
- Redact sensitive provider payloads from application logs.
- Audit link/disconnect/test/send actions.

## Privacy / consent

Connection is opt-in.

Member-facing copy must explain:

- which KCFC alert categories may be mirrored,
- Inbox remains the durable record,
- disconnect is available,
- provider messaging remains subject to provider/app notification settings,
- the external app is optional.

## Staging acceptance before connector activation request

- Synthetic staging member can connect.
- Wrong/expired/reused challenge is rejected.
- Callback with invalid provider signature is rejected.
- Browser does not receive provider credential/user ID.
- Disconnect prevents subsequent provider routing.
- Test sends only to the signed-in staging member.
- Quota guard blocks when configured limit is exhausted.
- Inbox is still created when provider delivery fails.
- Connector can be disabled instantly through server feature flag.

Passing staging does not authorize live activation. Production connector activation remains an explicit approval gate.
