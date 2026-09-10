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
| HOME-01 | STG_LECTOR | Home with published assignment | Next assignment is prominent and links to My Ministry |
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
| ADMIN-01 | STG_ADMIN | Open Admin | Preserved admin engine loads inside leadership shell |
| ADMIN-02 | STG_REGULAR | Open Admin URL | Access denied |

## PWA / notification tests

| ID | Device | Scenario | Expected result |
| --- | --- | --- | --- |
| PWA-IOS-01 | iPhone/iPad Safari | Visit Profile before install | Clear Share → Add to Home Screen instructions; notification enable remains constrained by iOS app-mode requirement |
| PWA-IOS-02 | Installed iOS Home Screen app | Enable notifications | Permission request occurs after explicit tap; endpoint registers |
| PWA-IOS-03 | Installed iOS Home Screen app | Send test | Authenticated test endpoint accepts request; notification arrives when platform permits |
| PWA-AND-01 | Android Chrome | Browser install prompt available | Install button opens browser-native prompt |
| PWA-AND-02 | Android Chrome | Prompt unavailable | Browser-menu manual instructions are shown |
| PWA-AND-03 | Installed Android app | Enable + test | Registration health becomes ready and test can be dispatched |
| PWA-REPAIR-01 | Supported device | Permission granted but no endpoint | Health shows repair-needed state and refresh action restores registration |

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
- Device/browser.
- Synthetic account role.
- Pass/fail.
- Screenshot or short recording for visual/mobile tests.
- Firestore document IDs only from staging for data-flow tests.
- Defect link/notes if failed.

Do not capture production personal data in test evidence.
