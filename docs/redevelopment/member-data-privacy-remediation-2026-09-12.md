# KCFC Portal — Member Data Privacy Remediation — 2026-09-12

Branch: `redesign/mobile-first-v2`

Status: **PRODUCTION-READINESS PRIVACY BLOCKER / DESIGN APPROVED FOR BRANCH IMPLEMENTATION ONLY.**

This document does not authorize a production data migration, deletion of existing profile fields, production Firestore rule deployment, or production cutover.

## Finding

The rebuilt Community Directory intentionally renders only public-facing member information. However, the current browser implementation still subscribes directly to the Firestore `users` collection, and the current Firestore rules allow approved users to list `users` documents.

A `users/{uid}` document can contain fields that are not intended for general-directory exposure, including:

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

## Current member-facing direct-list debt

The redevelopment branch currently contains member/core/leader surfaces that directly list `users` and therefore receive the complete documents before rendering only the fields they need:

1. `src/pages/Members.tsx` — general Community Directory. Needs public identity/ministry/role fields only.
2. `src/pages/Duties.tsx` — routine Schedule. Primarily needs member UID/display name for published rosters and assignments.
3. `src/pages/Polls.tsx` — liturgical Availability and assignment workflow. Needs public eligibility/identity fields for UI, but its communication-planning path currently also depends on recipient preferences/connection metadata/tokens and therefore requires a separate private/server-side recipient-resolution design.
4. `src/pages/LegacyPollsImpl.tsx` — preserved Core/legacy poll compatibility. Core members may enter this workspace, so it must not depend on cross-user private profile reads.
5. `src/pages/LegacyDutiesImpl.tsx` — preserved Schedule management/chore compatibility. Ministry/Core leaders can enter this workspace, so public assignment identity should not require broad private-profile reads.

Privileged administrative surfaces also read `users` for legitimate governance/communication operations. Those reads must remain explicitly role-gated and must not be used as a reason to keep broad member read access.

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

Keep private contact and device-delivery data behind owner/authorized-leadership or server-only access. The final implementation may retain the existing `users/{uid}` document as the private canonical profile while member-facing code moves to `member_directory`, or may split high-risk device/contact data into a dedicated private document. Whichever implementation is selected must satisfy the same external contract: ordinary approved members cannot fetch another member's private profile or push endpoint material.

### Communication recipient resolution

Liturgical and broadcast recipient routing must not require an ordinary browser session to download every member's notification preferences, connected-provider metadata or push tokens.

Recipient eligibility/routing for availability-complete and assignment-publication flows should be resolved in an authenticated server-side path (or equivalent trusted backend execution), returning/writing only the resulting notification plan rather than exposing recipient private profile material to the browser.

Caller-supplied arbitrary push-token lists must remain prohibited.

## Target Firestore authorization

After all ordinary member-facing list consumers have moved off `users`, tighten `users/{uid}` reads so that:

- a signed-in member can read their own private profile;
- explicitly authorized governance roles can read/list private profiles only where required by KCFC administration;
- an ordinary approved member cannot `get` another member's private profile by UID;
- an ordinary approved member cannot list the private `users` collection.

`member_directory` may then be readable by approved members because every field stored there is deliberately safe for that audience.

Do not tighten the existing `users` rules before all member-facing consumers have migrated; doing so prematurely would break Schedule/Availability/Core workflows.

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

### Phase P0 — containment (safe in Chat/repository)

- document the data-layer gap;
- maintain a CI allowlist of current direct `users` list consumers and fail on any new consumer;
- keep the Community Directory presentation free of private contact/device fields;
- do not claim empirical privacy PASS.

### Phase P1 — branch implementation

- add the public-safe member projection type/data access layer;
- migrate `Members`, routine `Duties` and routine `Polls` identity/eligibility reads;
- migrate preserved Core/legacy poll and duty identity reads;
- move communication recipient resolution off ordinary browser access;
- add Firestore rules for the projection;
- tighten private `users` `get/list` access only after browser consumers are gone;
- add automated privacy boundary checks.

### Phase P2 — isolated staging migration/acceptance

Using synthetic staging profiles only:

- backfill/create public projection documents;
- verify public projection contains only allowlisted fields;
- deploy the tightened **staging-only** rules;
- verify ordinary member Directory/Schedule/Availability/Core compatibility still works;
- verify ordinary member cross-user `users/{uid}` reads and `users` list queries are denied;
- verify owner profile access still works;
- verify authorized administration still works;
- verify no FCM token/Web Push subscription/contact fields are exposed through member-facing reads.

### Phase P3 — production migration gate

Production backfill, private-field movement/deletion, Firestore rule deployment and cutover require a separately reviewed migration/rollback plan and explicit production approval. Do not infer that branch/staging success authorizes production data mutation.

## Acceptance criteria

This blocker can be marked GREEN only when all of the following are demonstrated:

1. ordinary member-facing pages no longer list private `users` documents;
2. ordinary members cannot query/list other users' private profiles;
3. ordinary members cannot `get` another user's private profile by known UID;
4. public/member projection contains no private contact or device-delivery fields;
5. Directory, Schedule, Availability and preserved Core workflows remain functional;
6. authenticated self-profile edit/device registration remains functional;
7. authorized leadership/admin workflows remain functional;
8. communication recipient resolution does not expose other members' token/subscription material to ordinary browsers;
9. staging rule tests and browser tests pass with synthetic identities; and
10. production migration remains separately approval-gated.

## Current status

**AMBER / BLOCKER OPEN.** The presentation layer avoids showing private contact details, but the current Firestore document-read boundary does not yet enforce that promise. Do not represent Community Directory privacy as fully accepted until the public/private profile boundary above is implemented and empirically verified.
