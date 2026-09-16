# KCFC Portal — Staging Runtime Evidence Capture — 2026-09-11

Branch: `redesign/mobile-first-v2`

Status: **evidence procedure only.** This procedure does not authorize staging resource provisioning, production deployment, production credential use, connector activation, live messaging, destructive data work, or production mutation.

## Purpose

Provide a repeatable, privacy-safe way to prove that a running KCFC staging service is using the intended isolated runtime, Firebase project, and Firestore database before browser/device QA begins.

This procedure complements `staging-deployment-runbook-2026-09-11.md`. It does not replace the real `npm run staging:preflight`, visible staging badge, staging-only Admin identity verification, or physical-device acceptance requirements.

## Preconditions

Run from the exact branch SHA intended for staging with the same protected staging environment used by the deployment.

Required environment markers include:

```text
APP_URL=https://<non-production-staging-host>
VITE_KCFC_RUNTIME_ENV=staging
KCFC_RUNTIME_ENV=staging
VITE_FIREBASE_PROJECT_ID=<isolated-staging-project>
FIREBASE_PROJECT_ID=<same-isolated-staging-project>
VITE_FIREBASE_DATABASE_ID=<staging-db-or-blank>
FIREBASE_DATABASE_ID=<same-staging-db-or-blank>
```

All other variables required by `npm run staging:preflight` must also be loaded. Do not print or copy secrets into evidence notes.

## Capture sequence

### 1. Prove protected-environment isolation

```bash
npm ci
npm run staging:preflight | tee /tmp/kcfc-staging-preflight.txt
```

Stop if preflight fails.

### 2. Capture the running service health payload

```bash
curl --fail --silent --show-error \
  "$APP_URL/api/health" \
  --output /tmp/kcfc-staging-health.json
```

Do not use a production Portal URL. Do not add authentication tokens, API keys, or query-string credentials to this request.

### 3. Validate the health payload against the protected environment

```bash
npm run staging:evidence -- /tmp/kcfc-staging-health.json \
  | tee /tmp/kcfc-staging-runtime-evidence.txt
```

The command passes only when all of these are true:

- both runtime markers are exactly `staging`;
- `APP_URL` is valid HTTPS and is not a production KCFC Portal hostname;
- client/server Firebase project IDs match;
- client/server Firestore database IDs match;
- `/api/health` reports `status: "ok"`;
- `/api/health` reports `runtime: "staging"`;
- the deployed Firebase project ID matches the protected staging environment;
- the deployed Firestore database ID matches the protected staging environment;
- the health timestamp is valid; and
- the health JSON contains only the allowlisted fields `status`, `time`, `runtime`, `firebaseProjectId`, and `firestoreDatabaseId`.

Any unexpected health-response field causes failure. This protects the evidence surface from silently expanding to API keys, tokens, credentials, VAPID material, app identifiers, or other internal configuration.

## Safe evidence to retain

Retain only:

- exact deployed commit SHA;
- successful CI run number/id for that SHA;
- staging hostname;
- staging Firebase project ID;
- Firestore database ID;
- deployment/revision identifier;
- `/tmp/kcfc-staging-preflight.txt` after confirming it contains no secret values;
- `/tmp/kcfc-staging-runtime-evidence.txt`;
- the raw `/api/health` JSON only if it contains exactly the allowlisted fields above; and
- screenshot evidence of the visible `Staging • Test environment` badge.

Do **not** retain service-account JSON, Firebase ID tokens, API keys, private VAPID keys, FCM tokens, PushSubscription endpoints, SMTP credentials, connector secrets, production personal data, or browser storage dumps.

## Mandatory stop conditions

Stop staging QA immediately if:

- `staging:preflight` fails;
- `staging:evidence` fails;
- the running service reports a production/default project unexpectedly;
- the runtime is not `staging`;
- the health response contains an unexpected field;
- the visible staging badge is absent;
- production member/application data appears; or
- proceeding would require production credentials or an approval-gated external change.

## CI contract

`scripts/verify-staging-runtime-evidence.mjs` exercises the validator using synthetic local JSON only. It permanently verifies successful isolated evidence plus failure on:

- unexpected/sensitive response fields;
- Firebase project mismatch;
- non-staging runtime; and
- production Portal hostname.

CI does **not** claim an actual staging deployment exists. A real staging evidence PASS remains an empirical release gate.
