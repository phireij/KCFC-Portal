# KCFC Portal — Member Data Privacy Remediation — 2026-09-12

Branch: `redesign/mobile-first-v2`

Status: **REPOSITORY IMPLEMENTATION GREEN / ISOLATED-STAGING ACCEPTANCE REQUIRED.**

This document does not authorize a production data migration, deletion of existing profile fields, production Firestore rule deployment, or production cutover.

## Finding

The rebuilt Community Directory intentionally rendered only public-facing member information, but the inherited data model allowed approved users to list complete Firestore `users` documents. Those documents can contain private contact and delivery data such as email, birthdate, home address, phone number, notification preferences, FCM tokens, Web Push subscriptions and connected communication metadata.

Hiding those fields in React is not a data-layer privacy control. Firestore reads are document-level, so fields that require different read permissions need a separate authorization boundary.

## Repository remediation completed

The redevelopment branch now has **zero reachable member/Core/ministry-leader direct full-profile list paths and zero retained unrouted direct full-profile list paths**. `scripts/verify-member-profile-read-boundary.ts` fails CI if a migrated surface regresses to direct `users` collection listing or if a new unclassified browser-side full-profile list consumer appears.

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

The retained Legacy Dashboard no longer lists private profiles directly. Its community/member/ministry statistics now come from `member_directory`, while its leadership-only pending-registration cards use the audited `subscribePendingMembers()` helper, which returns only the narrow governance summary needed by that UI. This removes the former special-case unrouted privacy allowance, so re-routing that file cannot silently restore broad private-profile reads.

Privileged Leadership/Admin profile readers remain a bounded, explicit set because governance workflows legitimately require private member data. Their existence does not grant ordinary members access.

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

`lcRoles` was added only after the final assignment migration proved it was required for legitimate role eligibility. It is not contact or device-delivery data.

The projection deliberately excludes:

- email;
- birthdate;
- home address;
- phone number;
- notification preferences;
- FCM registration tokens;
- Web Push subscription endpoints/keys;
- connected communication-app metadata; and
- credentials, tokens or provider secrets.

`scripts/verify-member-public-projection.ts` binds the TypeScript allowlist to the Firestore rule allowlist and injects private sentinel fields to prove they cannot enter the projection.

## Private profile boundary

The branch-only Firestore rule contract now restricts `users/{uid}` reads to:

- **get:** the profile owner, Admin, or Leader;
- **list:** Admin or Leader only.

Ordinary approved members continue to read `member_directory`, not other members' private `users` documents.

`scripts/verify-private-user-read-boundary.ts` is wired into `npm run lint` and explicitly rejects the old broad rules:

- `allow get: if isSignedIn();`
- `allow list: if isApproved();`

This rule cutover is **source-controlled only** at this stage. It has not been deployed to Firebase from Chat mode.

## Communication recipient boundary

Member-facing communication flows no longer require ordinary browser sessions to download every member's contact/device routing material.

Modern liturgical communication uses authenticated trusted server routes for:

- availability-request notification;
- availability-complete notification;
- roster planning; and
- roster publication.

Preserved legacy poll communication uses authenticated trusted server routes for:

- poll publication notification;
- poll completion notification; and
- Core-poll close notification.

Recipients are derived from trusted profile state server-side; callers do not submit arbitrary recipient UIDs, emails or push tokens. Idempotency markers prevent duplicate Portal notification creation on retries.

Explicit manager-only legacy email actions resolve email addresses only when the authorized send action runs, through `listPrivilegedPollEmailRecipients()` in `src/lib/privilegedMemberQueries.ts`. Email addresses are no longer kept in ordinary assignment/member-list state.

Staging continues to suppress real Gmail delivery. Repository migration work must not be used to trigger live SMTP or mass messaging.

## Staging projection backfill

`scripts/backfill-member-directory-staging.ts` is non-destructive, dry-run by default and refuses the committed production/default Firebase project. The current projection now requires `lcRoles` on every staging projection document; members with no liturgical sub-role must receive an empty list.

### Required isolated-staging rollout order

The order is deliberate because the strict client parser now requires `lcRoles`:

1. confirm the isolated staging Firebase/App Hosting target;
2. confirm the staging backfill produces the full current projection including `lcRoles`;
3. run the staging backfill in **dry-run** mode and review counts/target identity;
4. apply the backfill to isolated staging only;
5. inspect staging `member_directory` documents and verify that every document contains only allowlisted public fields;
6. deploy the updated **staging-only** `member_directory` rules;
7. deploy/test the application against the staging projection;
8. only after member-facing paths work, deploy the tightened **staging-only** private `users` read rules;
9. verify the complete role/access matrix; and
10. retain rollback/redeployability evidence before any production proposal.

Do not deploy the strict private `users` rule before the staging projection/backfill is complete and usable.

## Isolated-staging acceptance matrix

Using synthetic staging identities/data only, verify:

- ordinary member can read their own private `users/{uid}` profile;
- ordinary member cannot list private `users`;
- ordinary member cannot get another member's private profile by known UID;
- ordinary approved member can read `member_directory`;
- projection documents contain no contact/device/private fields;
- Admin/authorized Leader can get/list private profiles required for governance workflows;
- Community Directory works;
- routine Home works, including its separately privileged pending-registration count for authorized leadership;
- retained Legacy Dashboard remains compatible if deliberately exercised, with public statistics from `member_directory` and pending summaries behind the privileged helper;
- routine Schedule works;
- modern Availability response/leader/roster workflows work;
- preserved Legacy Polls works;
- preserved Legacy Duties works;
- CommitteeAssignments role eligibility works with projected `lcRoles`;
- ChoreCommitteeDashboard assignment workflows work;
- explicit manager email actions remain suppressed in staging and do not expose recipient email addresses in ordinary member state;
- self-profile edit/device registration remains functional; and
- no FCM token/Web Push subscription/contact field is exposed through member-facing reads.

## Production migration gate

Production projection backfill, private-field movement/deletion, Firestore rule deployment, website cutover and production merge/deploy remain separately approval-gated. Branch and staging success do not authorize production mutation.

A production migration proposal must include at minimum:

- exact production target identity;
- dry-run/backfill plan;
- rollback path;
- rule deployment order;
- smoke/role test matrix;
- backup/redeployability evidence; and
- explicit user approval.

## Acceptance status

### Repository implementation

**GREEN.** Reachable and retained-unrouted browser direct full-profile list debt is zero; the public projection, privileged governance summaries, assignment metadata boundary, trusted recipient-resolution paths and restrictive private-profile rule contract are source-controlled and CI-guarded.

### Isolated staging

**AMBER / OPEN.** The updated projection/backfill and tightened private-profile rules still require empirical isolated-staging deployment and role/browser verification. Do not represent the privacy blocker as fully accepted until those staging checks pass.

### Production

**NOT AUTHORIZED.** No production privacy backfill/rule deployment/cutover is authorized by this document.