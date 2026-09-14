# KCFC Portal — Empirical Staging Evidence — 2026-09-12

Branch under test: `redesign/mobile-first-v2`
Deployed/repository checkpoint associated with the original Work-mode observation: `e7dbdb7946419f0ec70c661e7f4aaea0257ab9d9`
Production baseline: `main` = `653cc7229600fd7baff17a21a21f12d267b66d2b`

Status: **PARTIAL EMPIRICAL STAGING PASS.** This record captures observations from the isolated Firebase/App Hosting staging environment. It does not authorize production merge/deploy and does not convert unobserved staging, browser, notification, privacy-migration, backup, or rollback cases into PASS.

## Important checkpoint distinction

The empirical observations below were made before the later member-data privacy remediation was completed in the repository. The current redevelopment branch has since added:

- a sanitized `member_directory/{uid}` projection;
- `lcRoles` assignment metadata in that projection;
- migration of reachable member-facing full-profile list readers to the projection/trusted boundaries;
- trusted backend recipient resolution for modern and preserved poll communication;
- zero reachable member-facing direct full-profile list debt enforced by CI; and
- tightened branch-only private `users` read rules.

Those later privacy changes are repository-side implementation evidence only. They have **not** been empirically deployed/accepted in the staging environment by this record. A newer staging rollout must use the live validated branch head recorded in Draft PR #1 and follow the ordered privacy rollout in `staging-deployment-runbook-2026-09-11.md`.

## Verified in Work mode

The following were empirically observed in the staging environment after correcting the test login email address:

- authenticated staging login succeeds;
- the logged-in profile loads successfully;
- the visible environment banner is present and reads `STAGING • TEST ENVIRONMENT`;
- a staging-only Firestore composite index was created for Inbox notifications with fields `userId` ascending and `createdAt` descending;
- at the time of observation, that Firestore index status was `Building` and had not yet reached Ready/Enabled state;
- no production changes were made;
- no production messages were sent; and
- no external messaging connectors were enabled.

## Evidence interpretation

These observations support only the following conclusions:

1. The deployed staging UI was reachable through an authenticated session.
2. The authenticated member profile path functioned for the corrected staging login.
3. The staging-only visual environment marker was present in the deployed UI.
4. Inbox notification query acceptance was **not complete** because the required staging Firestore composite index was still building.
5. The later public/private member-profile architecture has not yet been empirically accepted in staging.
6. No production action is implied or authorized by this evidence.

## Still open / must not be inferred

The following remain empirical gates unless separately recorded elsewhere with direct provider/runtime evidence:

- exact staging Firebase project ID;
- App Hosting backend name;
- generated staging URL/hostname;
- rollout/revision identifier and provider deployment status;
- real deployed `/api/health` HTTP success and exact allowlisted response;
- `runtime: "staging"` plus isolated Firebase project and Firestore `(default)` identity from `/api/health`;
- proof that `/api/health` exposes no unexpected/secret fields;
- saved health JSON passing `npm run staging:evidence -- <health-json>`;
- completion/readiness of both required composite indexes followed by browser verification;
- staging `member_directory` dry-run/apply backfill using the current schema including `lcRoles`;
- updated staging projection-rule deployment and public-field inspection;
- migrated member-facing workflow verification against the projection;
- tightened staging private `users` rule deployment and self/cross-user/list/governance access tests;
- corrected staging Treasury role/rule tests;
- representative responsive browser QA;
- physical iPhone PWA/Web Push acceptance;
- physical Android tablet acceptance;
- multi-device valid/stale endpoint behavior; and
- provider/environment backup and exact rollback/redeployability evidence.

## Required privacy staging sequence

Do not tighten staging private `users` reads before the projection is ready. The minimum safe sequence is:

1. confirm exact isolated staging target;
2. dry-run current staging member-directory backfill;
3. apply the non-destructive isolated-staging backfill, ensuring every projection document includes `lcRoles` (empty list when none);
4. inspect representative projection documents for allowlisted fields only;
5. deploy updated staging `member_directory` rules;
6. deploy/test current application member-facing paths against the projection;
7. then deploy tightened staging private `users` rules;
8. verify ordinary self-profile access, ordinary cross-user/list denial, approved projection access and authorized Admin/Leader private-profile access;
9. verify the synthetic Treasury role matrix; and
10. capture rollback/redeployability evidence.

If projection compatibility fails, do not restore broad ordinary-member private-profile reads as a workaround.

## Inbox/index follow-up gate

Do not mark Inbox staging acceptance complete until the provider reports `notifications(userId ASC, createdAt DESC)` as ready and the deployed authenticated app is re-tested for:

- Inbox list load without an index-required error;
- newest-first ordering for the signed-in staging user;
- list → detail navigation;
- `?tab=` filter history/reload behavior;
- selected-message state preservation where applicable; and
- no cross-user notification exposure.

Also verify the declared `polls(category ASC, createdAt DESC)` staging index and exercise preserved Schedule `Plan & manage` without an index error.

## Approval gates preserved

This evidence does **not** authorize:

- merging Draft PR #1;
- deploying or cutting over production;
- production member-directory backfill or privacy-rule deployment;
- production data migration/restoration;
- production Core-status mutation;
- activation of LINE, Telegram, WhatsApp, or Viber connectors;
- live mass messaging;
- public website cutover; or
- any other separately approval-gated production-sensitive action.