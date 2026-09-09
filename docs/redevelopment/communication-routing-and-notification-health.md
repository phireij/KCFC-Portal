# KCFC Portal — Communication Routing & Notification Health

## Objective

Important KCFC information must remain available inside the Portal even when a device push, email, or optional external messaging channel is unavailable.

The durable source of truth is the **KCFC Inbox**. Delivery channels are secondary transports, not independent message stores.

## Approved channel hierarchy

1. **KCFC Inbox** — durable message record and read/unread state.
2. **PWA / Web Push** — primary alert channel for supported installed devices.
3. **Email** — default partner channel; important operational messages should not rely on email alone.
4. **LINE** — first optional member-connected secondary channel for Japan-focused usage. Free-plan quota is limited and must be monitored before send.
5. **Telegram** — optional secondary channel with Bot API integration.
6. **WhatsApp** — future/conditional connector; pricing and onboarding must be revalidated before implementation.
7. **Viber** — low-priority future connector because new bots are commercial.
8. **SMS** — future paid emergency/escalation channel only, not baseline.

No member is required to install or connect a secondary messaging app.

## Message categories

- General announcements
- Liturgical availability request
- Availability deadline reminder
- Liturgical roster published
- Assignment changed / reassigned
- Community duty assignment
- Urgent community notice
- Leadership/admin notice

Each category can define a default routing policy while honoring member opt-in where appropriate.

## Routing principles

- Always create the Portal Inbox record first for important operational messages.
- Push should deep-link to the exact Portal context.
- Email is normally paired with high-value operational messages but is not considered proof of delivery.
- Optional external channels are used only for members who explicitly connected and enabled them.
- Avoid sending the same low-priority announcement through every connector.
- Urgency should control escalation, not convenience.
- LINE quota/cost should be checked before bulk sending.
- External channel failures must never delete or invalidate the Portal Inbox copy.

## Connected Communication Apps

Profile / Preferences will expose a **Connected Communication Apps** section.

Each supported connector uses states such as:

- Not connected
- Connecting
- Connected
- Needs attention
- Disabled by member

Member actions:

- Connect
- Disconnect
- Send test message
- Enable/disable eligible message categories

Server-side requirements:

- Map Firebase UID to external platform user ID securely.
- Keep platform secrets and access tokens server-side only.
- Record consent and connection timestamps.
- Allow immediate disconnect.
- Do not expose another member's connector identifiers.

## Notification Health

The Portal should show a simple health summary rather than making members diagnose browser technology.

### Member-facing status

- App installed / browser mode
- Push permission: enabled / blocked / not requested
- Current device subscription: healthy / needs repair
- Last successful token/subscription refresh
- Last test notification result
- Email partner channel: enabled / disabled
- Optional connected apps and health

### Primary actions

1. Install KCFC Portal
2. Enable Notifications
3. Send Test Notification
4. Done

On iOS/iPadOS, installation guidance should lead with **Add to Home Screen** before push enrollment where required.

## Reliability rules

- Support multiple device subscriptions per member.
- Remove invalid/expired push tokens when the provider reports they are no longer usable.
- Never silently mark push healthy only because browser permission is granted; a usable subscription/token must also exist.
- Notification taps must resolve to absolute/deep-link-safe URLs.
- App badge is best-effort where supported.
- Sound and vibration are best-effort; operating-system Focus/DND and browser settings remain authoritative.

## Delivery diagnostics

Where a channel supports it, store delivery state separately:

- queued
- sent
- delivered
- read
- failed
- skipped_not_connected
- skipped_preference
- skipped_quota

A provider acknowledging a request is not automatically equivalent to a human reading it.

## Privacy and safety

- External platform IDs are private operational identifiers.
- Message content must respect the message audience before it is routed externally.
- Private committee/member messages must never be projected onto the public website.
- Public website publishing is a separate channel decision and only valid for content with a public audience.

## Implementation sequence

1. Normalize Portal Inbox + routing metadata.
2. Add PWA notification-health diagnostics and test flow.
3. Pair operational notification policies with email.
4. Add LINE account linking and quota-aware routing.
5. Add Telegram linking/routing.
6. Re-evaluate WhatsApp pricing/onboarding.
7. Keep Viber and SMS as later optional connectors.
