# n8n workflows

`wi-004-inbound-ingestion.json` is the reviewable synthetic inbound workflow. It
orchestrates one authenticated FastAPI call and branches on the same safe
execution dimensions stored by the API: technical failure, rejected output,
intentional deterministic processing, and success. It never sends a message.

`wi-005-partner-transfer.json` dispatches already-approved outbox work through
the authenticated CRM API and branches on partner acceptance, scheduled retry,
or dead-letter recovery. n8n does not approve transfers, write domain tables,
or call the partner simulator directly. The webhook body carries the current
operator access token and an optional simulator mode (`success`,
`retryable_failure`, or `permanent_failure`) for the synthetic demonstration.

`wi-005-crm-disposition.json` submits an operator-reviewed disposition through
FastAPI only. The caller supplies the lead UUID, current operator token, exact
disposition payload, idempotency key, reason and correlation ID. The workflow
branches on the resulting commercial stage and returns validation/recovery
errors without retrying a rejected state command. It does not approve partner
transfers or send messages.

The supervisor-only synthetic reset now recreates the WI-005 preview cases: an
eligible lead, a missing-phone recovery item and an overdue escalation. It
clears CRM delivery/disposition state inside the reset transaction while
retaining general audit events. Callback validation and delivery success,
retryable-failure and permanent-failure modes are exercised by API/database
tests and the explicit simulator mode selector rather than by pre-authorizing a
partner transfer during reset.

`wi-006-partner-import.json` receives an imported synthetic partner job ID,
forwards the caller's current operator access token to FastAPI normalization
and reconciliation, and returns the resulting counts or an actionable error.
It does not save execution payloads, access Supabase tables, or make analyst
decisions. Next.js dispatches jobs through the local
`N8N_PARTNER_IMPORT_WEBHOOK_URL` setting.
