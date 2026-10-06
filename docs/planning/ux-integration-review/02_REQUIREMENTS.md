# Requirements and scope

## User outcome

An operator can follow one synthetic case from intake approval through CRM action without losing context, confusing approval with delivery, or exposing an internal UUID as the case's main name. A supervisor can inspect the audit trail. An evaluator can complete the demo without hidden setup knowledge.

## Acceptance criteria

1. Every CRM lead has one stable, unique, human-readable `LEAD-<number>` label, including existing dynamic events, without changing UUID primary/foreign keys or losing provenance. Labels survive refresh, API calls, report links, and demo reset. A migration safely backfills existing rows and enforces uniqueness for future rows.
2. Intake and CRM deep links resolve the same case. A newly ingested event opens its own CRM lead, never the hardcoded `LEAD-017` default. Missing or inaccessible IDs produce an explicit state.
3. The CRM evidence picker shows approved intake response drafts and approved CRM follow-up drafts for the selected lead, with origin, preview, approval state, and an explicit "not delivered" label. It never offers another lead's draft or a pending draft.
4. Draft approval and `Info Sent` remain distinct. `Info Sent` requires a documented external/manual action or a verified simulated delivery record associated with the selected approved draft; it must not imply delivery from approval alone. Any change to existing SQL semantics is specified and tested.
5. The case workspace shows the next valid action for its stage and reason. Only fields relevant to the selected disposition appear. Blocked actions explain the prerequisite before submission, while API validation remains authoritative.
6. Escalation, recovery, delivery, and attempt queues show their parent lead and support direct navigation; a selected lead view filters related records. Global queues remain explicitly labeled as global.
7. User-facing stage/status/reason labels are consistent Spanish, while internal codes and audit IDs remain inspectable. Errors identify the failed step and preserve entered form data.
8. Home and navigation convey task order and role access consistently. Desktop and narrow-screen layouts, keyboard navigation, focus, labels, contrast, loading, error, and empty states are inspected in a real browser.
9. E2E coverage exercises intake → approval → CRM evidence → qualification → recorded action, as well as escalation, follow-up, transfer/recovery, reconciliation, report navigation, role boundaries, and invalid transitions. It asserts database/API state and rendered UI, using isolated synthetic fixtures and no live customer data.

## Constraints

Preserve current role checks, deterministic compliance checks, audit trail, idempotency, synthetic data only, and temporary hosting cost/expiry boundary. A real outbound WhatsApp or partner integration is outside scope.
