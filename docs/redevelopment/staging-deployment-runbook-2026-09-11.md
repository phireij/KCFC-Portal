# KCFC Portal — Isolated Staging Deployment Runbook — 2026-09-11

Branch: `redesign/mobile-first-v2`

Status: **readiness procedure only.** This runbook does not authorize production deployment, production credential use, production data access, connector activation, production messaging, destructive migration, or any production mutation.

## Purpose

Provide one provider-neutral procedure for turning the validated redevelopment branch into an **isolated staging environment** suitable for browser and physical-device QA. The procedure consumes the repository's fail-closed staging contracts instead of relying on implicit provider defaults.

Before every staging deployment, verify the **live** branch head and Draft PR #1 instead of relying on a hard-coded historical SHA. As of the 2026-09-14 privacy/readiness checkpoint, the fully validated repository head is `f555ca31686e3eba77ab35f5eeb7bb07adc6064c`, with push CI #1935 / id `34838644929` and exact-head PR CI #1936 / id `34838648676` both successful. The retained PR manifest is artifact `10345161758`, digest `sha256:c46ec4a28b6879b2856ea82a79ab9e43e660e75b08a505955407e3908b60d240`, retained through 2026-10-14. If the live branch has advanced, use the newer validated SHA and evidence recorded in Draft PR #1.

## Non-negotiable isolation rules

1. The staging Firebase project ID must differ from the committed production/default project ID.
2. Client and server must target the same isolated staging Firebase project and Firestore database.
3. Firebase Admin credentials / workload identity must authorize **only the staging project** for this deployment. Do not mount, copy or reuse a production service-account key.
4. Use synthetic staging identities and synthetic staging data only. Do not import production member records as a convenience.
5. Use a dedicated staging Web Push VAPID pair. Do not reuse production VAPID private material.
6. Every external messaging connector flag remains `false`.
7. `KCFC_CORE_STATUS_STAGING_EXECUTOR_ENABLED=false` remains the default for normal staging QA.
8. The running UI must visibly show `Staging • Test environment` before any synthetic account/device registration is performed.
9. Stop immediately if the running environment exposes the committed production/default Firebase project, production member data, production credentials, or any production-only endpoint/configuration.
10. Do **not** deploy the tightened private `users` read rules before the staging `member_directory` projection is backfilled with the current schema and verified usable by the deployed application.

## Required staging resources

These resources must exist before the actual deployment is attempted. Provisioning them is an external/provider action and is **not performed by this runbook itself**.

- An isolated Firebase / Google Cloud project dedicated to KCFC staging.
- A Firestore database in that staging project. Use the default database unless there is a deliberate reviewed reason to use a named database.
- Firebase Authentication configured only for the test sign-in methods required by the staging matrix.
- A staging web application registration with its own client Firebase configuration.
- A server runtime identity using Application Default Credentials, workload identity, or an equivalent provider mechanism, scoped to the staging project only.
- A dedicated staging VAPID public/private key pair.
- A non-production HTTPS application URL suitable for PWA/Web Push testing.
- A provider deployment target capable of running Node.js and the built `dist/server.cjs` server.

If any of these resources would incur billing beyond the approved staging ceiling, alter an existing production account/resource, or require production secrets, stop for the applicable approval.

## Required environment contract

Do not place real secrets in Git, screenshots, PR text, or QA notes. Configure them through the hosting provider's protected environment/secret facility.

### Runtime identity

```text
VITE_KCFC_RUNTIME_ENV=staging
KCFC_RUNTIME_ENV=staging
```

Both are mandatory. The application and `staging:preflight` fail closed if staging is only partially declared. Also set `APP_URL` to the exact non-production HTTPS staging origin; both preflight and server startup reject a missing, non-HTTPS, or production-Portal `APP_URL`.

### Firebase client configuration

Provide explicit staging values for:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET       # when applicable
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_DATABASE_ID          # blank for default DB, or explicit reviewed named DB
```

### Firebase server configuration

Provide corresponding staging values for:

```text
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
FIREBASE_STORAGE_BUCKET            # when applicable
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_APP_ID
FIREBASE_DATABASE_ID               # must match the client DB selection
```

`VITE_FIREBASE_PROJECT_ID` and `FIREBASE_PROJECT_ID` must be identical to each other and different from the committed production/default project ID.

The Node server initializes Firebase Admin with the configured project ID and relies on the runtime's normal Firebase Admin authentication mechanism. Project-ID environment variables alone are **not** sufficient authorization: the deployment runtime must also have staging-only Application Default Credentials / workload identity permissions.

### Web Push / notification keys

Provide one staging-only VAPID pair:

```text
VITE_FCM_VAPID_KEY=<staging public key>
WEB_PUSH_VAPID_PUBLIC_KEY=<same staging public key>
WEB_PUSH_VAPID_PRIVATE_KEY=<staging private key, server-only>
```

The browser public key and server public key must match. The private key must never use a `VITE_*` name or otherwise enter the browser bundle. When `KCFC_RUNTIME_ENV=staging`, the server fails closed if either explicit server VAPID key is missing. Staging must never continue with cached, Firestore, or generated VAPID material after Web Push initialization failure.

### Safety gates

Keep all of these exactly false for the initial staging deployment:

```text
KCFC_CORE_STATUS_STAGING_EXECUTOR_ENABLED=false
KCFC_CONNECTOR_LINE_ENABLED=false
KCFC_CONNECTOR_TELEGRAM_ENABLED=false
KCFC_CONNECTOR_WHATSAPP_ENABLED=false
KCFC_CONNECTOR_VIBER_ENABLED=false
VITE_KCFC_LINE_CONNECTOR_ENABLED=false
VITE_KCFC_TELEGRAM_CONNECTOR_ENABLED=false
VITE_KCFC_WHATSAPP_CONNECTOR_ENABLED=false
VITE_KCFC_VIBER_CONNECTOR_ENABLED=false
```

Provider credentials for LINE, Telegram, WhatsApp or Viber are not needed for baseline staging QA and should remain absent.

For baseline staging, server SMTP delivery is fail-safe/simulated. Any future real SMTP acceptance test remains a separately approved action using synthetic/test recipients.

## Pre-deployment gate

From the exact branch commit intended for staging, with the protected staging environment loaded:

```bash
npm ci
npm run staging:preflight
npm run lint
npm run build
```

Do not continue if any command fails.

Retain the safe `staging:preflight` output as evidence. It should record only staging project/database identity, runtime markers, connectors OFF, Core-status executor OFF, and presence/parity of staging VAPID material. Never retain secrets, tokens, PushSubscription endpoints, FCM tokens or member personal data.

## Member privacy migration gate — required order

The current application uses the sanitized `member_directory/{uid}` projection and the strict parser requires the current schema:

```text
uid
displayName
photoURL
nickname?
roles[]
ministries[]
lcRoles[]
isCoreMember
```

`lcRoles` is assignment-role metadata. Members without an applicable liturgical sub-role must still have `lcRoles: []` in the staging projection.

Proceed in this exact order:

1. Verify the exact isolated staging Firebase project/database before running any backfill.
2. Confirm `scripts/backfill-member-directory-staging.ts` targets the isolated staging project and generates the current projection schema including `lcRoles`.
3. Run the backfill **dry-run first** and inspect only safe counts/target identity.
4. Apply the non-destructive backfill to isolated staging only.
5. Inspect representative `member_directory` documents and verify only allowlisted fields are present.
6. Deploy the updated **staging-only** `member_directory` rule block.
7. Deploy/open the current staging application and verify member-facing pages can consume the projection.
8. Test Community Directory, Home, Schedule, modern Availability, Legacy Polls, Legacy Duties, CommitteeAssignments and ChoreCommitteeDashboard.
9. Only after steps 1–8 pass, deploy the tightened **staging-only** private `users` read rules.
10. Verify the private/public access matrix:
   - ordinary member can `get` only their own private profile;
   - ordinary member cannot list private `users`;
   - ordinary member cannot `get` another member's private profile by known UID;
   - approved ordinary member can read `member_directory`;
   - Admin/President can get/list private profiles required for member administration;
   - Vice President, Secretary, Auditor, P.R.O., Spiritual Director and ministry leaders do not gain broad cross-member private-profile read/list access merely from their role.
11. Verify self-profile edit/device registration remains functional.
12. Verify explicitly authorized Secretary governance mutations still work without granting Secretary broad private-profile read/list access.
13. Verify explicit manager email actions remain suppressed/simulated in staging and do not place member emails into ordinary assignment state.

If any member-facing page fails because the projection is absent/malformed, **do not** work around it by restoring broad ordinary-member `users` reads. Fix the isolated staging projection/backfill instead.

## Pending pre-registration claim gate

Use synthetic staging identities only. The purpose is to prove that tightening private `users` reads did not break pre-registered member onboarding and that the browser cannot use pending profiles as a private-data side channel.

1. Create a synthetic unverified pending member through the normal staging pre-registration workflow.
2. Confirm the pending document stores the exact normalized synthetic email and that the new document ID is based on the full normalized email, not only the local-part.
3. Create/sign in to Firebase Authentication with the **same exact email**.
4. Confirm the application calls the authenticated trusted claim route and the pending profile is claimed into `users/{authenticatedUid}`.
5. Confirm the original pending document is removed only as part of the successful trusted transaction.
6. Confirm the claimed profile retains the intended roles/ministries/status fields and that `member_directory` is created only when the resulting profile is eligible for the public projection.
7. For an unverified synthetic account, confirm `isEmailVerified` remains false unless Firebase Auth or the stored pending profile explicitly provides verified state; confirm the email-verification holding state remains reachable.
8. From an ordinary browser session, confirm direct Firestore `get`/`list` access to another pending/private profile is denied by the tightened rules.
9. Collision test: pre-register `person@example.com` and `person@other.example` (or equivalent synthetic addresses) and confirm they produce distinct pending document IDs and can each be claimed only by an authenticated account with the exact matching email.
10. Legacy compatibility test: create a synthetic historical-style `pending_<localpart>` staging record with an exact stored email, then confirm the trusted route can claim it by email without relying on its legacy ID format.
11. Confirm duplicate non-pending profiles or multiple pending profiles for one exact email fail closed rather than choosing a record heuristically.
12. Retain only non-secret PASS/FAIL evidence; never record Firebase ID tokens or synthetic passwords.

Failure of this gate must not be worked around by restoring browser read/delete access to arbitrary `pending_*` private documents.

## Firestore composite-index gate

Before accepting the relevant browser workflows, confirm both declarative indexes are ready in isolated staging:

- `notifications`: `userId ASC`, `createdAt DESC` — required by Inbox;
- `polls`: `category ASC`, `createdAt DESC` — required by preserved Schedule-management polling.

The Inbox index was empirically observed as **Building** on 2026-09-12. Do not infer that it is Ready; re-check provider state and then re-test the authenticated query.

## Deployment contract

The repository build/start contract is:

```bash
npm run build
npm start
```

The production-style server entrypoint is `node dist/server.cjs` through `npm start`.

Provider configuration must route HTTPS traffic to the Node service and must not replace staging environment variables with production/default provider values.

After the service starts, verify:

```text
GET /api/health
```

Expected result: HTTP success containing `status: "ok"`, timestamp, `runtime: "staging"`, the expected isolated `firebaseProjectId`, and Firestore database ID `(default)` or the explicitly reviewed staging database. The response must not contain API keys, VAPID material, tokens, credentials, auth domains, sender IDs or app IDs.

Save the safe health JSON and run:

```bash
npm run staging:evidence -- <saved-health-json>
```

A matching health response proves runtime/project/database selection. It does not prove Firebase Admin credential scope, notification delivery, authorization or device acceptance.

## First-run isolation verification

Before creating any test record:

1. Open the staging URL in a clean browser session.
2. Confirm `Staging • Test environment` is visible.
3. Confirm the URL is non-production.
4. Confirm client/server project/database IDs match the planned staging identifiers.
5. Confirm no production member/profile/announcement/accounting data is visible.
6. Confirm connectors remain disabled and the Core-status staging executor remains disabled.

Stop immediately if production data, production project identity, production push credentials or unexplained production member accounts appear.

## Synthetic account / authorization matrix

Use only synthetic staging identities. Baseline coverage should include:

- verified ordinary member;
- Core member;
- liturgical ministry members/leaders;
- Admin/President equivalent;
- Secretary;
- Treasurer;
- Auditor;
- Vice President;
- pending/unverified member; and
- disabled member.

In addition to privacy checks, verify the branch-only Treasury authorization contract:

- Admin / President / Treasurer can read/create/edit/delete transactions and manage accounting categories;
- Admin / President / Auditor can approve transactions;
- Vice President / Auditor can read accounting;
- VP cannot edit/approve;
- Auditor cannot edit/delete/category-manage;
- Treasurer does not gain approval authority from this correction; and
- ordinary members are denied accounting operations.

## Browser QA gate

Before physical-device notification testing, complete the browser/responsive subset of `staging-test-matrix.md` and `staging-readiness-checklist.md`, including:

- Home and five-item mobile navigation;
- Schedule URLs/history and Plan & manage;
- Community filters;
- Updates Published/All history and notification focus;
- Inbox filters/detail/history after index readiness;
- Resources category history;
- Leadership workspace history and unauthorized denial;
- staging badge visibility at phone/tablet/desktop widths;
- public/private member-profile boundary;
- pending-profile trusted claim and collision/legacy compatibility cases;
- explicit roster publication/privacy boundaries; and
- destructive controls remaining outside routine leadership surfaces.

Automated CI results are not empirical browser PASS entries.

## Physical-device notification gate

Use `staging-device-qa-package-2026-09-11.md` and `notification-acceptance-evidence-template-2026-09-11.md`.

Baseline devices:

- physical iPhone;
- physical Android tablet;
- optional supplemental Android phone.

For each notification test separately record transport acceptance, OS presentation, durable Inbox persistence and tap/deep-link result. Missing sound alone is not proof of transport failure.

## Evidence record for an actual staging deployment

Create a dated evidence entry containing only non-secret information:

- deployed branch commit SHA;
- successful CI run number/id;
- staging provider/service name;
- staging URL hostname;
- staging Firebase project ID;
- Firestore database ID;
- deployment/revision identifier;
- `staging:preflight` PASS output with secrets excluded;
- `/api/health` result plus `staging:evidence` PASS;
- index readiness state;
- projection/backfill/rule deployment state;
- pending-profile claim matrix state;
- screenshot showing the staging badge;
- browser/device matrix results;
- defects/remediation commits; and
- tester/device model + OS/browser/PWA mode.

Never store service-account credentials, VAPID private material, SMTP credentials, OAuth secrets, Firebase ID tokens, FCM tokens, PushSubscription endpoints or production personal data in evidence.

## Staging rollback / cleanup

If a staging build is defective:

1. stop synthetic testing that could compound the issue;
2. roll the staging application revision back to the last known-good staging artifact/commit where supported;
3. keep staging isolated; never redirect it to production as a workaround;
4. if strict private-profile rules are implicated, roll back the **staging rules/application/projection as a coordinated staging unit** to the last verified configuration rather than broadening production access;
5. do not perform destructive Firestore restoration unless a separately reviewed staging-data recovery case actually requires it;
6. invalidate/remove test device registrations if necessary; and
7. record the failed revision and defect before retrying.

Staging cleanup must never delete or modify production resources.

## Completion criteria for the staging-environment gate

The gate may be marked complete only when all of the following are retained as evidence:

- exact deployed SHA and green CI for that SHA;
- isolated staging project/database/provider identifiers and revision;
- successful real `staging:preflight`;
- approved non-production HTTPS `APP_URL`;
- visible staging badge;
- `/api/health` success plus `staging:evidence` PASS;
- connectors OFF and Core-status executor OFF;
- no production data/credentials observed;
- required composite indexes Ready and empirically exercised;
- current `member_directory` projection backfilled/verified including `lcRoles`;
- migrated member-facing workflows working against that projection;
- tightened staging private-profile access matrix empirically verified;
- trusted pending-profile claim, collision isolation and legacy-ID compatibility empirically verified;
- staging Treasury role matrix empirically verified; and
- provider backup/rollback/redeployability evidence retained.

Production merge/deployment remains a separate explicit approval even after every staging gate passes.