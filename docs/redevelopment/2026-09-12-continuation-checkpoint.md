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

The bounded implementation helper validated the targeted Leadership contract, TypeScript and a production build before committing the branch change, then removed itself. The normal branch contains only the permanent read-only redevelopment CI workflow at normal checkpoints.

The bot-authored code commit produced a GitHub Actions `action_required` record with zero jobs rather than an ordinary permanent-CI execution. That record is **not** counted as release validation. A normal documentation checkpoint then triggered the permanent workflow against the same code state.

### First-stage permanent validation and measured result

`KCFC Redevelopment CI` run **#1592** / id `34621542523` completed **SUCCESS** on checkpoint head `d5785717887260a561005a6d6d7f7473a9cf8d2b`, with all **58** named validation/build/security checks green. The retained build-manifest artifact is `kcfc-build-manifest-d5785717887260a561005a6d6d7f7473a9cf8d2b`.

Compared with the clean pre-change manifest on `147d5eed2d0acda2abeb1d29ab1319141ed82ad1`:

- routine `Admin` route chunk: **174,006 bytes (169.9 KiB) → 110,127 bytes (107.6 KiB)**;
- reduction in the routine Leadership chunk: **63,879 bytes raw / 36.7%**;
- on-demand `LegacyAdmin` chunk: **65,972 bytes (64.4 KiB)**;
- JavaScript asset count: **49 → 51** because the advanced compatibility surface is now independently loadable;
- total JavaScript raw size: **2,329,069 → 2,331,337 bytes** (approximately +2.2 KiB), so this is intentionally a route-loading improvement rather than a total-weight claim; and
- standard main entry remained effectively unchanged at about **332.1 KiB raw**.

The preserved legacy surface therefore no longer increases the routine Leadership route payload for leaders who do not open Advanced tools.

### Second-stage Leadership workspace deferral

A second concrete loading issue remained after the advanced-tools split: the default **Leadership overview** still eagerly imported every non-default focused workspace even though those workspaces render only when their URL-backed tab is selected.

Branch-only code change `e2cf55b7e200dedb7e2619a53a9906c23b143134` now defers:

- Website Inquiries;
- Member Communications;
- Member Account Overview;
- Member Pre-registration;
- Member Approval Queue;
- Roles & Ministries;
- Core-status Planner; and
- Advanced Legacy Tools.

`LeadershipOverview` remains eager because it is the default workspace. Each deferred workspace is behind an accessible `React.Suspense` status fallback. Authorization, URL/history behavior, destructive-action isolation, and existing workspace semantics are unchanged.

The existing permanent Leadership verifier was strengthened rather than adding a new CI step: it now requires all eight non-default lazy boundaries and fails if any of those components regress to an eager import.

The bounded one-shot optimizer on parent `7e8495094a893f2b07d159f15572b0150012f02b` completed **SUCCESS**, including the targeted Leadership contract, TypeScript, production build, and a guard requiring the routine `Admin` chunk to be below **90,000 raw bytes**. It then committed `e2cf55b7...` and removed itself.

### Second-stage permanent validation and measured result

`KCFC Redevelopment CI` run **#1601** / id `34622296845` completed **SUCCESS** on checkpoint head `6ca51eab3dc3a579ebbcc38a64a56b18f5377c75`, with all **58** named validation/build/security checks green. The retained build-manifest artifact is `kcfc-build-manifest-6ca51eab3dc3a579ebbcc38a64a56b18f5377c75`.

Measured against the first-stage and original baselines:

- routine `Admin` route chunk: **110,127 bytes (107.6 KiB) → 18,406 bytes (18.0 KiB)**;
- second-stage reduction: **91,721 bytes / 83.3%**;
- total reduction from the original **174,006-byte (169.9 KiB)** Leadership chunk: **155,600 bytes / 89.4%**;
- deferred `BroadcastTool`: **30,909 bytes**;
- deferred `LeadershipInquiries`: **14,494 bytes**;
- deferred `MemberRoleEditor`: **13,212 bytes**;
- deferred `CoreStatusPlanner`: **10,166 bytes**;
- deferred `MemberAccountOverview`: **7,521 bytes**;
- deferred `MemberApprovalQueue`: **7,441 bytes**;
- deferred `MemberPreRegistration`: **6,285 bytes**;
- deferred `LegacyAdmin`: **66,055 bytes**;
- JavaScript asset count: **63** after decomposing the focused workspaces into on-demand chunks;
- total JavaScript raw size: **2,335,708 bytes**, only **6,639 bytes / 0.29%** above the original 2,329,069-byte baseline; and
- standard main entry remains effectively unchanged at **340,134 bytes (332.2 KiB)**, while `vendor-firebase` remains **838,741 bytes (819.1 KiB)**.

This is therefore a meaningful default Leadership loading reduction without pretending that total application code disappeared: the non-default workspaces remain available, role-gated and URL-addressable, but are fetched when selected rather than on every Leadership overview visit.

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
