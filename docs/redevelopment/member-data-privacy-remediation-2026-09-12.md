# KCFC Portal — Member Data Privacy Remediation — 2026-09-12

Branch: `redesign/mobile-first-v2`

Status: **REPOSITORY REMEDIATION AMBER / TRUSTED RECIPIENT-SUMMARY MIGRATIONS SOURCE-COMPLETE / FINAL PRIVATE-READ ROLE REVIEW + ISOLATED-STAGING ACCEPTANCE REQUIRED.**

This document does not authorize a production data migration, deletion of existing profile fields, production Firestore rule deployment, production messaging, production merge, or production cutover.

## Finding

The rebuilt Community Directory intentionally rendered only public-facing member information, but the inherited data model allowed approved users to list complete Firestore `users` documents. Those documents can contain private contact and delivery data such as email, birthdate, home address, phone number, notification preferences, FCM tokens, Web Push subscriptions and connected communication metadata.

Hiding those fields in React is not a data-layer privacy control. Firestore reads are document-level, so fields that require different read permissions need a separate authorization boundary.

## Member-facing remediation completed

The redevelopment branch has **zero ordinary-member/Core/ministry workflow direct full-profile list paths and zero retained-unrouted direct full-profile list paths**. `scripts/verify-member-profile-read-boundary.ts` fails CI if a migrated member-facing surface regresses to direct `users` collection listing or if a new unclassified browser-side full-profile list consumer appears.

The member-facing migration covers:

1. `src/pages/Members.tsx` — Community Directory;
2. `src/pages/Duties.tsx` — routine Schedule;
3. `src/pages/Dashboard.tsx` — routine Home;
4. `src/pages/Polls.tsx` — modern liturgical Availability;
5. `src/pages/LegacyPollsImpl.tsx` — preserved Core/legacy polls;
6. `src/pages/LegacyDutiesImpl.tsx` — preserved Schedule/chore workspace;
7. `src/components/CommitteeAssignments.tsx` — preserved liturgical assignment tooling;
8. `src/components/ChoreCommitteeDashboard.tsx` — chore assignment tooling; and
9. `src/pages/LegacyDashboard.tsx` — retained unrouted dashboard compatibility source.

The retained Legacy Dashboard no longer lists private profiles directly for community statistics. Its member/ministry statistics come from `member_directory`.

## Trusted privileged-summary migrations completed in source

Two additional browser-side private-profile read paths have now been removed from recipient/governance discovery:

- `src/pages/Announcements.tsx` no longer downloads `users` to resolve announcement recipients. Publishing calls authenticated `/api/announcements/publish-notifications`, where audience eligibility, notification records and device routing are resolved on the trusted server.
- `src/lib/privilegedMemberQueries.ts` no longer imports Firestore or reads `users` directly. Pending-member summaries and legacy poll/email recipient summaries are requested through authenticated `/api/admin/member-summaries/*` routes. The server returns only the minimum summary fields required by those workflows.

`scripts/verify-announcement-recipient-boundary.ts` and `scripts/verify-privileged-member-query-boundary.ts` guard these migrations. Caller-supplied arbitrary push-token lists remain prohibited.

The trusted privileged-summary routes authenticate the caller, verify current account state/roles from private server-side profile data, and return bounded response shapes rather than complete member documents.

## Remaining private-browser read review

The broad historical officer/leader read model is **not yet considered final**. Some dedicated Admin/governance surfaces still legitimately inspect private member-account fields, but current Firestore `users` rules still allow complete-profile get/list to the broader inherited `isAdmin()` / `isLeader()` sets.

Before final private-read rules are tightened, each remaining direct private-profile consumer must be mapped to the exact minimum roles and fields its workflow requires. The final rule change must be staged together with those source consumers so a role is neither over-privileged nor accidentally broken.

This is now the principal repository privacy task: complete the remaining Admin/governance consumer-role matrix, narrow `/users` get/list to the smallest justified set, and prove it in isolated staging.

## Public member projection

`member_directory/{uid}` is the authenticated member-facing projection. Its canonical source contract is `src/lib/memberPublicProjection.ts`, and `src/lib/memberDirectoryClient.ts` rejects malformed documents or unexpected fields.

The allowlisted projection fields are:

- `uid`;
- `displayName`;
- `photoURL`;
- optional `nickname`;
- `roles`;
- `ministries`;
- `lcRoles` — assignment-role metadata needed by preserved liturgical assignment workflows; and
- `isCoreMember`.

The projection deliberately excludes email, birthdate, home address, phone number, notification preferences, FCM registration tokens, Web Push subscription endpoints/keys, connected communication-app metadata, credentials, tokens and provider secrets.

`scripts/verify-member-public-projection.ts` binds the TypeScript allowlist to the Firestore rule allowlist and injects private sentinel fields to prove they cannot enter the projection.

## Private profile mutation boundary

The branch now separates broad historical officer capabilities from member-account administration:

- Admin / President can perform managed-member profile/status mutations and member deletion;
- Secretary retains the explicitly used governance mutations for roles, verification, Core status, ministries and liturgical sub-roles;
- Vice President, Auditor, P.R.O. and Spiritual Director no longer inherit managed-member mutation or deletion authority merely because older rules classified them under the broad `isAdmin()` helper;
- member deletion is Admin/President only; and
- the trusted `member_directory` managed-sync route is restricted to Admin/President/Secretary so it matches the roles that can actually mutate projected member fields.

`scripts/verify-member-directory-sync-boundary.ts` fails closed if the broader officer set regains managed-member sync/write/delete authority.

## Private profile read boundary

Current branch rules are stricter than the inherited ordinary-member model, but the final least-privilege read cutover remains open while the last Admin/governance consumers are mapped:

- ordinary approved members use `member_directory` and cannot list private `users`;
- owners can get their own private profile;
- full private-profile list/get remains temporarily available to broader officer/leader roles required by retained governance code.

This is **not** the final target. `/users` get/list rules must be narrowed to the minimum governance roles that demonstrably require complete profiles once the remaining role/consumer matrix is complete.

`scripts/verify-private-user-read-boundary.ts` continues to reject the former ordinary-member-wide rules:

- `allow get: if isSignedIn();`
- `allow list: if isApproved();`

## Member-directory synchronization

The projection has a durable trusted synchronization boundary:

- self profile public-field/photo changes synchronize through a caller-bound trusted route;
- managed verification/role/ministry/status changes synchronize through the governed route;
- authentication paths self-heal eligible projections;
- transient synchronization failures are retried with refreshed authentication, while authorization/validation failures fail immediately;
- verification UI distinguishes a successful private-profile mutation followed by a failed projection refresh, so operators are not told incorrectly that no member data changed; and
- browser `member_directory` create/update/delete remains disabled.

## Communication recipient boundary

Modern liturgical communication, preserved poll notification flows and announcement publishing now resolve recipients through authenticated trusted server routes. Pending governance summaries and legacy email-recipient discovery also use trusted summary routes instead of downloading complete private profiles in the browser.

Staging continues to suppress real Gmail delivery. Repository migration work must not be used to trigger live SMTP or mass messaging.

## Staging projection backfill

`scripts/backfill-member-directory-staging.ts` is non-destructive, dry-run by default and refuses the committed production/default Firebase project. The current projection requires `lcRoles` on every staging projection document; members with no liturgical sub-role receive an empty list.

### Required isolated-staging rollout order

1. confirm the isolated staging Firebase/App Hosting target;
2. confirm the staging backfill produces the full current projection including `lcRoles`;
3. run the staging backfill in **dry-run** mode and review counts/target identity;
4. apply the backfill to isolated staging only;
5. inspect staging `member_directory` documents and verify that every document contains only allowlisted public fields;
6. deploy the updated **staging-only** projection rules and application;
7. verify projection synchronization/self-healing and trusted announcement/member-summary server routes;
8. after the final private-profile role/consumer matrix is source-complete, deploy the tightened **staging-only** private `users` read rules;
9. verify the complete role/access matrix; and
10. retain rollback/redeployability evidence before any production proposal.

## Isolated-staging acceptance matrix

Using synthetic staging identities/data only, verify:

- ordinary member can read their own private `users/{uid}` profile;
- ordinary member cannot list private `users`;
- ordinary member cannot get another member's private profile by known UID;
- ordinary approved member can read `member_directory`;
- projection documents contain no contact/device/private fields;
- authorized governance roles can perform only their intended member-admin actions;
- VP/Auditor/P.R.O./Spiritual Director cannot mutate/delete managed member profiles merely through direct Firestore calls;
- Community Directory, Home, Schedule, Availability, Legacy Polls/Duties and assignment tooling work from public projection state;
- announcement creation/publishing works through trusted recipient resolution without browser `users` collection access;
- pending-member summaries expose only their bounded governance response shape;
- legacy poll/assignment recipient lookup exposes only the bounded email-recipient response shape;
- explicit manager email actions remain suppressed in staging;
- self-profile edit/device registration remains functional; and
- no FCM token/Web Push subscription/contact field is exposed through member-facing reads.

## Production migration gate

Production projection backfill, private-field movement/deletion, Firestore rule deployment, website cutover, production messaging and production merge/deploy remain separately approval-gated. Branch and staging success do not authorize production mutation.

A production migration proposal must include exact production target identity, dry-run/backfill plan, rollback path, rule deployment order, smoke/role test matrix, backup/redeployability evidence and explicit user approval.

## Acceptance status

### Repository implementation

**AMBER / FINAL ROLE REVIEW OPEN.** Ordinary-member/Core/ministry-facing private-profile list debt is closed, the public projection and trusted synchronization boundary are source-controlled, announcement recipient discovery is server-side, and privileged pending/legacy-recipient summary discovery is server-side. The remaining task is to map the direct Admin/governance private-profile consumers to exact minimum roles and tighten the private `users` read rules accordingly.

### Isolated staging

**AMBER / OPEN.** The updated projection/backfill, trusted summary/announcement routes and eventual final private-profile rules require empirical isolated-staging deployment and role/browser verification.

### Production

**NOT AUTHORIZED.** No production privacy backfill/rule deployment/cutover, production messaging, merge or deploy is authorized by this document.
