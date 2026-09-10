# Leadership Workspace Decomposition — 2026-09-10

Branch: `redesign/mobile-first-v2`

This increment moves common leadership work out of the preserved all-in-one `LegacyAdmin.tsx` surface while keeping production data, Firebase Auth identities and destructive controls unchanged.

## Focused workspaces now available

### Leadership overview
- Keeps the read-only attention snapshot for pending approvals, unread inquiries, active availability cycles and unpublished rosters.
- Does not mutate production records.

### Website inquiries
- Reads existing `messages` records.
- Supports unread, active and archived views plus search.
- Supports mark read/unread, archive and restore.
- Does not expose message deletion or automatic Gmail sending in the routine queue.
- Gmail reply functionality remains only in the preserved advanced legacy workspace until its own governed flow is migrated.

### Member communications
- Uses the rebuilt Broadcast composer.
- Every leadership broadcast creates a durable KCFC Inbox record.
- PWA and email remain secondary channels and stay preference-aware.
- Live mass-message execution is not exercised by redevelopment CI.

### Member administration
- `MemberApprovalQueue` provides a focused verification flow for existing member profiles.
- Verification changes only `isVerified` plus the normal update timestamp; it does not recreate Firebase Auth users, change UIDs, or alter roles/ministries.
- `MemberRoleEditor` provides a governed role/ministry editor for verified non-admin members.
- The Member role is retained automatically.
- Centralized governance validates special-role limits, President exclusivity, the bounded Core-member dual-role rule, leadership-to-ministry requirements, Core-member requirements for leadership/chore assignments, Choir exclusivity, and Cleaning-status dependencies.
- Saving updates the existing Firestore member profile only.
- Removing Lector/Commentator membership clears stale `lcRoles`; existing Cleaning toilet status is preserved while Cleaning remains selected.

### Advanced legacy tools
- `LegacyAdmin.tsx` remains available as a protected compatibility surface.
- Core-member status changes, account disabling, profile deletion, credential purge and Gmail inquiry replies remain there for now.
- Potentially destructive actions remain approval-gated for production use.

## Governance implementation

`src/lib/memberGovernance.ts` centralizes role/ministry validation instead of duplicating rules in each new UI. `scripts/verify-member-governance.ts` exercises the key invariants in CI.

Covered cases include:
- Member role normalization;
- President exclusivity;
- regular-member leadership/chore rejection;
- Choir versus other liturgical ministry exclusivity;
- leadership-role matching-ministry requirements;
- organization-wide role limits;
- allowed Core-member Executive + Kitchen/Cleaning leadership dual-role case;
- rejection of unsupported multi-role combinations.

## Validation evidence

- Leadership inquiry integration: GitHub Actions run `34466676340` — PASS.
- Member governance helper and regression test: run `34466868035` — PASS.
- The first focused roles-editor integration correctly failed TypeScript because a Firestore `serverTimestamp()` field had been typed as the profile's string timestamp. The source typing was corrected before proceeding.
- One-time correction runner `34467242659` — PASS: corrected source typecheck, governance test and production build all passed before the correction commit was pushed.
- Cleanup CI on the corrected source completed TypeScript, all communication/liturgical/broadcast/governance checks, production build, connector-off guards and browser-secret guards successfully in run `34467385032`.

## Safety status

No production merge or deployment has occurred. No Firebase user has been deleted or recreated. No destructive migration, Core-member downgrade, live mass broadcast, external connector activation or public website publishing cutover was performed by this increment.

## Next decomposition targets

1. Add change-summary/preview ergonomics to governed member role/ministry changes.
2. Model Core-member status transition as a pure preview/plan before considering a focused mutation flow, because downgrades can affect roles and chore ministries.
3. Continue isolated role/regression and mobile accessibility testing.
4. Keep destructive identity/account actions in Advanced tools until a separately reviewed governed workflow exists.
