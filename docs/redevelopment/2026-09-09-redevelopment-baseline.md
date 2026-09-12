# KCFC Portal Redevelopment Baseline

Date established: 9 September 2026
Current specification revision: **v4 — Communications + Schedule + Staging Safeguards (10 September 2026)**

## Repository baseline

- Repository: `phireij/KCFC-Portal`
- Production branch: `main`
- Verified production baseline SHA: `653cc7229600fd7baff17a21a21f12d267b66d2b`
- Redevelopment branch: `redesign/mobile-first-v2`
- Production `main` remains untouched while redevelopment continues in the branch/draft PR.

## Product objective

Redevelop the existing KCFC Portal into a mobile-first, member-friendly community platform while preserving current Firebase Auth identities, Firestore records and critical operating workflows.

The new Portal must make the most common member questions answerable immediately:

- What is happening next?
- Where am I serving?
- When am I serving?
- What do I need to respond to?
- What important KCFC message did I miss?

Leadership workflows must be powerful without exposing their complexity to ordinary members.

## Navigation baseline

Mobile primary navigation is fixed at five destinations:

1. Home
2. Schedule
3. Community
4. Updates
5. More

Desktop uses the same information architecture through a persistent left sidebar and wider leadership/data views.

## Visual baseline

The previous olive visual identity is retired for redevelopment surfaces.

- KCFC Navy: `#123B66`
- Royal Blue: `#2563EB`
- Soft Sky: `#EAF3FF`
- Warm Gold: `#D6A84B` sparingly
- Cool Off-White: `#F7F9FC`
- Blue-Black: `#172033`
- Slate: `#64748B`
- Border: `#DDE5EE`

Design priorities: readable mobile typography, 44 px minimum touch targets, restrained card styling, strong information hierarchy, accessible focus states and WCAG AA-targeted contrast.

## Schedule / liturgical baseline

Availability to serve is distinct from attendance and distinct from the final published assignment.

Leader flow:

`Create Availability Request → Monitor Responses → Availability Matrix → Build Assignments → Publish Final Roster`

Member flow:

`Open Request → Select every Mass where available → Submit / revise → Receive final assignment → Browse My Ministry`

The member-facing Schedule must support both **My Ministry** and **Entire Schedule**, including search, ministry filters, upcoming/history browsing, Mass details and explicit roster publication privacy.

## Communications baseline

1. KCFC Inbox is the durable source of truth.
2. PWA/Web Push is the primary alert channel.
3. Email is the default partner channel.
4. LINE is the first optional Japan-focused connector.
5. Telegram is the next optional connector.
6. WhatsApp is future/conditional.
7. Viber is low priority.
8. SMS remains a future paid escalation path.

Optional external messaging apps are never required for KCFC membership.

Install/notification onboarding is deliberately separated:

`Install KCFC → Enable Notifications → Device Registration/Repair → Send Test Notification → Done`

External provider credentials are server-side only. Provider linking is opt-in, mapped to Firebase UID and disabled by feature flags until explicitly approved.

## Data preservation baseline

- Existing Firebase UID remains the identity key.
- No member account recreation for first cutover.
- Schema evolution is additive/backward-compatible.
- Existing users, polls, responses, duties, assignments, announcements, notifications, resources and accounting records remain readable.
- Critical legacy engines may remain behind redesigned shells until replacement workflows pass regression validation.
- No production users are used as dummy test accounts.

## Public website baseline

The Portal is intended to become the editorial source of truth for future public announcements/schedules, but website synchronization remains OFF until separately designed, security-reviewed and explicitly approved.

Private member data, internal roster details, accounting, poll responses and internal leadership content must never be exposed through the public projection.

## Validation and production authority

Redevelopment CI validates TypeScript and production build and includes connector-safety guards.

Before requesting production approval, staging must validate representative roles, existing data compatibility, mobile navigation, Schedule, liturgical planning, PWA reliability, communication routing, Resources, Accounting/Admin compatibility, accessibility, backup and rollback.

The following remain explicit approval gates:

- merge/deploy to production,
- destructive migration,
- bulk user mutation,
- live external connector activation,
- mass outbound messaging tests,
- public website publishing cutover.

## Documentation baseline

Living redevelopment documentation is maintained under `docs/redevelopment/`, including schedule UX, liturgical workflow, communication routing, communication event metadata, connector linking, staging readiness and v4 specification release notes.

Completion will also require member/admin guides, quick-start material, presentation material and task-based video tutorial scripts/storyboards after the stable release candidate exists.
