# KCFC Portal — Staging Test Matrix

Purpose: convert the staging-readiness checklist into repeatable test cases. These tests use isolated staging accounts/data only and do not authorize production actions.

## Test identities

Use synthetic staging identities with no production member data:

- `STG_REGULAR` — verified regular KCFC member.
- `STG_CORE` — verified core/chore member.
- `STG_LECTOR` — verified Lector & Commentator member.
- `STG_USHER` — verified Usher member.
- `STG_ALTAR` — verified Altar Server member.
- `STG_LEADER` — liturgical ministry leader.
- `STG_ADMIN` — KCFC administrator/president equivalent.
- `STG_TREASURER` — accounting editor.
- `STG_AUDITOR` — accounting approver/read role.
- `STG_PENDING` — pending/unverified account.
- `STG_DISABLED` — disabled account.

## Critical smoke tests

| ID | Actor | Scenario | Expected result |
| --- | --- | --- | --- |
| AUTH-01 | STG_REGULAR | Email/password sign-in | Existing UID/profile loads; no account recreation |
| AUTH-02 | STG_PENDING | Sign in | Pending state shown; protected member workflows blocked as designed |
| AUTH-03 | STG_DISABLED | Sign in | Disabled account cannot use protected Portal |
| NAV-01 | STG_REGULAR | Phone-width navigation | Exactly Home / Schedule / Community / Updates / More; no horizontal scrolling |
| NAV-02 | STG_REGULAR | Open More | Resources, Inbox, Profile visible; leadership/accounting only when authorized |
| NAV-03 | STG_LECTOR | Open `/duties?view=mine` directly | My Ministry is selected and the URL remains shareable/reload-safe |
| NAV-04 | STG_LEADER | Switch All Schedule → My Ministry → Manage, then use browser Back/Forward | `?view=all|mine|manage` tracks each subview and Back/Forward restores the matching view |
| HOME-01 | STG_LECTOR | Home with published assignment | Next assignment is prominent and links directly to `/duties?view=mine` |
| HOME-02 | STG_LECTOR | Explicit-publication roster is complete/closed but `rosterPublished=false` | Home does not expose the member assignment and does not label the roster published |
| SCH-01 | STG_LECTOR | My Ministry | Upcoming assignment shows date/Mass/ministry/role; history accessible |
| SCH-02 | STG_REGULAR | Entire Schedule search/filter | Search/filter works; empty state offers reset |
| SCH-03 | STG_LECTOR | Where I Serve filter | Only Masses containing the signed-in member are shown |
| SCH-04 | STG_REGULAR | Unpublished new roster | Assignment names are not visible |
| AVAIL-01 | STG_LEADER | Create multi-Mass request | Request created with explicit publication mode; Inbox notifications created |
| AVAIL-02 | STG_LECTOR | Submit multiple available dates | Latest response is saved and shown correctly |
| AVAIL-03 | STG_USHER | Revise open request | Latest response replaces prior state in leader progress/matrix |
| AVAIL-04 | STG_LEADER | Close request | Member edits stop; matrix/assignment planning remains available |
| ASSIGN-01 | STG_LEADER | Build roster | Candidate choices respect ministry membership + submitted availability |
| ASSIGN-02 | STG_LEADER | Publish complete roster | Roster becomes member-visible and assigned members receive Inbox notifications |
| ASSIGN-03 | STG_LEADER | Edit published roster | Roster returns to unpublished/review state until deliberately republished |
| INBOX-01 | STG_REGULAR | Open Inbox on phone | List → detail flow is readable; unread state updates correctly |
| UPDATE-01 | STG_ADMIN | Publish KCFC-member update | Eligible users receive Inbox record; push failure does not remove Inbox record |
| DIR-01 | STG_REGULAR | Browse Community Directory | Private email/phone/address are absent from general cards |
| RES-01 | STG_REGULAR | Browse Resources | Search/ministry filters work; resource links open |
| RES-02 | STG_LEADER | Add Resource | Authorized leader can add trusted resource reference |
| RES-03 | STG_REGULAR | Attempt resource management | Add/delete controls unavailable or denied |
| ACCT-01 | STG_TREASURER | Open Accounting | Existing preserved accounting engine loads inside new shell |
| ACCT-02 | STG_REGULAR | Open Accounting URL | Access denied |
| ADMIN-01 | STG_ADMIN | Open Admin | Focused leadership workspace loads; Advanced legacy tools remain separately labelled |
| ADMIN-02 | STG_REGULAR | Open Admin URL | Access denied |
| ADMIN-03 | STG_ADMIN | Pre-register a synthetic member | Only one unverified `pending_*` Firestore profile is created; no Firebase Auth user, verification grant, role or ministry assignment is created |
| ADMIN-04 | STG_ADMIN | Pre-register an email already present in users/pending queue | Duplicate is rejected before write; existing profile and Firebase UID remain unchanged |
| ADMIN-05 | STG_ADMIN | Edit a verified member's roles/ministries | Change summary appears before save; invalid governance combinations block save; successful update preserves the existing Firebase UID |
| ADMIN-06 | STG_ADMIN | Open focused Website Inquiry reply composer | Recipient is locked to the inquiry sender; opening/editing the composer sends nothing automatically |
| ADMIN-07 | STG_ADMIN | Attempt individual inquiry reply in isolated staging/sink only | Send requires explicit button + confirmation; successful send preserves the inquiry and marks unread → read; no bulk recipients or deletion occurs |
| ADMIN-08 | STG_ADMIN | Inspect routine Member Administration and Website Inquiry surfaces | Account disabling, member deletion, credential purge and Core-status mutation controls are absent from the routine focused surfaces |

## PWA / notification tests

| ID | Device | Scenario | Expected result |
| --- | --- | --- | --- |
| PWA-IOS-01 | iPhone/iPad Safari | Visit Profile before install | Clear Share → Add to Home Screen instructions; notification enable remains constrained by iOS app-mode requirement |
| PWA-IOS-02 | Installed iOS Home Screen app | Enable notifications | Permission request occurs after explicit tap; endpoint registers |
| PWA-IOS-03 | Installed iOS Home Screen app | Send test while app is backgrounded | Authenticated test endpoint accepts request; banner/lock-screen alert arrives when platform settings permit; tap opens intended Portal deep link |
| PWA-IOS-04 | Installed iOS Home Screen app | Send test with device muted / Focus enabled, then with normal notification settings | Portal delivery remains successful in both cases; sound/banner differences are recorded as OS-controlled behavior rather than treated as transport failure |
| PWA-IOS-05 | Installed iOS Home Screen app | Force-close Portal, lock device, send test | Push still arrives when iOS permits; opening the alert restores the intended route and Inbox record remains the source of truth |
| PWA-AND-01 | Android Chrome | Browser install prompt available | Install button opens browser-native prompt |
| PWA-AND-02 | Android Chrome | Prompt unavailable | Browser-menu manual instructions are shown |
| PWA-AND-03 | Installed Android app | Enable + test | Registration health becomes ready and test can be dispatched |
| PWA-AND-04 | Installed Android app | Send test while app is backgrounded/locked | Notification appears using system-default alert behavior; tap opens intended deep link |
| PWA-AND-05 | Installed Android app | Compare normal notification settings vs muted channel/device | Transport success is separated from OS sound/vibration policy; Inbox record remains available in both cases |
| PWA-REPAIR-01 | Supported device | Permission granted but no endpoint | Health shows repair-needed state and refresh action restores registration |
| PWA-REPAIR-02 | Supported device | Remove/expire one synthetic endpoint, keep another valid endpoint | Invalid endpoint is reported/cleaned without preventing delivery to the valid device or removing the Inbox record |
| PWA-MULTI-01 | Two registered devices for one staging member | Send one targeted test | Both valid endpoints are attempted and evidence can be correlated to the same Inbox record without claiming provider acceptance equals user-visible delivery |
| PWA-DEEP-01 | Installed supported device with Portal already open at `/duties?view=all` | Tap notification targeting `/duties?view=mine` | Existing KCFC window navigates to the full target URL and My Ministry is visible; query state is not lost |
| PWA-DEEP-02 | Supported device | Tap a test notification with malformed or cross-origin destination data | Portal refuses the external target and opens/focuses the same-origin KCFC Inbox fallback |

### Notification reliability interpretation

For mobile QA, record **transport**, **OS presentation**, and **Inbox persistence** separately:

1. Transport: did the Portal accept/send the push attempt and did the endpoint remain valid?
2. OS presentation: did the device show a banner/lock-screen alert and, where allowed, sound/vibration?
3. Durable source of truth: is the same message still present in KCFC Inbox even when OS presentation is muted, suppressed by Focus, or otherwise platform-controlled?

A missing sound by itself is not sufficient to classify Web Push transport as failed. Conversely, a successful provider/transport response is not sufficient to claim the member saw or heard the notification. Device evidence must record both layers.

## Connector safety tests

| ID | Actor | Scenario | Expected result |
| --- | --- | --- | --- |
| CONN-01 | Any | Default environment | All LINE/Telegram/WhatsApp/Viber server + browser feature gates are false |
| CONN-02 | Any | Inspect browser bundle/config | No provider secret/token uses `VITE_*` |
| CONN-03 | STG_REGULAR | Provider feature gate false | UI says Coming next/Future; no connect or send path is active |
| CONN-04 | STG_REGULAR | Synthetic connected-provider record | UI can display Connected status without exposing provider user ID/token |
| CONN-05 | Any | Routing helper with external delivery disabled | Inbox retained; external provider omitted even if a connection record exists |

## Accessibility / resilience tests

| ID | Scenario | Expected result |
| --- | --- | --- |
| A11Y-01 | Keyboard-only desktop navigation | Visible focus; all primary actions reachable |
| A11Y-02 | 200% browser zoom / large reading size | Primary navigation and critical actions remain usable |
| A11Y-03 | Phone safe-area / small viewport | No critical button is hidden behind bottom navigation |
| A11Y-04 | Empty filters/search | Recovery/reset action is clear |
| A11Y-05 | Network/read failure | Error state explains recovery rather than leaving blank screen |
| A11Y-06 | Dark mode | Essential text/actions remain legible |

## Evidence record

For each execution capture:

- Test ID.
- Date/build SHA.
- Device model + OS version + browser/PWA mode.
- Synthetic account role.
- Portal notification-health state before the test.
- Pass/fail.
- Transport result separately from OS banner/sound/vibration observation.
- Screenshot or short recording for visual/mobile tests.
- Firestore document IDs only from staging for data-flow tests.
- Defect link/notes if failed.

Do not capture production personal data in test evidence.
