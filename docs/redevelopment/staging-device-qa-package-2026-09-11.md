# KCFC Portal — Staging Device QA Package

**Date:** 2026-09-11  
**Scope:** isolated staging only  
**Purpose:** final notification/PWA acceptance using browser emulation first, then physical iPhone + Android tablet/phone  
**Status:** test package only — **no production messaging or cutover authorization**

## Test strategy

Use the lowest-risk, highest-coverage sequence:

1. Automated CI/contracts.
2. Browser responsive/mobile emulation.
3. Android Emulator where useful.
4. Physical iPhone acceptance.
5. Physical Android tablet acceptance.
6. Physical Android phone acceptance from a KCFC member when available.

Physical-device QA is intentionally narrow: it verifies behavior that browsers/emulators cannot fully prove, especially real Web Push delivery, lock-screen presentation, sound/vibration, Focus/Silent behavior, background/suspended PWA behavior, and notification tap/deep-link handling.

## Environment rules

- Use an isolated staging environment and staging-only/synthetic accounts.
- Do not use production member data for test-only mutations.
- Do not send mass test notifications.
- Test messages must target only the selected staging tester/device registrations.
- External connectors remain OFF.
- Core-status staging executor remains disabled unless explicitly enabled for a proven isolated staging environment.
- No test result may be represented as real-device evidence unless observed on a physical device.

## Signals to record separately

Every notification test records three independent outcomes:

1. **Transport acceptance** — server/provider accepted the push and endpoint was considered valid.
2. **OS presentation** — notification banner/lock screen/sound/vibration actually appeared or did not appear.
3. **Durable Inbox persistence** — the message exists in KCFC Inbox regardless of OS presentation.

Do not mark a push as failed solely because sound is absent. On iOS in particular, audible presentation is controlled by device/system settings.

## Browser/emulation pass

Before asking a physical tester to participate, verify:

- Mobile navigation order and tap targets.
- iPhone and Android viewport responsiveness.
- Safe-area handling.
- Install/help copy and notification-permission guidance.
- Enable Alerts flow.
- Device Registration/Repair UI.
- Notification Health diagnostics.
- Send Test control is clearly staging/test scoped.
- Inbox persistence and unread/read behavior.
- Notification deep-link destination handling.
- Stale endpoint repair behavior in controlled test data.
- No automatic broadcast/reply behavior.

## Physical iPhone acceptance

Tester setup:

- Open staging KCFC Portal in Safari.
- Add to Home Screen if not already installed.
- Launch the installed PWA.
- Sign in with the assigned staging account.
- Enable Alerts and confirm notification permission is granted.
- Confirm Notification Health recognizes the current device/registration.

Run these cases:

### IOS-01 — Foreground
- Keep the PWA open.
- Send one staging-only test notification to this device.
- Record transport result, in-app/OS presentation, Inbox entry, and deep link.

### IOS-02 — Background
- Send the PWA to background.
- Send one test notification.
- Record banner/lock-screen result, sound if allowed by device settings, Inbox entry, and tap behavior.

### IOS-03 — Locked
- Lock the iPhone.
- Send one test notification.
- Record whether it appears on the lock screen, whether sound occurs, whether tapping opens the expected KCFC destination, and whether Inbox contains the same message.

### IOS-04 — Focus/Silent comparison
- Repeat one controlled test with Focus/Silent conditions noted.
- Do not treat suppressed sound as transport failure when system settings explain the suppression.

## Physical Android tablet/phone acceptance

Tester setup:

- Open staging KCFC Portal in Chrome.
- Install the PWA if supported/appropriate.
- Launch the installed app.
- Sign in with the assigned staging account.
- Enable Alerts and confirm Android notification permission/settings.
- Confirm Notification Health recognizes the current device/registration.

Run these cases:

### AND-01 — Foreground
- Keep the PWA open.
- Send one test notification.
- Record transport, presentation, Inbox, and deep link.

### AND-02 — Background
- Background the PWA.
- Send one test notification.
- Record banner, sound/vibration where allowed, Inbox, and tap behavior.

### AND-03 — Locked
- Lock the device.
- Send one test notification.
- Record lock-screen presentation, sound/vibration, Inbox, and deep link.

### AND-04 — Notification settings/channel
- Check Chrome/PWA notification permission and applicable Android notification-channel settings.
- If presentation is missing but transport succeeded, record the OS setting before classifying the app path as failed.

## Multi-device acceptance

Use one synthetic staging member registered on at least two physical devices when practical, for example:

- iPhone + Android tablet, or
- iPhone + KCFC member Android phone.

Test:

1. Send one targeted staging notification to the synthetic member.
2. Verify delivery independently on each registered device.
3. Verify the KCFC Inbox has one durable logical message rather than duplicated user-visible content caused by multiple device endpoints.
4. Invalidate/remove one staging device endpoint through the approved test mechanism.
5. Send another targeted test.
6. Verify the still-valid device succeeds and the stale endpoint is detected/repairable without breaking the valid device.

## Tester evidence form

Record for every physical device:

| Field | Result |
| --- | --- |
| Tester | |
| Device/model | |
| OS/version | |
| Browser/version | |
| Installed PWA? | Yes / No |
| Notification permission | Granted / Denied / Other |
| App state | Foreground / Background / Locked |
| Transport accepted | Yes / No / Unknown |
| Banner/lock-screen shown | Yes / No |
| Sound | Yes / No / Suppressed by settings / Unknown |
| Vibration/haptics | Yes / No / Not applicable / Unknown |
| KCFC Inbox entry | Yes / No |
| Tap opens correct destination | Yes / No / Not tested |
| Screenshot/video captured | Yes / No |
| Result | PASS / FAIL / INVESTIGATE |
| Notes | |

## Acceptance interpretation

A representative device passes when:

- targeted transport succeeds or failures are correctly classified and actionable;
- expected OS presentation occurs when device settings allow it;
- KCFC Inbox persistence succeeds;
- notification tap/deep-link opens the intended destination;
- notification registration remains healthy or the repair path works;
- no unrelated member receives the test;
- no production data/action is touched.

## Recommended representative set

Initial production-readiness evidence should include at minimum:

- one physical iPhone;
- one physical Android device (tablet is acceptable for the first pass);
- preferably one additional KCFC member Android phone for real-world Android coverage.

An Android phone is preferred as supplemental evidence, but lack of one does not block branch development or browser/emulator testing.

## Stop conditions

Stop the test and investigate before continuing if any of the following occurs:

- a test notification reaches a non-test/production member;
- a staging action appears to write to production;
- device registration changes another user's registration;
- a deep link exposes unauthorized leadership content;
- a test unexpectedly triggers email/connector/mass broadcast behavior;
- a destructive or production-only action is required to proceed.

## Production boundary

Passing this package does not itself authorize production. Production merge/deploy/public cutover remains subject to the existing explicit approval gate and the separate backup/rollback readiness evidence.
