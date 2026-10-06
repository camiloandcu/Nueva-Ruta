## Case evidence read model

Use FastAPI as the authenticated boundary. The endpoint receives a CRM state UUID and returns only drafts linked through that state's source event or directly through its follow-up relationship. Intake content uses `approved_content` and approved checksum; follow-up content uses its approved version. Include origin, approval status/time, safe preview, and delivery evidence. Query by the selected case ID server-side rather than loading all drafts into the browser and filtering there. Keep internal IDs for commands and audit details.

## Delivery event and command

Add a durable `crm_message_delivery_events` table with one CRM state, one approved draft reference (intake or follow-up), actor, simulated channel, timestamp, content checksum, idempotency key, correlation ID, and result. Exactly one draft kind must be set. A database RPC validates that the draft is approved and belongs to that state; it checks opt-out/consent and replays a duplicate idempotency key without creating a second event. The command records a **simulated** delivery, never contacting an external provider.

`Info Sent` accepts `delivery_event_id` or a non-empty `external_action_reference`. The disposition RPC rechecks that the delivery belongs to the same CRM state and an approved draft. It stores the delivery reference and `simulated_delivery` side-effect status atomically with the stage/audit event. Historical rows retain their previous `approved_draft` value but are presented as legacy approval evidence, not proof of sending.

## UX path

On an `under_review` case, show the approved draft as available evidence but guide qualification first. For an eligible stage, the operator selects a draft and explicitly records simulated delivery. The UI then offers `Info Sent` with that delivery preselected, or a distinct documented-manual-action route. Other dispositions reveal only their own required controls. Loading, validation, and mutation feedback remain scoped to the case and preserve entered values after errors.

## Verification

Use a clean local migration and pgTAP checks for ownership, idempotency, state and consent guards, and atomic rejection. API tests verify the case-scoped response and role protection. Playwright drives intake approval → CRM qualification → simulated delivery → `Info Sent`, checks UI and API state, and repeats against a wrong lead. Inspect desktop and mobile rendering before release. Hosted rollout uses the authorized MCP path only after local verification and within WI-009's temporary-demo constraints.
