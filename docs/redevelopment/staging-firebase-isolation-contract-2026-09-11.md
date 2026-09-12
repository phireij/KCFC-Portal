# KCFC Portal — Staging Firebase Isolation Contract

**Date:** 2026-09-11  
**Branch:** `redesign/mobile-first-v2`  
**Status:** required before browser/device staging QA; **does not authorize production deployment**.

## Objective

Prevent any staging, browser-emulation, Android-emulator, iPhone, or Android-tablet QA build from silently connecting to the committed production/default Firebase project.

## Required staging runtime markers

For an isolated staging deployment, set both:

```text
VITE_KCFC_RUNTIME_ENV=staging
KCFC_RUNTIME_ENV=staging
```

The client and server deliberately default to `production` only for the existing production-compatible/default path. Merely deploying the redevelopment branch does not make it a staging environment.

## Required Firebase configuration

When the runtime markers are `staging`, provide explicit values for the staging Firebase project.

Client:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_DATABASE_ID
```

Server:

```text
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
FIREBASE_STORAGE_BUCKET
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_APP_ID
FIREBASE_DATABASE_ID
```

Client and server staging values must refer to the same isolated staging Firebase project/database.

## Fail-closed rules

When the client runtime is marked `staging`:

- incomplete explicit client Firebase configuration is rejected;
- fallback to `firebase-applet-config.json` is rejected;
- `VITE_FIREBASE_PROJECT_ID` equal to the committed project ID is rejected.

When the server runtime is marked `staging`:

- incomplete explicit server Firebase configuration is rejected;
- fallback to `firebase-applet-config.json` is rejected;
- `FIREBASE_PROJECT_ID` equal to the committed project ID is rejected.

For all environments, an explicit complete env configuration takes precedence over the committed compatibility file.

## CI regression guard

`KCFC Redevelopment CI` runs:

```text
npx tsx scripts/verify-firebase-runtime-isolation.ts
```

The guard checks both client and server source contracts plus `.env.example` guidance. It fails if committed-file precedence returns or either staging fail-closed boundary disappears.

## Pre-QA evidence required

Before any empirical staging sign-in or notification test, record:

- staging URL/environment identifier;
- `VITE_KCFC_RUNTIME_ENV=staging` confirmed;
- `KCFC_RUNTIME_ENV=staging` confirmed;
- client staging Firebase project ID;
- server staging Firebase project ID;
- confirmation both IDs match each other;
- confirmation the staging project ID differs from the committed production/default project ID;
- staging Firestore database ID;
- external connectors OFF;
- Core-status staging executor OFF unless separately reviewed and intentionally enabled in the isolated environment;
- test accounts are synthetic/staging-only.

Do **not** record API keys, tokens, service-account material, VAPID private keys, SMTP credentials, or other secrets in readiness documents/screenshots.

## Stop conditions

Stop staging QA immediately if:

- client and server project IDs differ;
- either runtime marker is not `staging`;
- the app reports/observes the committed production/default Firebase project;
- a production member/account/record appears in the staging test unexpectedly;
- a test mutation becomes visible in production;
- proceeding would require production credentials or production data mutation.

## Production boundary

This contract prepares an isolated staging environment only. It grants no authority to merge `main`, deploy/cut over production, copy production data destructively, recreate Firebase Auth users, activate live connectors, send mass messages, or perform production Core-status operations.
