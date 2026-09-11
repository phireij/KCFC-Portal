# KCFC Portal — Isolated Staging Deployment Runbook — 2026-09-11

Branch: `redesign/mobile-first-v2`

Status: **readiness procedure only.** This runbook does not authorize creation of paid cloud resources, production deployment, production credential use, production data access, connector activation, production messaging, or any production mutation.

## Purpose

Provide one provider-neutral procedure for turning the validated redevelopment branch into an **isolated staging environment** suitable for browser and physical-device QA. The procedure consumes the repository's existing fail-closed staging contracts instead of relying on implicit provider defaults.

Latest validated staging-contract checkpoint: `8f8979b75d46d20d883876bcbd0d9ebedcc06a5a`, with `KCFC Redevelopment CI` run **#1231** / id `34585740307` completing successfully with all **57** validation/build/security steps green.

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

If any of these resources would incur billing, alter an existing external account, or require access to production secrets, stop for the applicable approval before provisioning.

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

The Node server initializes Firebase Admin with the configured project ID and relies on the runtime's normal Firebase Admin authentication mechanism. Therefore, project-ID environment variables alone are **not** sufficient authorization: the deployment runtime must also have staging-only Application Default Credentials / workload identity permissions.

### Web Push / notification keys

Provide one staging-only VAPID pair:

```text
VITE_FCM_VAPID_KEY=<staging public key>
WEB_PUSH_VAPID_PUBLIC_KEY=<same staging public key>
WEB_PUSH_VAPID_PRIVATE_KEY=<staging private key, server-only>
```

The browser public key and server public key must match. The private key must never use a `VITE_*` name or otherwise enter the browser bundle. When `KCFC_RUNTIME_ENV=staging`, the server itself fails closed if either explicit server VAPID key is missing. If Web Push initialization later fails for any reason, staging re-throws that error before the in-memory generated-key fallback; staging must never continue with cached, Firestore, or generated VAPID material.

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

For baseline staging, the admin mass-email broadcast endpoint remains simulation-only even if SMTP credentials are present. Public-inquiry notification email and the authorized inquiry-alert SMTP endpoint are also suppressed/simulated in staging, so inquiry QA cannot notify the production KCFC mailbox. Inquiry records may still be persisted in the isolated staging Firestore project for workflow testing. Any separately tested reply/verification email flow must use synthetic/test recipients under the applicable approval boundary.

## Pre-deployment gate

From the exact branch commit intended for staging, with the protected staging environment loaded:

```bash
npm ci
npm run staging:preflight
npm run lint
npm run build
```

Do not continue if any command fails.

Retain the safe `staging:preflight` output as evidence. It should record only:

- staging Firebase project identifier;
- Firestore database identifier;
- client/server staging runtime markers;
- connectors OFF;
- Core-status staging executor OFF; and
- presence/parity of staging VAPID material.

Do **not** retain private keys, API secrets, authentication tokens, service-account JSON, push subscription endpoints, FCM tokens, or member personal data in the evidence package.

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

Expected application-level result: HTTP success containing `status: "ok"`, a timestamp, `runtime: "staging"`, the expected isolated `firebaseProjectId`, and the expected `firestoreDatabaseId` (or `(default)`). The response must not contain API keys, VAPID material, tokens, credentials, auth domains, sender IDs, or app IDs.

A matching health response proves the running server selected the intended runtime/project/database identifiers. It does **not** prove Firebase Admin credential scope, notification delivery, authorization, or device acceptance; those require the steps below.

## First-run isolation verification

Before creating any test record:

1. Open the staging URL in a clean browser session.
2. Confirm `Staging • Test environment` is visibly present and non-obstructive.
3. Confirm the URL is the non-production staging URL.
4. Re-run/retain `npm run staging:preflight` from the deployed environment or the exact protected environment used for deployment.
5. Confirm client/server project and database IDs match the planned staging identifiers.
6. Confirm no production member/profile/announcement/accounting record is visible.
7. Confirm all external connector surfaces remain disabled/future-only.
8. Confirm the Core-status staging executor remains disabled.

**Stop condition:** if any production data, production project identifier, production push credential, or unexplained existing member account appears, do not continue QA. Preserve only non-sensitive diagnostic evidence and investigate isolation first.

## Synthetic account bootstrap

Use the identities defined in `staging-test-matrix.md`. Create only the minimum synthetic accounts/data needed for each case.

Required baseline includes representative synthetic states such as:

- verified regular member;
- core member;
- ministry members/leaders;
- administrator/president equivalent;
- treasurer/auditor;
- pending/unverified member; and
- disabled member.

No production Firebase UID should be recreated, copied or mapped into staging.

For pre-registration/onboarding tests, verify the real staging Firebase Auth UID is preserved and that Login/Google migration does not mark email verification true without Firebase Auth/pending evidence or the explicit bootstrap-admin exception.

## Browser QA gate

Before physical-device notification testing, complete the browser/responsive subset of `staging-test-matrix.md` and `staging-readiness-checklist.md`, including:

- Home and five-item mobile navigation;
- Schedule direct URLs and Back/Forward history;
- Community type/ministry history;
- Updates Published/All history and notification focus;
- Inbox filter/message history;
- Resource category history;
- Leadership workspace history and unauthorized denial;
- staging badge visibility at phone/tablet/desktop widths;
- private-directory field absence;
- explicit roster publication/privacy boundaries; and
- destructive controls remaining outside routine leadership surfaces.

Do not convert automated CI results into empirical PASS entries. The browser cases require actual observation against the isolated staging deployment.

## Physical-device notification gate

Use `staging-device-qa-package-2026-09-11.md` and `notification-acceptance-evidence-template-2026-09-11.md`.

Baseline devices remain:

- physical iPhone;
- physical Android tablet;
- optional supplemental Android phone.

For each notification test separately record:

1. transport acceptance;
2. OS presentation (banner/lock-screen/sound/vibration as applicable);
3. durable KCFC Inbox persistence; and
4. tap/deep-link result.

Provider acceptance is not proof the member saw/heard the notification. Missing sound alone is not proof of transport failure.

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
- `/api/health` result;
- screenshot showing the staging badge;
- browser/device matrix results;
- defects discovered and remediation commits; and
- tester/device model + OS/browser/PWA mode.

Never put service-account credentials, private VAPID material, SMTP credentials, OAuth client secrets, Firebase ID tokens, FCM tokens, PushSubscription endpoints or production personal data in the evidence record.

## Staging rollback / cleanup

If a staging build is defective:

1. stop synthetic testing that could compound the issue;
2. roll the staging application revision back to the last known-good staging artifact/commit where the provider supports revision rollback;
3. keep the staging Firebase project isolated; do not redirect the app to production as a workaround;
4. do not perform destructive Firestore restoration unless a separately reviewed staging-data recovery case actually requires it;
5. invalidate/remove test device registrations if necessary; and
6. record the failed revision and defect before retrying.

Staging cleanup must never delete or modify production resources.

## Completion criteria for the staging-environment gate

The staging environment gate may be marked complete only when all of the following are retained as evidence:

- exact deployed SHA;
- green redevelopment CI for that intended SHA;
- isolated staging project/database identifiers;
- successful real `npm run staging:preflight`;
- staging-only Admin authentication/identity confirmed;
- approved non-production HTTPS `APP_URL` confirmed and generated links checked against the staging origin;
- staging badge visibly confirmed;
- `/api/health` successful and reporting the expected staging runtime/project/database identifiers with no secret fields;
- connectors OFF;
- Core-status executor OFF; and
- no production data/credentials observed.

Only after this gate is complete should browser/device empirical acceptance be treated as staging evidence. Production merge/deployment remains a separate explicit approval even after all staging gates pass.
