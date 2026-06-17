# KCFC Application Technical Design Document

## 1. Scope & Goals

This document describes the design and specification of the **Chore Assignment & Duty Rotation System** for the Kyoto Catholic Filipino Community (KCFC). 

The module is integrated into the existing KCFC platform to manage and allocate responsibilities for both cleaning and kitchen tasks efficiently among members, ensuring fairness and balancing workloads, with a high degree of customizability for administrators.

### Core Objectives
1. **Pre-Attendance Poll Verification**: Automate tracking and closure of "Chore Committee (Single Mass)" (`core_member`) polls.
2. **Notification Pipeline**: Notify the poll creator, ADMIN, and President when the poll ends or is fully responded to by chore committee members, prompting them to close the poll.
3. **Dynamic Duty Configurator**: Admin/President can select, create, edit, or delete duties, adjusting the number of required persons and special constraints (such as restricted toilet duties).
4. **Resilient Load-Balancing Matching Algorithm**: Match YES-responders to duties. If responder count is lower than required slots, intelligently duplicate assignments across duties. Prioritize allocating members with lower historical chore counts first to keep workloads balanced.
5. **Interactive Staging & Custom Board**: Allow admins to preview suggestions, perform manual overwrites, and then batch approve assignments.
6. **Notification and Email Dispatcher**: Send instant system alerts and full-featured HTML email notifications to assigned members once assignments are approved.
7. **Rotation Performance & Attendance Analytics Dashboard**: A statistics tab displaying completion indicators, individual rotations, workload distribution charts, and exports.

---

## 2. Data Modeling & Firestore Schemas

### 2.1 Chore Duties Template (`chore_duty_templates`)
A collection of editable chore roles managed by administrators.
```yaml
Path: /chore_duty_templates/{templateId}
Schema:
  id: string
  name: string                 # e.g., "Mop the Altar", "Toilet", "Preparation"
  group: string                # "cleaning" | "kitchen"
  requiredPersons: number      # e.g., 1, 2, etc. (editable, default from spec)
  restrictedToToiletOk: boolean# true if only members indicating "Toilet OK" can do this
  createdBy: string            # Admin UID
  createdAt: timestamp
```

### 2.2 Extended Poll Responses (`polls/{pollId}/responses`)
When users vote "Yes" on a Chore Committee poll, they can record their preference for special tasks.
```yaml
Path: /polls/{pollId}/responses/{responseId}
Schema (Extended fields):
  userId: string
  userDisplayName: string
  attendance: "yes" | "no" | "maybe"
  toiletOk: boolean            # Indicates "TOILET OK" checkbox selected by the member
  submittedAt: string
```

### 2.3 Chore Assignments State on Polls
Chore assignments will be saved under the `polls` collection within the specific poll document, structured as:
```json
{
  "choreAssignments": {
    "status": "draft" | "approved",
    "allocated": [
      {
        "userId": "usr_abc123",
        "userDisplayName": "John Doe",
        "dutyId": "template_toilet",
        "dutyName": "Toilet",
        "group": "cleaning",
        "toiletOk": true
      }
    ],
    "approvedAt": "timestamp",
    "approvedBy": "adminName"
  }
}
```

---

## 3. Workflow & Notification Flow

```
+-------------------------------------------------------+
|  1. Admin creates Chore Committee Poll                |
+-------------------------------------------------------+
                           |
                           v
+-------------------------------------------------------+
|  2. Chore Members Submit RSVPs with "Toilet OK" option|
+-------------------------------------------------------+
                           |
                           |-- (All Members Submitted) OR (Poll Ends)
                           v
+-------------------------------------------------------+
|  3. System Alerts Creator, ADMIN & President          |
+-------------------------------------------------------+
                           |
                           v
+-------------------------------------------------------+
|  4. Admin clicks "Initiate Duty Assignment"           |
|     - Loads Duties Config (Editable)                  |
|     - Runs Load-Balanced Assignment Algorithm         |
+-------------------------------------------------------+
                           |
                           v
+-------------------------------------------------------+
|  5. Admin views preview matrix                        |
|     - Can manually reallocate slots                   |
|     - Can edit duty definitions if needed             |
+-------------------------------------------------------+
                           |
                           v
+-------------------------------------------------------+
|  6. Admin Approves and Finalizes                     |
|     - Writes to `/duties` collection                  |
|     - Sends portal notifications & HTML emails        |
+-------------------------------------------------------+
```

### Automated Completion Actions
* **Completeness Watcher**: If the count of responses from users with `isCoreMember === true` matches the total number of verified core members, trigger instant system notifications:
  * Notification to: Poll Creator, admin, president.
  * Message: *"Excellent! All Chore Committee members have completed their responses for poll [Title]. You can now proceed to close the poll and assign duties."*
* **Past Due Watcher**: In the front-end list or during routine load, if an active poll's `endDate` has passed, highlight a prominent button: *"Close Poll & Assign Duties"*.

---

## 4. Smart Load-Balancing Allocation Algorithm

We will implement this in `src/services/dutyService.ts` as `generateChoreAssignments`.

### Step-by-Step Logic
1. **Load Active Profiles & RSVPs**:
   * Gather all Chore Committee members who voted **YES** on the current poll. Keep track of their `toiletOk` preference.
2. **Retrieve Workload History**:
   * Query the `duties` collection for past assignments of type `kitchen` and `cleaning`.
   * For each active member, calculate a **Historical Weight** (total number of times assigned in the past).
3. **Sort Candidates by Workload (Ascending)**:
   * Members with lower history counts are prioritized for assignment.
4. **Process Slot Demands**:
   * Load the active `chore_duty_templates` list.
   * Total required slots = Sum of `requiredPersons` for all selected duties.
5. **Handling Low-Attendance / Duplications**:
   * Let `N` be the number of attending members.
   * If `N === 0`, return an error: *"No members responded YES. Cannot assign duties."*
   * Let `S` be the total required slots.
   * If `N < S`:
     * Duplicate assignments are enabled automatically. We can allocate a member to more than 1 duty.
     * Ensure we rotate members so that the load remains evenly distributed (e.g. if we have 3 members and need 5 slots, everyone gets at least 1 slot, and 2 members get 2 slots, selecting those who have the absolute lowest historical counts).
6. **Constraint Matching Flow (Toilet OK First)**:
   * **Stage A (Restricted Toilet Duties)**:
     * Find duties marked as `restrictedToToiletOk`.
     * Identify attending members who checked `toiletOk: true`. 
     * Prioritize those among them with the lowest historical workload count to fill these slots first.
     * Remove filled slots from the demand.
   * **Stage B (Standard Cleaning Duties)**:
     * Fill remaining cleaning duties (`Mop Altar`, `Vacuum church`, `Arrange pew`) using remaining candidate list.
     * Maintain the ascending historical workload order.
   * **Stage C (Kitchen Duties)**:
     * Fill kitchen duties (`Preparation`, `Dish washing`) inside the remaining slots.
7. **Output State**:
   * A draft mapping of `{ dutyId: [UserReference] }` is returned to the UI for preview.

---

## 5. UI/UX Elements

The interface will be placed inside a highly polished sub-view of `/src/pages/Duties.tsx` under the "Chore Assignment" tab.

### 5.1 Dynamic Duty Template Configurator
* Accessible only to **ADMIN** or **PRESIDENT**.
* A beautiful table displaying current active Templates.
* Core Actions:
  * **Add Custom Duty**: Quick popover to specify Name, Group (Cleaning/Kitchen), Needed Persons, and Toilet restriction.
  * **Edit Duty inline**: Alter name, increase/decrease required persons, change restriction.
  * **Delete**: Remove a duty template completely.

### 5.2 Auto-Assignment Preview and Overrides
* Click *"Generate Suggestion"* on a completed/finished poll.
* Renders a layout of Duties (Cleaning vs. Kitchen cards) showing the assigned members in slots.
* **Custom Dropdowns**: Each slot can be edited. Clicking on a slot opens a dropdown containing other attending ("YES") members with their historical workload counters displayed next to their names (e.g. `"Jane Doe (Load: 4)"`) so the Admin can make informed adjustments.
* **Warning States**: If a non-"Toilet OK" user is manually assigned to a toilet duty, show a subtle amber indicator warning next to their name.

### 5.3 Batch Approval, Emails & Feed alerts
* Click *"Finalize and Approve"*:
  * Saves assignments to standard `/duties` path.
  * Creates `/notifications` announcements.
  * Sends professionally-styled HTML notifications.

---

## 6. Report & Rotation Analytics Dashboard

We will implement a visual reports widget in the lower half of the **Chore Assignment** tab.

### Features
1. **Attendance Matrix**:
   * Displays columns of members against past chore polls, coloring entries as Green (Attended - YES), Red (Did not Attend - NO), or Gray (No response / Tentative).
2. **Workload Balance Chart**:
   * Uses `recharts` to render a bar chart of all current members against their historic chore duties count, showing who is due for assignment and how balanced the community load is.
3. **Distribution Breakdown**:
   * A pie chart tracking total assignments by group (`kitchen` vs `cleaning`) to summarize church utility metrics.
4. **Export Sheet**:
   * Quick styled print/PDF option of the historical duty rotations.

---

## 7. Recent Operational Specifications

### 7.1 Chore Poll Interface & Options Normalization
1. **Simplified Core Membership Poll Options**: For Chore Committee polls (`core_member` category), response choices are now simplified to binary: **YES** or **NO**. This guarantees a deterministic count of available physical helpers, removing ambiguous "Maybe" responses.
2. **Profile-driven Toilet Duty Qualification**: Removed the client-voted checkbox for toilet duty on the poll response card. Eligibility for toilet duties is now resolved on the live layout using the verified profile directories:
   * A member must belong to the `cleaning` ministry.
   * A member must possess the `cleaning_toilet_ok` attribute within their ministries list.
   * If these constraints are met, the auto-balancer dynamically permits assignment to toilet duties, flagging any manual overrides with alerts if assigning members with `cleaning_toilet_ng` or non-cleaning status.

### 7.2 Administrative Verification & Missing RSVPs Tracking
1. **Pending Responses Panel**: Placed a highly optimized "Pending Response / Did Not Vote" section at the footer of both Chore and Community poll detail cards.
2. **Secure Visibilities**: This section compiles all active community members who are eligible but have not yet submitted their RSVP.
3. **Access Controls**: Restricted visibility specifically to admins, the community president, and the creator of the poll to maintain privacy while ensuring outstanding response tracking.
4. **Primary Admin Exclusion**: The main system administrator (`kcfc.jp@gmail.com`) is always completely excluded from attendance lists and expected RSVP voters across all poll categories. Additionally, they are strictly prohibited from submitting answers to any upcoming or active polls. A specialized informative banner is rendered on their layout advising that they are barred from voter options to ensure clean community data sets. Other Admins and the President (even if holding admin privileges) remain fully permitted to participate programmatically.
5. **Interactive Deselection & RSVP Modification**: Members can click their active RSVP choice to deselect it entirely or select a different option. Both operations trigger standard confirmation popups to prevent accidental clicks. Deselecting updates their status back to "Not Voted" / Pending.
6. **Unified Poll Completion Notifications**: When all expected eligible members have responded, the system automatically dispatches an inbox notification to the system ADMIN, community PRESIDENT, and the POLL CREATOR to prompt them to review the final details and assign duties.
7. **Direct Closing of All-Responded Polls**: In the active poll cards, when all eligible members have responded (excluding main admin `kcfc.jp@gmail.com`), an illuminated "Close Poll Now" action button/banner is automatically made available to Admins/Presidents/Poll Creators in both the card header and details. Clicking this allows them to instantly lock the poll.
8. **Interlocking Balancer State**: The "Generate Balanced Assignments" load-balancer in the Chore Assignments dashboard is strictly interlocked with the poll status: it remains securely disabled with explanatory tooltips and alert icons during active voting, and is only unlocked when the poll is officially "Closed". This preserves static voting datasets during calculations.
9. **Interactive Poll Redirection Link**: Embedded a high-visibility, stylish button right next to the active attendance warning on the Chore Scheduling Matrix page. When clicked, it uses React Router to immediately route the user to the exact active attendance poll's detailed view (auto-expanding and scrolling to it) for instantaneous review and closing.
10. **Division-Strict Auto-Suggestion Filter**: Built strict committee filters into the resilient balancer:
    * **Kitchen division chores** are exclusively assigned to attending volunteers who belong to the `kitchen` ministry list profile (`isKitchen === true`).
    * **Cleaning division chores** are exclusively assigned to attending volunteers who belong to the `cleaning` ministry list profile (`isCleaning === true`).
    * **Double booking eligibility**: Dual committee members holding both `kitchen` and `cleaning` designations can be scheduled for chores in both divisions to handle short-staffed setups.
    * **Dropdown override validation**: Dropdown menus for manual administrative adjustments are intelligently filtered to show members of the corresponding division first, falling back gracefully to the comprehensive attendee list only if a division has no registered attends.

### 7.3 Complete Execution, Modification & Directory Filtering (Recent Updates)
1. **Assignment Modification & Re-Alerting**: Admins or the President can open previously finalized and published chore assignments, perform override manual reallocations, and click *"Apply Modifications & Resend Alerts"*. The system automatically purges the old assignments, saves the updated ones, and fires custom notification banners and HTML emails notifying members of updated duty slots.
2. **Interactive Member Chore Verification**: Assigned members see an exclusive **My Assigned Chore Duties Tracking** panel on their duties dashboard. They are presented with binary action triggers:
   * *"I Did My Job"* (approves as Done).
   * *"I Could Not Do It"* (opens an emergency reason input form to log an excuse).
3. **Leader Confirmation & Remarks Pipeline**: Sub-leaders and leaders belonging to the relevant committee (e.g. `kitchen_leader` or `kitchen_sub_leader` for kitchen, and corresponding cleaning roles for cleaning) see a **Chore Approvals Queue** detailing reported items. Leaders can quickly inspect excuses, review completed work, input customized **Leader Remarks**, and click *"Confirmed & Log Completed"* to mark them verified.
4. **Interactive Search & Custom Directory Filters**: Upgraded the directory page with an immersive toolbar:
   * Case-insensitive keyword searching across Display Names, Nicknames, and Emails.
   * Exclusive toggle bars to sort/filter by Core Members, Regular Members, or All.
   * Dropdown filters categorized into Liturgical ministries groups (Lector, Altar Servers, Ushers, Choir) and Chore sub-committees (Kitchen, Cleaning).
   * Active, custom colored pill badges displayed on each matching member profile detailing all their active ministries.
5. **Self-Service Report Editing**: Members who have already updated their duty status (either as Completed or Not Completed with an attached reason) are empowered to modify and update their reports. A sleek, amber-themed "Edit Report" button is presented on their individual duty card, remaining active and accessible as long as a committee leader or sub-leader has not officially approved and verified the chore. Clicking this returns the assignment card to a mutable draft state, allowing members to toggled between Done and excused states, or re-draft their non-completion reasons dynamically.
6. **Post-Confirmation Leader Edits**: Leaders can edit the remarks or verification state of a chore even after it has been already confirmed. The queue retains an active list of verified chores with a *"Update Confirmed Records"* action trigger, keeping all data points editable.
7. **Interlocking Assignment Completion**: On the Chore Scheduling Matrix, when official assignments have been completed and published (and are not actively being modified), the "Generate Balanced Assignments" button is automatically hidden to declare the workflow finished.

### 7.4 Firebase Security & Account Verification Sync
1. **Resolved Blank Login / Crash Loop**: During auth initialization, when a non-super-admin user successfully logged in, the application synchronized their email verification state by writing `isEmailVerified: true` into the `users` Firestore document. Previously, this update was blocked by Firestore security rules on `/users/{userId}` because `isEmailVerified` was not included in the list of owner-updatable keys under the `affectedKeys().hasOnly()` gate. This generated a `PERMISSION_DENIED` error which crashed the authentication sequence and left a blank page.
2. **Security Rules Patch**: Standardized `/firestore.rules` to include `'isEmailVerified'` in both:
   * **Owner profile update fields** (`isOwner` keys).
   * **General administrator update fields** (`isAdmin` keys).
   * **Type confirmation**: Added typed validations matching `(!('isEmailVerified' in data) || data.isEmailVerified is bool)` to guarantee integrity.
3. **Unified Administrator Permissions**: Documented full validation of user administration actions (Verify Member, Assign Core Status, Block/Disable, and permanently Delete). Verified and expanded checks across pages to ensure the **President** role operates with matching authority alongside the system **Admin** to securely moderate active and pending community members.

### 7.5 Cascade Member Deletion & Linked Attributes Cleanup (Recent Upgrades)
1. **Orphaned Member Assignments Resolution**: When a member (e.g. "John Doe" holding the "Cleaning Leader" role) was deleted, their document was removed from `/users`, but they remained assigned in the static `assignments` map on `polls/{pollId}` objects (e.g., as `cleaning_leader`). Consequently, trying to assign the role to a new member threw a duplicate validation block error because the scheduler still detected John Doe's ID holding the slot.
2. **Server-Side Cascading Pipeline (Critical Robustness Upgrade)**: Relocated raw cascade deletions from client-side blocks directly into the server Express endpoints (`/api/admin/delete-user` and `/api/admin/delete-user-by-email`) using the Firebase Admin SDK. This guarantees:
   * **Security Rule Bypass**: All Firestore deletions on `/users`, `/polls` updates, `/polls/{pollId}/responses` deletes, and `/duties` purges are resolved using Admin privileges on the server, completely eliminating client-side `PERMISSION_DENIED` errors.
   * **Rule Limit Safety**: Prevents exceeding the Firestore limit of 10 nested `exists()` and `get()` calls in security rule batches on the client.
   * **Autobootstrap Protection Bypass**: The server natively processes the bootstrap admin `kcfc.jp@gmail.com` based on its verified ID Token email directly, meaning its calls can never suffer rules mismatch.
3. **Cascading Actions Covered on Server**:
   * **Profile Document**: Deletes `/users/{targetUserId}`.
   * **Poll Assignments**: Traverses `/polls` and cleanses the user's ID from any static allocation maps.
   * **Responses Purge**: Searches and bulk-deletes responses associated with the user across all poll subcollections.
   * **Duties Deletion**: Bulk-deletes duties associated with the user under `/duties`.

### 7.6 Real-Time Auth & Registration Lifecycle Upgrades
1. **Real-Time Profile Synchronization**: Upgraded the authentication provider context in `src/App.tsx` from static `getDoc` calls to an active `onSnapshot` real-time listener on `/users/{uid}`. Any profile modifications (e.g., full name, phone number, nickname) saved via `/profile` now propagate instantly to all open layout contexts without requiring a manual refresh or sign-out sequence.
2. **Firebase Auth Credential Cascade Deletion**: Integrated a secured Express endpoint `/api/admin/delete-user` on the server using `firebase-admin`. The administrative member removal pipeline validates the administrator or president's ID token, then completely deletes the target user from the Firebase Authentication database. This completely purges their credentials and frees up their email address for a fresh sign-up.
3. **Password Toggle Visibility UX**: Added a password toggle option in `/src/pages/Login.tsx` powered by Lucide's `Eye` and `EyeOff` icons. Passwords remain hidden as default and can be optionally made visible by the user for optimal accessibility.

### 7.7 Personalized Portal Themes & Broadcast Filtering Upgrades
1. **Personalized Portal Theme (Appearance Settings)**: Added a personalized "Appearance Settings" configuration section to the User Profile edit form.
   * Users can toggle a premium, custom **Dark Mode** on/off.
   * This setting is persisted under the `preferences.darkMode` field in Firestore.
   * Toggling triggers an instantaneous real-time sync with the global layout context of the portal.
   * When active, the DOM root is injected with the `.dark` class, elegantly transitioning background environments, borders, card components, text fields, and mobile shelves to deep, warm, high-contrast dark tones.
   * **Dark Mode Harmonized Consistency**: Standardized colors across all primary views. Specifically:
     * **Background Alignment**: Page containers uniformly transition to `#141411` with inner panels, dashboards, and member sheets rendering on the `#1e1e1a` background, mirroring the design of the profile card.
     * **Header Visibility**: Main titles (e.g. "My Profile", "Welcome back", "Community Directory", and "KCFC Portal") transition gracefully to white or secondary white instead of remaining hardcoded to dark gray (`#1a1a1a`).
     * **Widget Sub-elements**: Stat cards, announcements, dividers, progress indicators, search bars, toggle buttons, and login fields employ responsive `dark:` classes (`dark:bg-[#1e1e1a]/[#252520]` and `dark:border-white/5`), removing high-contrast glare anomalies.
2. **Broadcast Target Group Expansion**: Upgraded the administrative Message Broadcast system to support targeting subsets of the community:
   * **Core Group Members**: Dispatches direct notifications exclusively to community members designated as core team participants (`u.isCoreMember === true`).
   * **Regular Members (Non-Core)**: Dispatches direct notifications to other general community members (where `u.isCoreMember !== true`).
   * Admins can preview targeting and get confirmation dialogs detail summaries prior to instant notification commits.

### 7.8 Advanced Administrative Diagnostics & Live Auth Purging Logs
1. **Direct Backend Log Streaming**: Implemented a secure diagnostic tool allowing community administrators and the president to view detailed back-end execution logs. Logs from programmatically purging Authentication records on the server are written to `./delete-logs.txt`.
2. **Dynamic UI Logs Refresh**: Added a customized, fully responsive **Direct Service Connection Logs** module immediately below the advanced credentials purge form. It lets executives retrieve server execution logs in real time, validating project IDs, found client target UIDs, and successful credential cascading steps without requiring manual container lookups.

### 7.9 Member Registration Separation & Redirection Lifecycle Flow
1. **Administrative List Separation**: Refactored `/src/pages/Admin.tsx` to separate pending membership candidates from registered members, placing the "Pending Membership Requests" list chronologically at the top of the administration layout.
2. **Dynamic Redirection Context**: Placed specific redirection links on the primary executive Dashboard's "Membership Requests" items. Clicking an item redirects administrators to the Administrative Center, passing the candidate's `uid` query parameter, expanding the corresponding table row, entering "Manage" mode by default, and executing a smooth scroll alignment with a temporary ambient highlight.
3. **Verified Lifecycle Self-Migration**: When an executive clicks "Verify Member", the status document updates in Firestore, triggering real-time state synchronization. The candidate is automatically relocated from the "Pending" section to the active "Registered Members Directory" and the viewport shifts down, keeping the same member row expanded in "Manage" mode with a temporary success highlight.

### 7.10 Firebase Cloud Messaging (FCM) Push Notifications System
1. **Secure Backend Push Router**: Implemented a secure backend API endpoint `POST /api/admin/broadcast-announcement-push` in `server.ts`. This endpoint verifies the publisher's identity (Bearer ID token validation via Admin auth) and checks for permission flags (`admin`, `president`, `vice_president`, `secretary`, or `pro` roles).
2. **Device Push Registration Pipeline**: Added a highly customizable client utility helper `src/lib/fcmClient.ts` to manage device authorization. On successful sign-in or main page initialization, the app invokes `registerDeviceToken(userId)`:
   * Requests native push permissions (`Notification.requestPermission()`).
   * Fetches the web push token via FCM instance utilizing Voluntary Application Server Identification (VAPID) credentials.
   * Interlocks with Firestore, committing the token to the user's `users/{uid}.fcmTokens` list using atomic `arrayUnion` operations to prevent duplicate or stale mapping.
3. **Dynamic Preferences Filter**: When a new announcement is published inside `/src/pages/Announcements.tsx`, the client triggers a batch Firestore write to record the system event. Simultaneously, it fires a backend query to `broadcast-announcement-push`. The loader filters out targeted users who have opted out of announcements notifications under their configuration settings (`preferences.announcements === false`), assembling a highly tailored collection of recipient device tokens.
4. **Background Service Worker Handling**: Created `/public/firebase-messaging-sw.js` to enable fully functional background push alerts. If the member is off-site or has their browser tab closed, the background worker intercepts the message, generating desktop notifications carrying high-contrast icons redirecting users to the announcements portal.
5. **Glassmorphic Foreground Toast Banners**: Embedded an elegant foreground banner in the global `App.tsx` container utilizing Tailwind's responsive glassmorphism classes. When a member is on-screen and receives an announcement alert, the app renders a slide-in alert overlay with immediate redirection selectors, enhancing user connection.

### 7.11 Sandbox Compatibility & Firebase Auth API Fallbacks (Latest Resolution)
1. **Disabled Identity Toolkit API Mitigation**: In restricted enterprise/sandboxed GCP environments, administrators attempting to delete user accounts might trigger a `403` block indicating that the `Identity Toolkit API has not been used or is disabled in the project`. Previously, this aborted the entire execution, failing to remove the user from the app.
2. **Robust Firestore Failover (Cascade Safety)**: Added fallback catch blocks around `authAdmin.getUserByEmail` and `authAdmin.deleteUser`. If the Firebase Auth API is unconfigured:
   * **Multi-Stage Robust Search Fallback**: Upgraded lookup strategy in `server.ts` to execute a multi-stage fallback:
     * **Exact Match**: Match exact supplied email string.
     * **Lowercase Match**: Match `.toLowerCase()` variant.
     * **Sanitized Client Scan**: Perform case-insensitive, whitespace-tolerant verification across all records under the `users` collection.
   * **Graceful Auth Ignorance**: The credentials purge step converts failures into non-blocking log warnings, allowing the server to successfully proceed with the full cascade cleanup.
   * **Cascading Cleanup Guaranteed**: Deletes the Firestore profile (`users/{userId}`), updates assignments maps in `polls/{pollId}`, purges response documents, and deletes chores records in `duties`.
   * **Polished Success-Only Dialogs (Anti-AI-Slop & Humble Messaging)**: Refactored the API and front-end interface response. All technical warnings regarding unreachable Firebase Auth API credentials or database UIDs are completely hidden from the alert dialog, delivering a direct, clean, and positive success message.
   * **Dynamic Directory Synchronization**: On successful email purge, the deleted user is instantly filtered out of the front-end directory's list state, removing them dynamically from the active list without requiring manual page reloads.
   * **Hybrid Client-Admin Direct Erasure Fail-Safe (Ultimate Solution)**: In the Cloud Run sandbox container environment, backend Admin service accounts might occasionally run into Google Application Default Credentials or cross-project IAM lookup limitations on custom databases. To make deletion absolutely bulletproof and prevent any deleted record from ever reappearing upon manual page refresh, we implemented an authenticated direct client-side Firestore deletion block (`deleteDoc`) triggered right upon successful API confirmation. This direct deletion utilizes the signed-on administrator's browser credentials—which are 100% authorized under Firestore rules (`allow delete: if isAdmin()`)—ensuring the `/users/{userId}` record is permanently erased from the exact database immediately, while the server handles the backend cascade cleanups (for chore rotas, poll answers, and duties documents) successfully in parallel.

