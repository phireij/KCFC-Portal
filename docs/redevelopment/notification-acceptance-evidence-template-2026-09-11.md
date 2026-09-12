# KCFC Portal — Notification Acceptance Evidence Template

**Scope:** isolated staging only  
**Purpose:** record browser/emulator/physical-device notification evidence without collapsing transport, presentation, Inbox persistence, and deep-link behavior into one ambiguous result  
**Production authorization:** none

## Evidence identity

| Field | Result |
| --- | --- |
| Evidence ID | |
| Date/time | |
| Environment | STAGING only |
| Test account | synthetic/staging identifier only; do not record credentials |
| Evidence type | BROWSER / RESPONSIVE EMULATION / ANDROID EMULATOR / PHYSICAL IPHONE / PHYSICAL ANDROID TABLET / SUPPLEMENTAL ANDROID PHONE |
| Device/model | |
| OS/version | |
| Browser/version | |
| Installed PWA | Yes / No / N/A |
| App state | Foreground / Background / Locked |
| Network state | Online / Offline / Recovered |
| Focus/Silent/DND state | Normal / Focus / Silent / DND / N/A |

## Required four-signal record

Each notification case must record all four signals separately.

| Signal | Result | Evidence / notes |
| --- | --- | --- |
| 1. Transport acceptance | PASS / FAIL / UNKNOWN | Provider/server acceptance, endpoint validity, classified transport error if any |
| 2. OS presentation | PASS / FAIL / SUPPRESSED / N/A | Banner/lock screen plus sound/vibration behavior and relevant OS settings |
| 3. Durable KCFC Inbox persistence | PASS / FAIL | Confirm the logical message exists in KCFC Inbox independently of OS presentation |
| 4. Tap/deep-link destination | PASS / FAIL / NOT TESTED | Confirm notification tap opens the intended authorized KCFC destination |

### Overall-result rule

`PASS` is allowed only when:

- transport is `PASS`;
- Inbox persistence is `PASS`;
- deep-link is `PASS` for cases where tap behavior is in scope; and
- OS presentation is `PASS`, `SUPPRESSED`, or `N/A` with the suppression/non-applicability explained by observed device/system settings.

A missing sound **must not** by itself change transport from PASS to FAIL. Sound/vibration are OS presentation signals and can legitimately be suppressed by Focus, Silent, DND, channel settings, or platform behavior.

Use `INVESTIGATE` whenever any required signal is `UNKNOWN`, `NOT TESTED` unexpectedly, or cannot be reconciled with the test conditions.

## Registration and repair evidence

| Field | Result |
| --- | --- |
| Notification permission | Granted / Denied / Default / Unsupported |
| Service worker | Ready / Missing / Unsupported |
| Current-device subscription | Registered / Unregistered / No subscription / Unknown |
| Repair/refresh attempted | Yes / No |
| Repair/refresh result | PASS / FAIL / N/A |
| Other device registration affected | No / Yes — STOP AND INVESTIGATE |

## Recipient-boundary evidence

| Field | Result |
| --- | --- |
| Intended staging recipient/device | |
| Any unrelated staging recipient received it | No / Yes |
| Any production/non-test recipient received it | **No required** / Yes — STOP |
| Email/LINE/Telegram/WhatsApp/Viber triggered unexpectedly | **No required** / Yes — STOP |

## Inbox and duplicate-behavior evidence

| Field | Result |
| --- | --- |
| Inbox logical message present | Yes / No |
| Read/unread transition works | Yes / No / N/A |
| Duplicate user-visible Inbox messages from multiple device endpoints | No / Yes |
| Expected destination after tap | |
| Actual destination after tap | |
| Authorization correct at destination | Yes / No |

## Visual evidence

| Field | Result |
| --- | --- |
| Screenshot/video captured | Yes / No |
| Evidence label includes test ID/device/state | Yes / No |
| Screenshot avoids credentials/tokens/push endpoints | Yes / No |
| Browser/emulator evidence clearly distinguished from physical evidence | Yes / No / N/A |

## Case result

| Field | Result |
| --- | --- |
| Overall result | PASS / FAIL / INVESTIGATE |
| Failure classification | Transport / OS presentation / Inbox / Deep link / Registration / Authorization / Recipient boundary / Other |
| Notes | |
| Follow-up issue/action | |

## Mandatory stop conditions

Stop and investigate immediately if:

- a test notification reaches a production or non-test member;
- the staging runtime appears to read/write production Firebase;
- device registration mutates another user's registrations;
- a deep link exposes unauthorized leadership content;
- the test unexpectedly triggers email, an external connector, or a mass broadcast;
- a destructive/production-only action becomes necessary.

## Production boundary

Completion of this template is evidence only. It does not authorize merge, production deployment, public cutover, destructive restore/migration, production Core-status mutation, connector activation, or mass messaging.
