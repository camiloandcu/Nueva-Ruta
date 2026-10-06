## Why

The case identity and messaging flow now works, but the operator still crosses a long CRM page with global escalation, recovery, draft and delivery lists beside one selected case. The home presents four numbered areas while the navigation exposes more routes. On a narrow screen, the case action sits above a lengthy global queue, making the relationship between records unclear. Raw states such as `under_review` and `dead_letter` make decisions harder to scan. The approved UX review calls for a task-oriented workspace and explicit queue scope.

## What Changes

- Reorganize the authenticated home into the approved task groups: Bandeja, Casos, Operación, Resultados and Administración, with links appropriate to the signed-in role.
- Give a selected case a compact shared header with `LEAD-…`, stage, consent/source context and the next valid action. Group its message, activity and history in a predictable order with direct links to source evidence.
- Move or label global escalations, recovery items, partner attempts and follow-up work so each record names its own case. Selecting a lead must not make unrelated global work appear case-specific.
- Centralize Spanish display labels for known stages, dispositions, reason codes and statuses while keeping stored/API values stable.
- Show section-specific loading, empty and failure states with retry. Preserve selection, entered values and keyboard focus through updates. Keep desktop and mobile views usable without hiding primary actions.
- Replace hardcoded report filter choices with choices derived from available reporting data or a role-safe filter-options contract, preserving the same applied filter context.

## Capabilities

### New Capabilities

- `operator-workspace`: task-oriented navigation, case context, scoped work queues, and accessible action feedback.

### Modified Capabilities

- `operational-reporting`: available filter choices match actual supported data and are presented with clear applied state.

## Acceptance Criteria

- From home, an operator can find a new intake event, open its exact CRM case, identify the next allowed action, inspect its activity, and return without losing case context.
- Every queue visibly says whether it is global or case-specific. Each global item with a linked lead displays a `LEAD-…` label and opens that exact case; unlinked items explain why no case link exists.
- The case area does not silently combine records from other leads. A loading or API failure in one section gives a local retry and does not erase successful sections.
- Labels are understandable in Spanish while audit IDs remain accessible in details. Focus order, labels, contrast, and 390 px layout pass authenticated desktop/mobile review.
- Reporting filters offer only valid choices and retain the chosen context through pagination and drill-through. Existing database/API authorization and domain transitions stay enforced.

## Out of Scope

- New CRM disposition rules, real outbound delivery, changing immutable IDs, or rewriting historical audit records.
- The separate cross-module regression and closure work item after this workspace change.

## Review Notes

This is work item 3 of the [approved UX integration review](../../../docs/planning/ux-integration-review/00_INDEX.md). Implementation starts only after this proposal is reviewed, per the repository workflow.
