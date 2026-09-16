# KCFC Portal — Post-Work-Mode Repository Checkpoint — 2026-09-15

Branch: `redesign/mobile-first-v2`

Pre-checkpoint branch head verified before this documentation commit: `c2b07e6901c9e7528f6107948c445416e54596de`

Production baseline verified unchanged: `main` = `653cc7229600fd7baff17a21a21f12d267b66d2b`

Draft PR: #1 — must remain OPEN / DRAFT / NOT MERGED.

## Purpose

This checkpoint records the transition back to ordinary repository work after a Work-mode staging session. It deliberately separates what is directly verified from GitHub from what was only summarized in the Work-mode handoff.

## Directly verified repository state

- `redesign/mobile-first-v2` was still at `c2b07e6901c9e7528f6107948c445416e54596de` when ordinary Chat-mode work resumed.
- Production `main` remained exactly `653cc7229600fd7baff17a21a21f12d267b66d2b`.
- Draft PR #1 remained open, draft, and unmerged, targeting `main` from `redesign/mobile-first-v2`.
- Exact-head push CI run #1939 / id `34839229977` completed successfully for `c2b07e6901c9e7528f6107948c445416e54596de`.
- The existing PR evidence records the matching PR CI run #1940 / id `34839234029` as successful and the retained build-manifest artifact for that exact head.
- No repository commit from the Work-mode session advanced the branch before this checkpoint was created.

## Work-mode handoff carried forward

The final user-provided Work-mode report states:

> The governed Core-member changes are validated on `redesign/mobile-first-v2`. `main` and Draft PR #1 remain untouched.

This checkpoint preserves that statement as a handoff result. It does **not** infer provider identifiers, URLs, rollout IDs, health payloads, index readiness, Treasury test outcomes, member-directory backfill results, pending-profile claim results, browser QA results, or backup/rollback evidence that were not included in the supplied report.

## Repository-side posture

The branch remains repository-green at the last exact-head CI checkpoint. Existing permanent guards cover the privacy, governance, pending-profile claim, member-directory sync, communication-recipient, Treasury authorization, runtime-isolation, Web Push, navigation/history, accessibility, build and artifact-identity boundaries documented in Draft PR #1 and the redevelopment runbooks.

The tightened private-member contract remains:

- ordinary members: own private profile only;
- Admin/President: governed cross-member private administration;
- Secretary: only explicitly authorized governed mutations, without broad private read/list escalation;
- VP/Auditor/ministry leaders: no broad cross-member private-profile read/list authority merely from role membership;
- public/member-facing directory usage goes through the sanitized `member_directory` projection or trusted server boundaries.

## Evidence that must remain empirical

Unless a later provider-side record is supplied, do not silently mark these as passed:

1. exact isolated Firebase/App Hosting staging project, backend, generated URL, rollout/revision and provider deployment status;
2. deployed `/api/health` success, exact runtime/project/database identity, secret-field review and `staging:evidence` proof;
3. Inbox `notifications(userId ASC, createdAt DESC)` index Ready plus authenticated load/order/filter/detail/privacy acceptance;
4. staging `polls(category ASC, createdAt DESC)` index plus Schedule `Plan & manage` acceptance;
5. final staging projection dry-run/apply and public/private member access matrix;
6. synthetic pending-profile exact-email/collision/legacy/fail-closed matrix;
7. staging Treasury Treasurer/Auditor/VP/ordinary-member authorization matrix;
8. remaining responsive browser/role QA;
9. provider/environment backup and exact rollback/redeployability evidence;
10. physical iPhone PWA/Web Push acceptance;
11. physical Android tablet and multi-device valid/stale endpoint acceptance.

## Approval gates preserved

This checkpoint does not authorize:

- merge of Draft PR #1;
- production deployment/cutover;
- production member-directory backfill or privacy-rule deployment;
- production data migration/restore/destructive operations;
- production Core-status mutation;
- mass live messaging;
- activation of live LINE, Telegram, WhatsApp or Viber connectors;
- public website cutover; or
- staging spend beyond the authorized ceiling.

## Next execution mode

Ordinary Chat mode is appropriate for repository/security/dependency work, exact-head CI/artifact verification, documentation and Draft PR synchronization.

Work mode / Cloud Browser is needed again only when direct provider/browser interaction is required to close an empirical gate. Physical iPhone/Android testing remains a separate device acceptance step.
