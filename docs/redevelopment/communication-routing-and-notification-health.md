# KCFC Communications Routing & Notification Health

Status: approved redevelopment architecture; external connectors remain disabled.

## Channel hierarchy

1. **KCFC Inbox** — durable source of truth.
2. **PWA / Web Push** — primary alert channel.
3. **Email** — default partner channel.
4. **LINE** — first optional secondary connector for Japan-focused usage.
5. **Telegram** — optional secondary connector.
6. **WhatsApp** — future / conditional after onboarding and pricing validation.
7. **Viber** — low priority because new bot usage is commercial.
8. **SMS** — future paid emergency escalation only when specifically authorized.

No secondary messaging app is required for KCFC membership or Portal use.

## Core rule: message record before transport

Operational communication must create the KCFC Inbox record regardless of whether push/email/external delivery later succeeds. A transport failure must not erase or prevent the durable Portal record.

## Member preferences

Members can separately control routine alerts for:

- announcements,
- liturgical availability requests,
- published assignments / changes,
- community duties,
- broadcasts,
- urgent notices,
- email partner delivery,
- future optional connected provider delivery.

Urgent alerts should remain exceptional. Preferences must not be used to hide durable Inbox history.

## Routing implementation

`src/lib/communicationRouting.ts` is the policy layer. It takes event kind, recipient preferences, connected providers and an explicit external-routing feature gate and returns urgency + intended channels.

Important properties:

- Inbox is always present.
- PWA is the normal primary alert when that event class is allowed.
- Email is the default partner unless disabled by preference/policy.
- External providers are not added unless the caller explicitly permits connector routing and the member both opted in and is connected.
- The routing helper does not send, read secrets or override provider feature gates.

`src/lib/notificationRecord.ts` is the normalized Inbox payload builder. It centralizes source metadata, urgency and de-duplicated channel metadata while leaving Firestore timestamps at the database boundary.

`src/types.ts` contains canonical communication source/provider/channel types.

## Connector feature gates

Server gates:

- `KCFC_CONNECTOR_LINE_ENABLED`
- `KCFC_CONNECTOR_TELEGRAM_ENABLED`
- `KCFC_CONNECTOR_WHATSAPP_ENABLED`
- `KCFC_CONNECTOR_VIBER_ENABLED`

Browser-safe UI availability gates:

- `VITE_KCFC_LINE_CONNECTOR_ENABLED`
- `VITE_KCFC_TELEGRAM_CONNECTOR_ENABLED`
- `VITE_KCFC_WHATSAPP_CONNECTOR_ENABLED`
- `VITE_KCFC_VIBER_CONNECTOR_ENABLED`

All example values default to `false`.

Browser flags may indicate whether a Connect UI is available. They do **not** authorize sending. Server credentials and final server feature gates remain authoritative.

CI verifies connector example defaults remain OFF and rejects provider-secret style `VITE_*` variables.

## Connected Communication Apps UX

Profile / Preferences may show:

- LINE — Connect / Connected / Disconnect / Test when implementation is approved.
- Telegram — same lifecycle after LINE foundation.
- WhatsApp — future/conditional.
- Viber — future/low priority.

Current staging-safe status vocabulary:

- **Connected** — a valid server-side mapping is represented by the member profile/read model.
- **Available to connect** — browser-safe gate allows the UI to be exposed; actual secure linking still required.
- **Coming next** — planned but current feature gate is OFF.
- **Future** — not in the active connector implementation path.

Provider user IDs and provider credentials must never be shown in the member UI.

## Account-linking security

The detailed contract is maintained in `connector-account-linking-contract.md`. Minimum requirements include:

- Firebase-authenticated member begins linking.
- Server creates a short-lived one-time challenge/state.
- Provider callback/webhook is validated server-side.
- Server maps provider account to Firebase UID.
- Consent and connection timestamp are recorded.
- Disconnect stops future routing.
- Provider credentials/tokens remain server-side.
- Audit log identifies actor/provider/result without leaking secrets.

## PWA installation and notification onboarding

Installation and notification enrollment are separate responsibilities.

Recommended flow:

`Install KCFC → Enable Notifications → Device Registration/Repair → Send Test Notification → Done`

The install component now focuses only on installation:

- iPhone/iPad: Safari Share → Add to Home Screen → launch KCFC icon.
- Android/Chromium: native install prompt when available, browser-menu fallback otherwise.
- Desktop browsers: install control/browser-menu guidance where supported.

Notification Health owns:

- standalone/browser mode,
- notification permission,
- registered endpoint count,
- healthy/setup-needed/blocked/repair-needed state,
- enable/repair action,
- authenticated test-push action,
- connector readiness summary.

## iOS / Android behavior

### iOS / iPadOS

Web Push requires the supported Home Screen web-app flow and explicit member interaction. The Portal must guide installation before notification enrollment when needed.

### Android / Chromium

Use the native browser installation prompt when available, with a clear manual fallback. Notification enrollment remains an explicit member action.

### Sounds / vibration

Sound, vibration, badges and lock-screen behavior are OS/browser/user-setting dependent. The Portal can request and test delivery but must never promise a forced custom alert sound.

## Multi-device / endpoint health

- A member may have more than one registered device.
- Invalid or expired tokens/subscriptions should be cleaned without breaking message creation.
- Permission granted with zero valid endpoints should show repair-needed state.
- A failed transport should be diagnosable without exposing credentials.

## Delivery diagnostics roadmap

Normalized notification records may carry a `deliveries` array containing channel status such as queued, sent, delivered, failed, skipped or read where the provider supports it.

The UI should expose member-safe diagnostics such as:

- Inbox saved,
- push attempted / failed,
- email attempted,
- connected provider not eligible,
- device registration needs attention.

Internal provider error payloads and secrets must not be displayed to ordinary members.

## Production authority

No LINE/Telegram/WhatsApp/Viber/SMS live connector activation, mass outbound test or production communication cutover occurs without explicit approval, even when code and staging are green.
