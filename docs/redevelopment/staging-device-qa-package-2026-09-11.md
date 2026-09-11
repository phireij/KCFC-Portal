# KCFC Portal — Staging Device QA Package

**Date:** 2026-09-11  
**Scope:** isolated staging only  
**Purpose:** final notification/PWA acceptance using browser emulation first, then the available physical iPhone + Android tablet  
**Status:** test package only — **no production messaging or cutover authorization**

## Test strategy

Use the lowest-risk, highest-coverage sequence:

1. Automated CI/contracts.
2. Browser responsive/mobile emulation for representative iPhone and Android phone/tablet widths.
3. Android Emulator where it adds coverage.
4. Physical iPhone acceptance.
5. Physical Android tablet acceptance.
6. Optional supplemental Android phone acceptance from a KCFC member when one becomes available.

A Mac/iOS Simulator is **not required** for the planned KCFC acceptance path. Browser/mobile emulation covers layout and logic first; the physical iPhone provides the iOS/PWA/Web Push evidence that browser emulation cannot prove.

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

Every notification test records four independent outcomes:

1. **Transport acceptance** — server/provider accepted the push and endpoint was considered valid.
2. **OS presentation** — notification banner/lock screen/sound/vibration actually appeared or did not appear.
3. **Durable Inbox persistence** — the message exists in KCFC Inbox regardless of OS presentation.
4. **Tap/deep-link result** — tapping the notification opens the intended authorized KCFC destination.

Do not mark a push as failed solely because sound is absent. On iOS in particular, audible presentation is controlled by device/system settings.

Use `docs/redevelopment/notification-acceptance-evidence-template-2026-09-11.md` as the canonical record for every browser/emulator/physical notification case. A case may be marked `PASS` only under the template's four-signal rule; otherwise use `FAIL` or `INVESTIGATE` as defined there.

## Browser/emulation pass

Before asking the physical tester to participate, verify at representative iPhone, Android-phone and Android-tablet viewport sizes:

- Home readability and card hierarchy.
- Mobile navigation order and tap targets.
- More-sheet usability.
- Safe-area handling.
- Schedule All Schedule ↔ My Ministry behavior, including direct `?view=` URLs and browser Back/Forward restoration.
- Search/filter reset and no-results recovery.
- Community Directory privacy presentation and scanability.
- Updates and Inbox list/detail behavior.
- Profile/notification setup at normal and large text sizes.
- Resource Library mobile behavior.
- Dark-mode readability where supported.
- Install/help copy and notification-permission guidance.
- Enable Alerts flow.
- Device Registration/Repair UI.
- Notification Health diagnostics.
- Send Test control is clearly staging/test scoped.
- Inbox persistence and unread/read behavior.
- Notification deep-link destination handling, including query-specific navigation when a different Schedule view is already open and same-origin fallback for malformed/external targets.
- Stale endpoint repair behavior in controlled test data.
- No automatic broadcast/reply behavior.

Browser/emulator evidence should be captured separately from physical evidence and labeled `BROWSER`, `RESPONSIVE EMULATION`, or `ANDROID EMULATOR` as appropriate.

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

## Physical Android tablet acceptance

The Android tablet is the planned first physical Android baseline. It is sufficient to validate the Android/Chromium PWA notification path even though it does not represent every Android phone manufacturer.

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
- Lock the tablet.
- Send one test notification.
- Record lock-screen presentation, sound/vibration, Inbox, and deep link.

### AND-04 — Notification settings/channel
- Check Chrome/PWA notification permission and applicable Android notification-channel settings.
- If presentation is missing but transport succeeded, record the OS setting before classifying the app path as failed.

### AND-05 — Tablet layout sanity
- In both portrait and landscape, confirm the installed PWA remains usable and does not expose desktop-only leadership actions to an unauthorized test member.
- This is a supplemental layout check; phone-sized responsive behavior remains covered in browser/Android emulation.

## Multi-device acceptance

Use one synthetic staging member registered on the available physical iPhone + Android tablet.

Test:

1. Register the same synthetic member on both physical devices.
2. Send one targeted staging notification to that member.
3. Verify delivery independently on each registered device.
4. Verify KCFC Inbox has one durable logical message rather than duplicate user-visible messages caused by multiple device endpoints.
5. Invalidate/remove one staging device endpoint through the approved test mechanism.
6. Send another targeted test.
7. Verify the still-valid device succeeds and the stale endpoint is detected/repairable without breaking the valid device.

An additional Android phone can later be added as supplemental manufacturer/form-factor evidence without invalidating the iPhone + tablet baseline.

## Tester evidence form

For notification cases, use the canonical template at `docs/redevelopment/notification-acceptance-evidence-template-2026-09-11.md`. For quick device inventory, record:

| Field | Result |
| --- | --- |
| Tester | |
| Device/model | |
| OS/version | |
| Browser/version | |
| Installed PWA? | Yes / No |
| Notification permission | Granted / Denied / Other |
| Screenshot/video captured | Yes / No |
| Evidence template ID(s) | |
| Notes | |

Do not use this quick inventory table by itself to declare a notification case PASS.

## Acceptance interpretation

A representative device passes when:

- targeted transport succeeds or failures are correctly classified and actionable;
- expected OS presentation occurs when device settings allow it;
- KCFC Inbox persistence succeeds;
- notification tap/deep-link opens the intended destination;
- notification registration remains healthy or the repair path works;
- no unrelated member receives the test;
- no production data/action is touched.

## Planned representative set

The planned initial KCFC physical acceptance set is:

- one physical iPhone;
- one physical Android tablet.

This is sufficient for the initial production-readiness baseline when combined with automated contracts plus browser/Android-emulator phone-size coverage. A physical Android phone remains **recommended supplemental evidence**, not a prerequisite for continuing branch development or preparing the initial acceptance package.

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