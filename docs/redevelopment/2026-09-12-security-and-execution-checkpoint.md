# KCFC Portal — Security & Execution Checkpoint

Date: 2026-09-12
Branch: `redesign/mobile-first-v2`
Draft PR: #1
Production baseline: `main` = `653cc7229600fd7baff17a21a21f12d267b66d2b`

Status: **redevelopment repository GREEN; production remains untouched and not approved for merge/deploy.**

## Current validated code/config checkpoint

- Head: `dbba278c8b8e02004b4d6705c82dbc303bf2d0b5`
- Push CI: `KCFC Redevelopment CI` run #1623 / id `34667884007` — **SUCCESS**
- Exact-head PR CI: run #1624 / id `34667886504` — **SUCCESS**
- All existing named validation/build/security steps passed.
- Retained build manifest: `kcfc-build-manifest-dbba278c8b8e02004b4d6705c82dbc303bf2d0b5`
- Artifact id: `10289344490`
- Artifact archive digest: `sha256:2684909eb8bf8735bcf31a429a1d4214bf6e1f8e0ffcda1d6eddbf2b59fd8cc0`
- Retention expiry: 2026-10-12.

## Browser provider-secret boundary hardening

A legacy Vite configuration injected `process.env.GEMINI_API_KEY` into the browser build through `define`. Current application source has no `GoogleGenAI` usage, so the injection had no functional requirement and created an unnecessary provider-secret exposure boundary.

Validated remediation:

- removed the `process.env.GEMINI_API_KEY` browser definition from `vite.config.ts`;
- removed the now-unneeded Vite `loadEnv` client-build plumbing;
- added `scripts/verify-browser-secret-boundary.ts`;
- wired the guard into `npm run lint` so ordinary typecheck CI also rejects future browser-side provider-secret regressions;
- the guard rejects secret-shaped `process.env.*` Vite definitions and secret-shaped `VITE_*` client accesses for provider secret/token/private-key classes;
- existing `.env.example` CI checks still prohibit provider credentials from being declared as browser-exposed `VITE_*` variables.

This change does **not** activate Gemini, add a new AI workflow, or expose any credential value.

## Current bundle/loading position

Validated route-loading work remains intact after the security hardening:

- routine Schedule: 23,630 bytes; preserved `LegacyDutiesImpl` loads on demand;
- routine Availability/Polls: 48,594 bytes; preserved `LegacyPollsImpl` loads on demand;
- combined routine Schedule + Availability payload: 72,224 bytes before shared-vendor caching;
- main entry: 339,989 bytes;
- legacy compatibility workspaces remain available and are not deleted.

No additional main-shell split is currently justified: the remaining entry contains authentication/profile lifecycle, routing and notification bootstrap, where further decomposition has materially higher regression risk.

## Execution queue by environment

### Safe to continue in Chat mode

The following can continue autonomously without touching production:

1. repository inspection and code/security review;
2. dependency disposition and supported cleanup research;
3. branch-only non-destructive fixes with CI validation;
4. bundle/readiness analysis;
5. CI/artifact identity verification;
6. preparation and synchronization of staging/device/rollback evidence documents;
7. Draft PR #1 readiness synchronization.

### Requires Work mode / Cloud Browser

The following depend on direct provider/browser state and should be resumed in Work mode rather than guessed from Chat:

1. identify and record the exact Firebase staging project ID, App Hosting backend name, generated staging URL, rollout/revision and provider deployment status;
2. open the deployed staging URL and verify the visible `Staging • Test environment` badge;
3. verify deployed `/api/health` over HTTPS;
4. capture actual runtime/project/database evidence and run the protected staging evidence check;
5. browser-based synthetic staging regression QA where direct deployed-environment interaction is required;
6. provider/environment backup and deployment-artifact rollback evidence where the provider console is required.

### Requires physical devices

These cannot be replaced by emulation or repository evidence:

1. physical iPhone Add-to-Home-Screen / PWA notification acceptance;
2. physical iPhone background and locked-device Web Push presentation;
3. physical Android tablet notification and navigation acceptance;
4. multi-device valid + stale endpoint behavior;
5. actual notification presentation, sound/vibration/Focus behavior and tap/deep-link outcomes.

Android phone coverage remains supplemental unless separately promoted to a required device class.

## Open release blockers

The remaining material blockers are empirical/provider-side rather than ordinary application-code gaps:

- actual isolated staging preflight and deployed health identity;
- visible staging badge on the real deployment;
- browser/device regression evidence;
- physical iPhone + Android tablet notification evidence;
- provider/environment backup evidence;
- exact deployable rollback-artifact/redeployability evidence;
- continued bounded disposition or supported parent remediation for the remaining optional Firebase Admin Storage-path `uuid` / `gaxios` moderate findings;
- explicit user approval before production merge/deploy or any separately gated production-sensitive action.

## Approval gates remain unchanged

Do **not** without explicit approval:

- merge PR #1 or deploy to production;
- perform destructive migration/restore;
- bulk-mutate users;
- delete/recreate Firebase Auth users;
- activate live LINE/Telegram/WhatsApp/Viber connectors;
- mass-send production messages;
- execute production Core-status mutations;
- enable the staging Core-status executor against a non-isolated environment;
- perform public website cutover.

## Next autonomous Chat-mode priority

Continue with supported dependency and secret-boundary cleanup research, then repository-side release-evidence synchronization. Return to Work mode only when the next blocker requires direct Firebase/App Hosting/browser state.
