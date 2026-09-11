# KCFC Portal Redevelopment Continuation Checkpoint — 2026-09-12

Branch: `redesign/mobile-first-v2`
Draft PR: #1 — `Redevelopment: mobile-first shell and schedule foundation`
Production baseline: `main` remains `653cc7229600fd7baff17a21a21f12d267b66d2b`

Status: **NOT production-approved.** This checkpoint records branch-only readiness work. It does not authorize merge, deployment, production cutover, destructive data work, live connector activation, mass outbound messaging, production Core-status mutation, paid/external staging provisioning, or public website publishing.

## Live-state inspection

At continuation start, the live redevelopment branch had advanced beyond the previous handoff and was inspected directly before changes. PR #1 remained open, draft and mergeable. Production `main` remained unchanged at the recorded baseline.

The latest clean ordinary CI before this continuation was `KCFC Redevelopment CI` run #1587 / id `34618200551` on `147d5eed2d0acda2abeb1d29ab1319141ed82ad1`, with all 58 named validation/build/security checks green.

## Leadership / bundle optimization

A concrete residual bundle issue was identified in the focused Leadership route: `src/pages/Admin.tsx` eagerly imported the preserved `LegacyAdmin.tsx` compatibility surface even though it renders only when the authorized leader explicitly opens **Advanced legacy tools**.

Branch-only change `1250ea8e460e64899f897680236e77de553160cb` now:

- loads `LegacyAdmin` through `React.lazy()`;
- places the advanced-only render behind a `React.Suspense` status fallback;
- keeps authorization and URL-backed Leadership workspace behavior unchanged;
- preserves every destructive/low-frequency control in the existing protected legacy surface rather than moving those controls into routine workspaces; and
- extends the existing Leadership workspace verifier so an eager `LegacyAdmin` import is a regression failure.

The bounded implementation helper validated the targeted Leadership contract, TypeScript and a production build before committing the branch change, then removed itself. The normal branch now contains only the permanent read-only redevelopment CI workflow.

The bot-authored code commit produced a GitHub Actions `action_required` record with zero jobs rather than an ordinary permanent-CI execution. That record is **not** counted as release validation. This documentation checkpoint intentionally provides a normal branch event so the permanent CI can validate the exact current code state. The first successful ordinary permanent CI after `1250ea8e...` is the required validation evidence for this optimization.

## Dependency disposition re-check

The remaining runtime dependency findings stay bounded to the currently unused optional Firebase Admin / Google Cloud Storage path:

- `uuid` — moderate;
- affected older `gaxios` — moderate.

A fresh 2026-09-12 upstream check still found no supported parent-package upgrade that cleanly removes those findings from KCFC's supported dependency chain. The existing disposition therefore remains unchanged: keep Storage unused, preserve the source-level activation guard, keep runtime audit visibility, and do not introduce forced leaf overrides or third-party repackaging merely to silence the audit.

## Release-readiness boundary

Repository-side work is increasingly concentrated on evidence quality rather than speculative code changes. Empirical blockers remain real blockers and must not be marked complete without observation:

1. actual isolated staging environment;
2. real `npm run staging:preflight` PASS;
3. correct staging `/api/health` identity;
4. visible staging badge;
5. browser regression QA;
6. physical iPhone notification acceptance;
7. physical Android tablet notification acceptance;
8. provider/environment backup evidence;
9. deployable rollback-artifact evidence; and
10. explicit approval before production merge/deployment.

Notification acceptance must continue to record transport acceptance, OS presentation, durable KCFC Inbox persistence, and tap/deep-link behavior independently. Missing audible sound alone is not transport-failure evidence.

## Approval gates preserved

PR #1 remains draft. Production `main` must remain untouched. No production deployment, migration, restore, user recreation, Core-status mutation, connector activation, mass live messaging, paid/external staging provisioning, or public cutover is authorized by this checkpoint.
