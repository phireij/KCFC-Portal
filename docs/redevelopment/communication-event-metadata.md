# KCFC Communication Event Metadata

Status: redevelopment baseline

This document defines the normalized metadata that new KCFC Portal communication workflows should use while historical notification records remain readable.

## Durable record first

Every operational communication creates a KCFC Inbox record first. Optional push, email or connected-app delivery is secondary to the Inbox record and must never be the only durable record.

Recommended notification fields:

- `userId` — Firebase UID of the recipient.
- `title` and `message` — human-readable content.
- `type` — existing compatibility category (`announcement`, `duty`, `system`, `broadcast`).
- `status` — `unread` or `read`.
- `link` — Portal deep link to the relevant workflow.
- `sourceId` — source announcement, poll, duty, roster or broadcast identifier when available.
- `sourceType` — semantic origin such as announcement, availability, assignment, duty, broadcast or system.
- `urgency` — normal, important or urgent.
- `channels` — intended delivery channels after recipient preference and feature-gate evaluation.
- `deliveries` — optional diagnostic states by channel.
- `createdAt` — server timestamp.

## Event policy

| Event | Default urgency | Durable record | Primary alert | Partner | Optional secondary |
| --- | --- | --- | --- | --- | --- |
| Announcement | Normal | Inbox | PWA | Email if allowed | Connected opt-in provider |
| Availability request | Normal | Inbox | PWA | Email if allowed | Connected opt-in provider |
| New assignment | Important | Inbox | PWA | Email if allowed | Connected opt-in provider |
| Assignment change/cancellation | Important | Inbox | PWA | Email if allowed | Connected opt-in provider |
| Community duty | Normal | Inbox | PWA | Email if allowed | Connected opt-in provider |
| Broadcast | Normal | Inbox | PWA | Email if allowed | Connected opt-in provider |
| Urgent same-day notice | Urgent | Inbox | PWA | Email | Connected opt-in provider; SMS only when specifically authorized |

## Routing helper

`src/lib/communicationRouting.ts` centralizes recipient-level channel planning without sending anything. It intentionally separates policy from transport.

The helper guarantees:

1. Inbox is retained.
2. PWA is the primary routine alert when the recipient has not disabled that event class.
3. Email is the default partner when enabled by the member preference.
4. External providers are considered only when the caller explicitly enables connector routing, the member opted in and the provider is connected.
5. The helper never reads provider credentials and never bypasses feature gates.

## External connector gates

Server-side enablement variables:

- `KCFC_CONNECTOR_LINE_ENABLED`
- `KCFC_CONNECTOR_TELEGRAM_ENABLED`
- `KCFC_CONNECTOR_WHATSAPP_ENABLED`
- `KCFC_CONNECTOR_VIBER_ENABLED`

Browser-safe UI availability variables:

- `VITE_KCFC_LINE_CONNECTOR_ENABLED`
- `VITE_KCFC_TELEGRAM_CONNECTOR_ENABLED`
- `VITE_KCFC_WHATSAPP_CONNECTOR_ENABLED`
- `VITE_KCFC_VIBER_CONNECTOR_ENABLED`

All are `false` by default. Browser-safe flags communicate only whether a Connect/Disconnect UI may be exposed; they never contain credentials.

CI rejects provider secret-style values exposed through `VITE_*` variables and verifies all connector example flags remain disabled by default.

## Migration order

1. Preserve current notification creation behavior.
2. Add semantic metadata to new records without rewriting historical documents.
3. Move announcement creation to the central routing helper.
4. Move liturgical availability notifications to the helper.
5. Move final roster/assignment-change notifications to the helper.
6. Move duty and leadership broadcasts to the helper.
7. Add delivery diagnostics per transport.
8. Activate an external connector only after staging, security review, user consent UX and explicit production approval.

## Privacy rules

- External provider user IDs are mapped server-side to Firebase UID.
- Provider credentials and tokens are server-side only.
- Recipient email, phone number and external IDs are never exposed to other recipients.
- Disconnect must revoke future routing to that provider while preserving KCFC Inbox history.
- Audit records should identify the actor, target audience, event source and selected channels without storing unnecessary provider secrets.
