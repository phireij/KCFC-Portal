# KCFC Portal — Leadership & Treasury Modernization Increment

Date: 2026-09-10
Branch: `redesign/mobile-first-v2`

## Purpose

Continue progressive migration away from monolithic legacy administration/accounting presentation without changing the proven underlying write workflows, permissions or production data model.

## Leadership console increment

A new read-only leadership operations snapshot now appears above the preserved administration engine.

It summarizes:

- pending/unverified member profiles,
- unread website inquiries,
- active liturgical availability cycles,
- closed explicit-publication liturgical cycles whose roster has not yet been published.

The panel is intentionally read-only. It does not approve users, change roles, publish rosters, archive inquiries, send broadcasts or mutate any Firestore document.

Queue calculation is isolated in `src/lib/leadershipQueueMetrics.ts` so the operational rules can be tested without Firestore side effects.

## Treasury increment

A new read-only Treasury at a Glance summary now appears above the preserved accounting engine.

It shows:

- approved balance,
- approved income,
- approved expenses,
- current-month approved income/expense subtotals,
- pending transaction count and pending amount.

Pending entries are deliberately excluded from approved totals and approved balance. This avoids presenting unapproved records as settled community funds.

The original transaction/category/approval/receipt/export engine remains available unchanged below the summary. The new calculation logic is isolated in `src/lib/treasuryMetrics.ts` and does not write any accounting document.

## Validation

The synthetic policy verification now covers:

- leadership queue counting rules,
- exclusion of disabled profiles from pending-member attention counts,
- unread inquiry counting,
- explicit unpublished-roster review counting,
- approved-versus-pending treasury separation,
- approved balance calculation,
- current-month treasury subtotals.

The existing CI gate continues to run TypeScript validation, synthetic policy verification, production build, connector default-OFF checks and browser-secret exposure checks.

## Safety posture

No production deployment or merge occurred.
No user, poll, roster, message or accounting record was changed by this increment.
No live connector or website publishing path was activated.
The preserved legacy administration and accounting engines remain the operational fallback during redevelopment.
