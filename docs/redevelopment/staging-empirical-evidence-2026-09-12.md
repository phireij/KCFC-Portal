# KCFC Portal — Empirical Staging Evidence — 2026-09-12

Branch under test: `redesign/mobile-first-v2`
Repository checkpoint before this evidence record: `e7dbdb7946419f0ec70c661e7f4aaea0257ab9d9`
Production baseline: `main` = `653cc7229600fd7baff17a21a21f12d267b66d2b`

Status: **PARTIAL EMPIRICAL STAGING PASS.** This record captures observations from the isolated Firebase/App Hosting staging environment. It does not authorize production merge/deploy and does not convert unobserved staging, browser, notification, backup, or rollback cases into PASS.

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

These observations support the following limited conclusions:

1. The deployed staging UI is reachable through an authenticated session.
2. The authenticated member profile path is functioning for the corrected staging login.
3. The staging-only visual environment marker is present in the deployed UI.
4. Inbox notification query acceptance is **not yet complete** because the required staging Firestore composite index was still building at the observation time.
5. No production action is implied or authorized by this evidence.

## Still open / must not be inferred

The following remain empirical gates unless separately recorded elsewhere with direct provider/runtime evidence:

- exact staging Firebase project ID;
- App Hosting backend name;
- generated staging URL/hostname;
- rollout/revision identifier and provider deployment status;
- real deployed `/api/health` HTTP success and exact allowlisted response;
- `runtime: "staging"` plus isolated Firebase project and Firestore `(default)` identity from `/api/health`;
- proof that `/api/health` exposes no unexpected/secret fields;
- saved health JSON passing `npm run staging:evidence -- <health-json>` against the protected staging environment;
- completion of the Inbox composite index followed by authenticated Inbox regression verification;
- representative responsive browser QA;
- representative synthetic role/authorization matrix;
- physical iPhone PWA/Web Push acceptance;
- physical Android tablet acceptance;
- multi-device valid/stale endpoint behavior; and
- provider/environment backup and exact rollback/redeployability evidence.

## Inbox follow-up gate

Do not mark Inbox staging acceptance complete until the provider reports the composite index as ready and the deployed authenticated app is re-tested for:

- Inbox list load without an index-required error;
- newest-first notification ordering for the signed-in staging user;
- list → detail navigation;
- `?tab=` filter history/reload behavior;
- selected-message state preservation where applicable; and
- no cross-user notification exposure.

## Approval gates preserved

This evidence does **not** authorize:

- merging Draft PR #1;
- deploying or cutting over production;
- production data migration/restoration;
- production Core-status mutation;
- activation of LINE, Telegram, WhatsApp, or Viber connectors;
- live mass messaging;
- public website cutover; or
- any other separately approval-gated production-sensitive action.
