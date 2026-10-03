## Why

WI-004 creates safe leads, drafts and idempotently created escalations, but operators cannot yet record dispositions, manage escalations through resolution, or complete a controlled partner handoff. WI-005 adds those operational outcomes while keeping commercial, escalation and delivery states independent and preserving an auditable human gate for every transfer.

## What Changes

- Add the full escalation lifecycle: assignment, claim, SLA tracking, resolution and reasoned closure, with role checks and append-only audit evidence.
- Add exactly five CRM disposition commands with the mappings and required data defined in REQ-B01–B03. Invalid values and invalid stage changes return actionable errors without partial state changes.
- Add an explicit operator qualification step from `new` or `under_review` to `prequalified`, with reason and audit evidence, so the approved transition path is reachable from WI-004 leads.
- Keep commercial lead stage independent from escalation and delivery state. `escalated` remains an operational task state, not a commercial stage.
- Add transactional outbox records for required simulated external effects, bounded retries with configurable backoff, delivery attempts, terminal dead-letter state and authorized manual replay.
- Add an explicit transfer approval command that atomically records actor approval, transfer and outbox request. A disposition label, pre-qualification, or replay cannot authorize a transfer.
- Add n8n disposition and partner-transfer workflows plus a synthetic Consejería Clara webhook simulator with success, retryable failure and permanent-failure modes.
- Add operational UI for dispositions, escalation ownership/SLA, delivery status and recovery of missing-phone work, invalid commands, exhausted retries and manual replay.
- Preserve WI-004's no-real-delivery boundary; all partner and messaging effects remain synthetic and non-contactable.

## Capabilities

### New Capabilities

- `crm-dispositions`: validated disposition commands, commercial stage transitions and their audit records.
- `partner-delivery`: transactional outbox, simulated transfer delivery, retry/dead-letter lifecycle and safe replay.

### Modified Capabilities

- `human-draft-review`: extend owned escalations from creation/idempotent update to assignment, claim, SLA, resolution and closure.

## Impact

- Affected areas: Supabase migrations and deterministic reset, FastAPI CRM/escalation/outbox contracts, Next.js operational screens, n8n exports, simulator contracts, tests and WI-005 implementation evidence.
- Data: adds disposition history, escalation lifecycle evidence, transfer approvals/records, outbox events and append-only delivery attempts. Existing lead, draft and rule-version records remain authoritative for their current facts.
- External effects: no real partner connectivity or message delivery; no hosted account is required.

## Acceptance criteria

- Each supported disposition maps exactly to its documented commercial stage and required evidence; unknown dispositions are rejected and audited as actionable errors.
- Authorized operators can qualify eligible leads; opt-outs, ignored decisions and unresolved escalations cannot be qualified for transfer.
- Every accepted disposition records actor, time, prior/resulting stage, reason, relevant draft/rule/template evidence and side-effect status atomically.
- Callback without a future timestamp and timezone fails without mutation.
- `No Answer` maps to `contact_attempted` when the lead has a usable phone or a documented missing-phone recovery task; missing-phone work remains visible.
- `No Answer` with a usable phone creates an editable follow-up draft that remains pending until an authorized operator approves it after deterministic compliance review.
- Escalations can be assigned/claimed, show due time and breach state, and resolve or close with reason while preserving commercial stage.
- Only an authorized operator's explicit approval creates a partner transfer. Repeated commands with the same idempotency key return the same transfer; duplicate transfer requests cannot create another partner case.
- Retryable delivery failures are retried according to configured bounded backoff; successful effects are never repeated; exhausted effects enter a DLQ and authorized replay is audited and idempotent.
- UI and API expose recovery for webhook failure, missing phone, invalid disposition, exhausted retry and manual replay.
- Simulator and n8n demonstrate success, retryable failure, permanent failure, terminal DLQ and replay without real delivery.

## Verification

- Unit and database tests for transition tables, required fields, permissions, SLA calculations and transaction rollback on invalid commands.
- Idempotency and outbox integration tests, including repeated approvals, concurrent delivery claims, retry exhaustion and replay.
- API/UI authorization and recovery-path tests for operator, supervisor and analyst roles.
- n8n/API/simulator contract tests and end-to-end success, retry and dead-letter/replay paths.
- Validate migrations/reset, application checks, exported workflows and OpenSpec specs; record results in `docs/implementation/05_WI-005_VERIFICATION.md`.

## Out of scope

- Partner CSV import, cleaning or reconciliation.
- Aggregate funnel/stalled-work reporting beyond operational queues needed to execute and recover WI-005 work.
- Real partner APIs, real messaging, hosted services or production consumer data.
- Monetary commission calculation or changes to WI-004 AI behavior.
