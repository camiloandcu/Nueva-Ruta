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
