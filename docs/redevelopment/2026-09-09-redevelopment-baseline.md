# KCFC Portal Redevelopment Baseline — 2026-09-09

## Status

Redevelopment is active on `redesign/mobile-first-v2`. Production `main` remains untouched until reviewed and approved for merge.

## Approved product direction

- Mobile-first member experience with a desktop leadership workspace.
- KCFC visual identity: Deep Navy `#123B66`, Royal Blue `#2563EB`, Soft Sky `#EAF3FF`, restrained Warm Gold `#D6A84B`, cool off-white surfaces.
- Primary member navigation: **Home / Schedule / Community / Updates / More**.
- Existing Firebase Authentication UIDs and Firestore data are preserved. Schema evolution must be additive and migration-safe.
- KCFC Inbox is the durable communications source of truth. PWA push is the primary alert channel, with email as its default partner. Optional member-connected secondary channels are planned in this priority order: LINE, Telegram, WhatsApp (subject to current provider onboarding/pricing), with Viber lower priority. SMS is a future paid escalation channel rather than a baseline dependency.

## Schedule UX priority

Schedule browsing is a P0 member experience, not an admin-only matrix.

The new Schedule experience begins with three member-oriented views:

1. **All schedule** — chronological KCFC Mass schedule with expandable published ministry rosters.
2. **My ministry** — a personalized timeline containing only the member's upcoming liturgical assignments and community duties.
3. **Availability & duties / Plan & manage** — compatibility access to the existing detailed duty and assignment workspace while the leader workflow is progressively rebuilt.

Liturgical rosters shown in the member-facing schedule currently focus on:

- Lector & Commentator
- Ushers
- Altar Servers

The existing code contains a PPT assignment phase, but PPT is not treated as a primary ministry in the new member-facing experience until the product owner confirms that requirement.

## Availability-to-assignment workflow

1. An authorized administrator/officer/ministry leader creates a multi-Mass availability request.
2. Eligible ministry members select every Mass where they are available to serve.
3. Leaders monitor responses and missing responders.
4. The request closes and becomes the availability source for assignment planning.
5. Leaders build the roster by ministry.
6. A final roster is published separately from availability.
7. Members receive their assignments and reminders through the Portal communications layer.

Member-facing language should use **Availability Request**, **My Ministry Schedule**, **Published Roster**, and **Assignments**, avoiding implementation terms such as “committee poll” or “matrix in duties.”

## First implementation increment

Commit scope:

- New KCFC design tokens and accessible base reading scale.
- Persistent desktop sidebar.
- Five-item mobile navigation without horizontal scrolling.
- Mobile More sheet for Resources, Inbox, Profile, Accounting and leadership tools.
- Role-aware tool visibility.
- New Schedule wrapper preserving the existing duties implementation as `LegacyDuties.tsx`.
- Whole-schedule browsing and a personal ministry timeline layered over existing Firestore data without destructive writes.

## Safety constraints

- Do not delete or regenerate existing Firebase users.
- Do not change production Firestore data as part of UI development.
- Do not expose draft/private assignment data to ordinary members.
- Member schedule shows assignment names only when the existing liturgical workflow is closed and the core Lector/Commentator, Altar Server and Usher phases are completed.
- Legacy deep links such as `/duties?tab=liturgical&pollId=...` remain functional by automatically opening the detailed management view.

## Next increments

- Home redesign with next assignment, pending availability, latest announcement and schedule highlights.
- Dedicated availability request member screen and submitted-state screen.
- Leader response progress and availability matrix redesign.
- New assignment builder and explicit Published Roster state.
- Notification onboarding / health diagnostics and communication-channel preferences.
- Community directory and Updates redesign.
- Public/parishioner schedule and website publishing projection.
