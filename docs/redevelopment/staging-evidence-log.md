# KCFC Portal — Staging Evidence Log

Date opened: 2026-09-10
Branch: `redesign/mobile-first-v2`

This log records evidence gathered during redevelopment. It does **not** authorize production deployment and does not replace the staging-readiness checklist.

## Evidence E-001 — Repository baseline

- Production branch: `main`
- Verified production SHA at latest check: `653cc7229600fd7baff17a21a21f12d267b66d2b`
- Redevelopment branch: `redesign/mobile-first-v2`
- Draft PR: #1
- Production `main` had not moved from the redevelopment baseline at the latest verification.
- No production merge or deployment occurred during this evidence collection.

Result: **PASS — no upstream drift detected at latest verification.**

## Evidence E-002 — Core redevelopment CI

GitHub Actions workflow: `KCFC Redevelopment CI`

Current mandatory steps:

1. dependency installation,
2. TypeScript validation (`npm run lint` / `tsc --noEmit`),
3. synthetic communication-policy verification,
4. production build,
5. external-connector default-OFF guard,
6. provider-secret browser-exposure guard.

Result through the normalized Announcements implementation head `295ad9d11767160b731232210156fe3afeea5018`:

- TypeScript: **PASS**
- Communication policy verification: **PASS**
- Production build: **PASS**
- Connector default-OFF guard: **PASS**
- Browser-secret guard: **PASS**

GitHub Actions run: **#92 / run id 34443219237 — SUCCESS**.

## Evidence E-003 — Communication routing invariants

Executable synthetic checks cover:

- Inbox remains present for a normal announcement.
- Inbox remains present when routine announcement alerts are muted.
- Composer can disable PWA without removing Inbox/email.
- Composer can request Inbox-only delivery.
- Assignment routing uses `important` urgency.
- External provider remains excluded while connector gate is disabled.
- External provider can only enter a routing plan when the caller gate is enabled, the member opted in and the provider is connected.
- Notification record builder de-duplicates and retains Inbox.
- Disabled users are excluded from new operational audience delivery.
- KCFC Members require current verified-member state.
- Leadership audience requires a leadership role.

Result: **PASS in CI.**

Important: the external-connector-positive test validates only pure routing logic. All actual connector environment flags remain OFF and no external message is sent.

## Evidence E-004 — Announcement creator normalization

New announcement publication now uses the shared:

- audience eligibility helper,
- routing-policy helper,
- notification-record helper.

Behavior validated by TypeScript/build/policy CI:

- Inbox record remains the durable communication record.
- Member routine-alert preference no longer erases the Inbox record.
- PWA token collection occurs only when the publisher enabled push and the recipient routing plan includes PWA.
- Duplicate FCM tokens are removed before the push request.
- New Inbox records carry source, urgency, channels, audience and routing rationale metadata.
- External providers remain disabled.
- Public website synchronization remains `not_requested`.

Result: **IMPLEMENTED + CI GREEN**.

## Evidence E-005 — Specification v4 visual QA

Artifact: `KCFC_Portal_Redevelopment_UI_UX_Feature_Specification_v4_2026-09-10.docx`

- Final render: 28 pages.
- All 28 pages visually inspected after final layout/pagination changes.
- No clipping, overlap, broken tables, missing glyphs, or header/footer collision observed.

Result: **PASS — documentation visual QA.**

## Evidence still required before production request

No production readiness claim is made yet. Evidence is still required for:

- real staging sign-in with synthetic role accounts,
- Firestore compatibility against isolated staging data,
- iPhone/iPad PWA install and Web Push behavior,
- Android/Chromium install and push behavior,
- multi-device notification registration,
- liturgical availability → matrix → assignment → publication end-to-end staging flow,
- Resources role checks,
- Accounting regression against non-production sample data,
- Admin regression with synthetic accounts,
- keyboard/accessibility/device-width checks,
- backup/rollback proof immediately before any production approval request.

## Production authority

This evidence log grants **no** authority to:

- merge/deploy production,
- mutate production users in bulk,
- run destructive migration,
- send production mass notifications,
- enable LINE/Telegram/WhatsApp/Viber,
- switch on public website publishing.

Those remain explicit approval gates.
