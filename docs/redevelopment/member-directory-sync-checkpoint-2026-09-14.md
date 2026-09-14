# KCFC Portal — Member Directory Synchronization Checkpoint — 2026-09-14

Branch: `redesign/mobile-first-v2`

Status: **REPOSITORY IMPLEMENTATION GREEN / ISOLATED-STAGING ACCEPTANCE REQUIRED.**

This checkpoint does not authorize production deployment, production backfill, production Firestore rule changes, destructive migration, or production messaging.

## Problem closed in the branch

The `member_directory/{uid}` projection had a safe staging backfill and strict read-boundary design, but it also needed a durable synchronization path after ordinary profile/governance mutations. Without that path, a later display-name/photo/role/ministry/verification/disable/delete change could leave a stale public projection.

The branch now resolves that consistency risk through trusted server synchronization.

## Trusted synchronization routes

`server/memberDirectorySyncRoutes.ts` registers authenticated routes that derive projection contents exclusively from the canonical private `users/{uid}` document and `toMemberDirectoryProfile()`:

- `POST /api/member-directory/sync-self` — caller-bound; the Firebase ID token determines the UID. The browser cannot choose another member.
- `POST /api/admin/member-directory/sync` — governed target sync for the bootstrap admin or active Admin/President roles only.

If the private profile is missing, unverified, disabled, or otherwise excluded by the canonical projection function, synchronization deletes the corresponding `member_directory` document. Eligible profiles are replaced with the exact allowlisted projection.

The routes never return another member's private profile/contact/device data.

## Mutation coverage

Projection refresh is now wired after the branch's relevant public-field/status mutations:

- self Profile display-name/nickname and photo changes;
- focused pending-member verification;
- focused roles/ministry/liturgical-sub-role edits;
- preserved Legacy Admin public profile, role/ministry, verification, Core-status and enabled/disabled mutations; and
- destructive server-side member deletion, which now removes the public projection together with the private profile.

The client helper is `src/lib/memberDirectorySyncClient.ts` and always sends the current Firebase ID token.

## Browser write boundary

`member_directory` remains readable only by approved authenticated members, but browser create/update/delete access is now disabled in `firestore.rules`:

`allow create, update, delete: if false;`

Projection writes are performed only by trusted Firebase Admin execution (including the staging backfill), which does not depend on browser Firestore write permissions.

`scripts/verify-member-public-projection.ts` and the new `scripts/verify-member-directory-sync-boundary.ts` enforce this rule and the required synchronization markers in CI.

## Backfill hardening

`scripts/backfill-member-directory-staging.ts` remains staging-only, refuses the committed production/default project and remains dry-run by default.

The dry-run now also reports existing and stale projection counts. The apply path refuses to continue if stale `member_directory` documents are detected, because the backfill is intentionally non-destructive and must not silently leave deleted/disabled/ineligible members visible in the public projection.

That refusal is deliberate. Any stale-document cleanup must be reviewed in the isolated staging environment before proceeding.

## Validation

The fail-closed one-shot integration workflow completed successfully at repository commit:

`70883136d2b4e4291e2d0cdc9722b48880dd5d4f`

It required:

- synchronization-boundary verifier PASS;
- the complete `npm run lint` contract PASS;
- production-style build PASS; and
- removal of the temporary one-shot patch workflow/script before the resulting application commit.

A normal human-authored exact-head CI checkpoint follows this evidence commit and should be used as the retained staging-source artifact once GREEN.

## Required isolated-staging proof

Repository correctness is not empirical provider acceptance. Before privacy staging can be marked GREEN:

1. verify the exact isolated Firebase/App Hosting target;
2. run the projection backfill dry-run and review source/projection/stale counts;
3. resolve any reported stale projections before apply;
4. apply the current projection to isolated staging only;
5. inspect representative documents for allowlisted fields only;
6. deploy the current staging rules and application revision;
7. verify self profile edits immediately update the projection;
8. verify Admin verification/role/ministry/status mutations update or remove the projection correctly;
9. verify member deletion removes the public projection;
10. verify ordinary browsers cannot write `member_directory` directly;
11. verify ordinary members cannot list/get other members' private `users` profiles; and
12. retain rollback/redeployability evidence.

Production remains separately approval-gated.