# KCFC Portal Redevelopment Specification v4 — Release Notes

Date: 10 September 2026

The canonical working specification has been advanced to **v4 — Communications + Schedule + Staging Safeguards**.

## What v4 locks in

- Official KCFC navy / royal-blue design direction; stale olive-era visual guidance is retired.
- Mobile primary navigation: Home / Schedule / Community / Updates / More.
- My Ministry and Entire Schedule as first-class member experiences.
- Liturgical availability is explicitly availability **to serve**, separate from final assignment publication.
- Leader workflow: create request → monitor responses → availability matrix → assignment builder → deliberate final publication.
- KCFC Inbox as durable communication source of truth.
- PWA push as primary alert and email as default partner.
- LINE as first optional Japan-focused connector, Telegram second, WhatsApp future/conditional, Viber low priority, SMS future paid escalation.
- Install KCFC → Enable Notifications → register/repair device → Send Test Notification onboarding.
- External connectors are opt-in, never required, mapped securely to Firebase UID server-side and disabled by default.
- Existing Firebase Auth users/UIDs and existing Firestore records are retained.
- Additive/backward-compatible schema evolution only for the first redevelopment cutover.
- Production merge/deploy, destructive migrations, bulk user changes, live connector activation, mass outbound tests and website cutover each remain explicit approval gates.

## Implementation alignment

The active branch `redesign/mobile-first-v2` already implements or scaffolds the major v4 areas:

- Responsive shell and navigation.
- Home, Schedule, Community, Updates, Inbox and Profile redesigns.
- Liturgical availability, response monitoring, matrix, assignment builder and explicit publication.
- Notification health and guided test-push flow.
- Connected-app preference foundation.
- Communication routing policy helper and connector feature gates.
- Resources redesign.
- Safe legacy-preserving shells for Accounting and Admin.
- CI validation and staging-readiness checklist.

## Document QA

The v4 DOCX was rendered to 28 pages using the standard DOCX render workflow. All 28 rendered pages were visually inspected after the final pagination/layout update. No clipping, overlap, broken tables, missing glyphs or footer/header collisions were observed in the final render.

## Change control

v4 is the current redevelopment baseline, not an immutable product freeze. Requested UI or workflow changes can be incorporated during implementation, but consequential changes to identity/data preservation, production authority or external communication activation require an explicit decision record.
