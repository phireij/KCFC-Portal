# KCFC Portal — Staging Provisioning Authorization — 2026-09-12

Branch: `redesign/mobile-first-v2`

Status: **APPROVED for isolated QA-only staging provisioning/configuration/deployment.**

This authorization records the user's approval to proceed with a separate non-production staging environment for KCFC Portal testing. It does **not** authorize any production merge, production deployment, production credential reuse, production data access, mass messaging, public cutover, destructive migration/restore, live external connector activation, or production Core-status mutation.

## Approved staging scope

The staging environment may include:

- a separate Firebase / Google Cloud project dedicated to KCFC staging;
- a staging Firestore database;
- Firebase Authentication configured only for synthetic/test accounts and the sign-in methods required by QA;
- a staging web app registration with explicit staging Firebase client configuration;
- a staging-only server runtime identity / Application Default Credentials scoped only to the staging project;
- a dedicated staging VAPID key pair;
- a non-production HTTPS staging URL and Node.js runtime capable of serving `dist/server.cjs`;
- synthetic test users/data only; and
- browser, responsive, PWA, notification and physical-device QA against that isolated environment.

## Cost guardrail

Approved contingency ceiling: **JPY 1,000 per month** for the isolated KCFC staging environment.

Expected ordinary QA usage is substantially below that ceiling. The working membership scale is approximately **100 members maximum**, so Firestore/Auth read/write activity is expected to remain small.

If a proposed staging action would reasonably increase recurring cost above JPY 1,000/month, introduce a materially new paid service, or require a paid plan change beyond the isolated staging need, stop and obtain a new explicit approval before proceeding.

Cloud budget alerts, when available, are supplementary monitoring only and are not treated as hard spending caps; the approval ceiling remains the governance control.

## Mandatory isolation controls

1. Staging Firebase project ID must differ from the committed compatibility/production-default Firebase project.
2. Do not reuse production service-account credentials, VAPID private keys, SMTP credentials, OAuth secrets, member data or push tokens.
3. `VITE_KCFC_RUNTIME_ENV=staging` and `KCFC_RUNTIME_ENV=staging` are required.
4. Client/server Firebase project and database targets must match the isolated staging environment.
5. `KCFC_CORE_STATUS_STAGING_EXECUTOR_ENABLED=false` for baseline QA.
6. LINE, Telegram, WhatsApp and Viber connector flags remain `false`.
7. Baseline staging SMTP remains suppressed/simulation-only under the repository's fail-safe staging behavior.
8. Production `main` must remain untouched; draft PR #1 must not be merged or deployed to production under this authorization.
9. Any production exposure, production project identifier, production member data or production credential observed during staging setup is an immediate stop condition.

## Provider execution boundary

Repository-side readiness is already available through `npm run staging:preflight`, `npm run lint`, `npm run build`, `/api/health`, and `npm run staging:evidence`.

Actual creation/configuration of the separate Firebase / Google Cloud project and hosting runtime requires an authenticated provider interface. The GitHub connection used for repository work does not expose Google Cloud/Firebase account provisioning or secret-management operations. Provider-side provisioning must therefore be performed only through an authenticated Google/Firebase interface while preserving the controls above.

## Completion evidence required

Staging provisioning is not considered complete until the repository's staging deployment runbook has retained non-secret evidence for:

- exact deployed branch SHA;
- green redevelopment CI for that SHA;
- isolated staging Firebase project/database IDs;
- successful real `npm run staging:preflight`;
- staging-only Admin/runtime identity;
- approved non-production HTTPS `APP_URL`;
- visible `Staging • Test environment` badge;
- successful `/api/health` plus `npm run staging:evidence`;
- connectors OFF and Core-status executor OFF; and
- confirmation that no production data/credentials were observed.

Physical iPhone and Android-tablet acceptance remains a separate empirical QA gate after isolated staging passes the environment gate.
