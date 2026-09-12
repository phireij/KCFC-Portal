# KCFC Portal — Member Data Privacy Remediation — 2026-09-12

Branch: `redesign/mobile-first-v2`

Status: **PRODUCTION-READINESS PRIVACY BLOCKER / DESIGN APPROVED FOR BRANCH IMPLEMENTATION ONLY.**

This document does not authorize a production data migration, deletion of existing profile fields, production Firestore rule deployment, or production cutover.

## Finding

The rebuilt Community Directory intentionally renders only public-facing member information. However, several authenticated member/Core/ministry-leader browser surfaces still subscribe to or query the Firestore `users` collection, and the current Firestore rules allow approved users to list `users` documents.

A `users/{uid}` document can contain fields that are not intended for general member exposure, including:

- email;
- birthdate;
- home address;
- phone number;
- notification preferences;
- FCM registration tokens;
- Web Push subscription material; and
- connected communication-app metadata.

Hiding those fields in React is not a data-layer privacy control. Cloud Firestore reads are document-level: once a client is authorized to read a document, rules cannot return only selected fields. Firebase recommends moving fields that require different read permissions into separate documents/collections.

Firestore rules are also not post-query filters. A query must be authorized for its potential result set rather than relying on the UI to discard fields or documents after they arrive.

## Current reachable member-facing direct-list debt

Repository-wide CI discovery identified **seven** reachable member/Core/ministry-leader paths that still list the full `users` collection:

1. `src/pages/Dashboard.tsx` — member Home dashboard. Uses the full user list for member/ministry context even though the member-facing Home experience needs only public-safe identity/eligibility data.
2. `src/pages/Members.tsx` — general Community Directory. Needs public identity/ministry/role fields only. Its one current email dependency is only the legacy bootstrap-account exclusion and is itself scheduled for removal with the projection migration.
3. `src/pages/Duties.tsx` — routine Schedule. Primarily needs member UID/display name for published rosters and assignments.
4. `src/pages/Polls.tsx` — liturgical Availability and assignment workflow. Needs public eligibility/identity fields for UI, but its communication-planning path currently also depends on recipient preferences/connection metadata/tokens and therefore requires a separate private/server-side recipient-resolution design.
5. `src/pages/LegacyPollsImpl.tsx` — preserved Core/legacy poll compatibility. Core members may enter this workspace, so it must not depend on cross-user private profile reads.
6. `src/pages/LegacyDutiesImpl.tsx` — preserved Schedule management/chore compatibility. Ministry/Core leaders can enter this workspace, so public assignment identity should not require broad private-profile reads.
7. `src/components/CommitteeAssignments.tsx` — preserved liturgical assignment tooling reachable by ministry/executive roles. It uses profile identity/ministry data and, in its old email-notification path, can fetch assigned members' full profiles. That notification path must move to a trusted recipient-resolution boundary rather than exposing contact data to the browser.

The containment scan also found existing privileged Leadership/Admin readers, including the focused member-governance workspaces, broadcast tooling and retained Admin compatibility surfaces. These are tracked as a bounded privileged set; their presence must not be used as a reason to preserve broad ordinary-member read access.

`src/pages/LegacyDashboard.tsx` also contains a retained full-users read, but the current `App.tsx` shell does not route/import that legacy page. It is tracked separately so it cannot be silently reintroduced without review.

## Target data boundary

### Public member projection

Introduce a dedicated public-safe member projection, tentatively `member_directory/{uid}`, containing only fields required by authenticated member-facing workflows:

- document/`uid` identity;
- `displayName`;
- `photoURL`;
- `nickname` when the member has supplied one for community display;
- `roles` that are already intentionally displayed in the KCFC directory/schedule experience;
- `ministries`;
- `isCoreMember` where that classification is intentionally part of KCFC workflow eligibility;
- `isVerified`;
- `isDisabled`;
- minimal timestamps if required for synchronization diagnostics.

Do **not** place these fields in the public projection:

- email;
- birthdate;
- home address;
- phone number;
- notification preferences;
- FCM tokens;
- Web Push subscriptions/endpoints/keys;
- connected communication-app account/display metadata;
- credentials, tokens or provider secrets.

### Private profile / communication data

Keep private contact and device-delivery data behind owner/authorized-governance or server-only access. The final implementation may retain the existing `users/{uid}` document as the private canonical profile while member-facing code moves to `member_directory`, or may split high-risk device/contact data into a dedicated private document. Whichever implementation is selected must satisfy the same external contract: ordinary approved members cannot fetch another member's private profile or push endpoint material.

### Communication recipient resolution

Liturgical and broadcast recipient routing must not require an ordinary browser session to download every member's notification preferences, connected-provider metadata, email address or push tokens.

Recipient eligibility/routing for availability-complete, assignment-publication and preserved legacy notification flows should be resolved in an authenticated server-side path (or equivalent trusted backend execution), returning/writing only the resulting notification plan rather than exposing recipient private profile material to the browser.

Caller-supplied arbitrary push-token lists must remain prohibited.

## Target Firestore authorization

After all ordinary/member-leader list consumers have moved off `users`, tighten `users/{uid}` reads so that:

- a signed-in member can read their own private profile;
- explicitly authorized governance roles can read/list private profiles only where required by KCFC administration;
- an ordinary approved member cannot `get` another member's private profile by UID;
- an ordinary approved member cannot list the private `users` collection;
- ministry/Core workflow eligibility must come from the public projection, not private-profile access.

`member_directory` may then be readable by approved members because every field stored there is deliberately safe for that audience.

Do not tighten the existing `users` rules before all reachable member-facing consumers have migrated; doing so prematurely would break Home/Schedule/Availability/Core workflows.

## Synchronization requirement

A public projection introduces consistency risk. The implementation must have one reviewed synchronization path for fields shared between private profile and public projection.

Required synchronization cases include:

- initial verified-member creation/approval;
- display name/photo/nickname updates;
- ministry assignment changes;
- role changes;
- Core-status changes;
- disable/enable changes;
- member removal.

Prefer a trusted backend synchronization boundary where practical. If a transitional client write is used, rules must restrict the exact public fields the owner may change and must prevent a member from self-granting roles, ministries, Core status, verification or enablement.

## Migration plan

### Phase P0 — containment (implemented in repository)

- document the data-layer gap;
- maintain a CI allowlist/classification of current direct `users` list consumers and fail on any new consumer;
- keep the Community Directory presentation free of additional private contact/device fields;
- keep the known bootstrap-email dependency bounded to its current single use;
- do not claim empirical privacy PASS.

### Phase P1 — branch implementation

- add the public-safe member projection type/data access layer;
- migrate Home, Members, routine Duties and routine Polls identity/eligibility reads;
- migrate preserved Core/legacy poll/duty and CommitteeAssignments identity reads;
- move communication recipient resolution off ordinary browser access;
- add Firestore rules for the projection;
- tighten private `users` `get/list` access only after browser consumers are gone;
- replace the containment guard with a zero-member-facing-direct-list enforcement guard.

### Phase P2 — isolated staging migration/acceptance

Using synthetic staging profiles only:

- backfill/create public projection documents;
- verify public projection contains only allowlisted fields;
- deploy the tightened **staging-only** rules;
- verify ordinary member Home/Directory/Schedule/Availability/Core compatibility still works;
- verify ministry-leader assignment workflows still work;
- verify ordinary member cross-user `users/{uid}` reads and `users` list queries are denied;
- verify owner profile access still works;
- verify authorized administration still works;
- verify no FCM token/Web Push subscription/contact fields are exposed through member-facing reads.

### Phase P3 — production migration gate

Production backfill, private-field movement/deletion, Firestore rule deployment and cutover require a separately reviewed migration/rollback plan and explicit production approval. Do not infer that branch/staging success authorizes production data mutation.

## Acceptance criteria

This blocker can be marked GREEN only when all of the following are demonstrated:

1. reachable ordinary/Core/ministry-leader pages no longer list private `users` documents;
2. ordinary members cannot query/list other users' private profiles;
3. ordinary members cannot `get` another user's private profile by known UID;
4. public/member projection contains no private contact or device-delivery fields;
5. Home, Directory, Schedule, Availability and preserved Core workflows remain functional;
6. authenticated self-profile edit/device registration remains functional;
7. authorized leadership/admin workflows remain functional;
8. communication recipient resolution does not expose other members' email/token/subscription material to ordinary browsers;
9. staging rule tests and browser tests pass with synthetic identities; and
10. production migration remains separately approval-gated.

## Current status

**AMBER / BLOCKER OPEN.** The presentation layer avoids intentionally showing private contact details, but the current Firestore document-read boundary does not yet enforce that promise. The current containment guard prevents the set of direct full-profile browser consumers from expanding while migration work proceeds. Do not represent Community Directory/member-profile privacy as fully accepted until the public/private profile boundary above is implemented and empirically verified.
