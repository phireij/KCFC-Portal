# Liturgical Availability Workflow

## Purpose

The Liturgical Availability feature is the pre-assignment step for Lector & Commentator, Ushers and Altar Servers. It answers a single operational question:

> Which upcoming Masses can each ministry member serve?

It must not be presented to members as a generic attendance poll.

## Member experience

1. Open **Availability** from Home, Schedule or a notification deep link.
2. See only active requests relevant to liturgical service.
3. Select every Mass where the member can serve.
4. Submit once.
5. See a clear **Submitted** state and the number of selected Masses.
6. Edit the response until the deadline.
7. If unavailable for all listed Masses, explicitly submit that state rather than leaving the request unanswered.

The response remains compatible with the current `polls/{pollId}/responses` data model:

- `attendance = "yes"` when one or more Mass dates are selected.
- `attendance = "no"` when the member explicitly submits no available dates.
- `selectedOptions` contains the selected Mass-date strings.

## Leader experience

Authorized leaders include the existing executive managers plus the Lector & Commentator leader, Usher leader and Altar Server leader.

Leader view provides:

- Create Liturgical Availability Request.
- Add multiple Mass dates and optional Mass descriptions.
- Set a response deadline.
- Publish the request.
- Track response percentage and missing responders.
- Review the number of available dates per member.
- Close/reopen the response window.
- Hand the closed request to the assignment workspace.

## Notifications

Publishing a request creates KCFC Portal notification records for verified, enabled members whose ministries include:

- `lector_commentator`
- `usher`
- `altar_server`

Those notification records are the internal delivery source used by the Portal/PWA notification layer. Email and optional external connectors will be added through the communications router rather than embedded separately into this workflow.

When every eligible ministry member has responded, the request creator plus Admin/President recipients receive a completion notification. The poll receives the additive marker `availabilityCompletionNotifiedAt` to prevent repeated completion notices.

## Legacy compatibility

The previous `Polls.tsx` implementation is preserved as `LegacyPolls.tsx` during migration.

It remains available for:

- Chore/Core attendance polls.
- Older poll records and management actions.
- Regression fallback while the new leader tools mature.

Deep links targeting a legacy Core/Chore poll automatically open the legacy poll workspace.

## Safety

- Existing poll IDs are retained.
- Existing response subcollections are retained.
- No response history is bulk-deleted or migrated.
- The new member flow writes only the current member's response document.
- Closing a request does not delete responses or assignments.
- Deletion remains outside the new streamlined member/leader workflow.
