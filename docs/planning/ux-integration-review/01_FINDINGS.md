# Findings from operator and customer perspectives

## Confirmed defects

1. **Approved intake draft is absent from CRM selection.** The CRM form loads only `crm_follow_up_drafts` and sends only `crm_follow_up_draft_id`. The API and database also support `draft_id` for an approved `response_drafts` record belonging to the selected intake event. The reported event `783cd6ac-caf4-5a85-bc57-65163db8a1b6` has approved response draft `15c87a8a-a29e-5f99-ad04-c883588334fe`, CRM state `34c2f25d-5119-40de-9f8a-9e0fcdf7a142`, stage `under_review`, and no CRM follow-up draft (read-only hosted query, 2026-10-05). Its approval does not mean the message was delivered.
2. **Inconsistent case labels.** `operational_crm_leads` uses `coalesce(lead.business_id, event.id::text)`. All 48 seed leads are `LEAD-001` through `LEAD-048`; six newer events display UUIDs (hosted query, 2026-10-05). These are two origins of one CRM entity, not two meaningful lead types. The UUID is an internal key.
3. **Broken continuation from intake to CRM.** Intake's "Abrir CRM" link has no case identifier; CRM initially selects `LEAD-017` or its first row. An operator can accidentally act on a different lead. The intake result also foregrounds UUID and correlation values instead of a human-readable case and next action.
4. **Misleading delivery evidence.** The UI says draft approval does not deliver a message, but `Info Sent` can currently be recorded with an approved draft alone. The current spec calls for an approved draft *and simulated delivery evidence*, or a documented manual action. The proposed workflow must distinguish approved, delivered, and manually recorded states.
5. **Forms expose invalid actions.** The CRM disposition form is always visible, although the database rejects most dispositions from `new` and `under_review`. Callback date, opt-out, external reference, and draft fields are shown for every disposition. Errors are generic because the API collapses SQL validation failures into "CRM command failed validation".

## UX and information-architecture critiques from source inspection

6. Home shows four numbered areas while the navigation has seven; partner reconciliation and rule/execution supervision lack the same task hierarchy. This obscures the operator's actual sequence: receive → review → qualify → record contact → transfer → reconcile → report.
7. CRM combines case action, escalation queue, recovery, follow-up drafting, delivery simulation, and attempt history in one long two-column page. A single lead selection does not filter much of the right column, so records appear related when they may belong to other leads.
8. Stages, reason codes, statuses, and time zones are mixed English/Spanish and often displayed as raw database values (`under_review`, `pending_review`, `dead_letter`). This makes scanning and explanation harder for Spanish-speaking operators.
9. Intake lists events, CRM lists leads, and reports list outcomes, but they lack a shared case header and direct deep links. IDs used for audit are shown as primary labels; provenance should be available on demand.
10. Async failures and success messages often use one global CRM status line. Parallel fetches may fail silently and leave stale sections. The operator cannot tell which evidence refreshed after an action.
11. The reporting creator and state filters are hardcoded. They risk showing choices that do not correspond to available records or future fixture changes.
12. The site's visual hierarchy, responsive layout, focus flow, and contrast remain **unverified** until an authenticated browser walkthrough is possible. Source inspection cannot establish the rendered experience.

## Existing verification

The 12 web architecture tests and 12 selected API/contract tests pass on 2026-10-05. They do not exercise the browser workflow, database trigger chain, visual layout, or the reported case end to end.
