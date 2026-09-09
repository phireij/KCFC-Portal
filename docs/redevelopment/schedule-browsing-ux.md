# KCFC Portal — Schedule Browsing UX

## Purpose

The Schedule experience is designed so a KCFC member can answer three questions immediately:

1. What is the next KCFC Mass or event?
2. Am I serving, and what is my role?
3. Who is assigned in each liturgical ministry?

It must remain fast and understandable on a phone while scaling cleanly to tablet and desktop.

## Primary member views

### All Schedule

The default schedule browser shows Mass dates grouped by month and ordered chronologically.

Members can:

- switch between Upcoming and All Dates,
- search by Mass title, date, member name, ministry or role,
- filter to Lector & Commentator,
- filter to Ushers,
- filter to Altar Servers,
- filter to Where I Serve,
- open a Mass to see its published ministry roster,
- immediately recognize Masses where they personally serve.

Unpublished assignment names must never be exposed to ordinary members.

### My Ministry

This is the personal schedule view. It intentionally removes unrelated roster noise and shows only assignments belonging to the signed-in member.

It includes:

- Upcoming assignments,
- Assignment History,
- liturgical assignments,
- community duties such as kitchen and cleaning when assigned,
- date, role, Mass/event title and ministry context.

The member should not need to search manually for their own name in the full roster.

### Availability & Planning

Availability remains a separate concept from a final assignment.

The workflow is:

1. Leader publishes an availability request covering one or more Mass dates.
2. Member selects every Mass where they are available to serve.
3. Leader reviews response progress and the availability matrix.
4. Leader creates assignments.
5. Final roster is explicitly published.
6. Published roster appears in All Schedule and My Ministry.

## Mobile UX rules

- Five fixed primary navigation destinations only: Home, Schedule, Community, Updates, More.
- Minimum interactive target: 44 px; 48–56 px preferred for frequently used schedule controls.
- Search and filter controls must work without horizontal page scrolling.
- Month grouping should create a clear visual scanning rhythm.
- A Mass with the signed-in member assigned must receive a visible but restrained highlight.
- Expanding one Mass must not navigate the user away unless they deliberately open a detail workflow.
- Empty and filtered-zero states must explain what happened and offer an obvious recovery path.

## Desktop UX rules

- Preserve the same information architecture as mobile.
- Use available width for faster roster comparison rather than adding extra navigation levels.
- Ministry roster groups can display in columns.
- Leadership planning remains role-gated and visually distinct from the member schedule.

## Data safety

The schedule browser is a read-only projection over existing Firestore records during this redevelopment stage.

- Existing Firebase UIDs remain unchanged.
- Existing member records remain unchanged.
- Draft assignment names are not shown publicly to members.
- No destructive migration is required for schedule browsing.

## Future enhancements

Planned follow-up enhancements include:

- explicit roster publication state,
- Mass-detail routes with shareable deep links,
- calendar export / add-to-calendar options,
- optional reminders before a member's assignment,
- leader reassignment workflow with member notification,
- public/parishioner schedule projection for selected events and Masses.
