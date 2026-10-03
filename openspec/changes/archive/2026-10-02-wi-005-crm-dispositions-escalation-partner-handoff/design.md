## Context

WI-004 persists leads, decisions, drafts and idempotently created escalations. The architecture assigns FastAPI/PostgreSQL ownership of domain state and audit, with n8n responsible for visible orchestration and the simulator standing in for partner delivery. WI-005 must add operator-controlled business outcomes without collapsing three independent state dimensions: commercial lead stage, escalation lifecycle and delivery lifecycle.

## Goals and non-goals

**Goals:** implement the five approved disposition mappings; complete the owned escalation lifecycle; require explicit authorized transfer approval; atomically record state changes and side effects; demonstrate retries and recovery against a synthetic partner.

**Non-goals:** partner CSV reconciliation, real external delivery, broad reporting, or changes to eligibility/compliance policy.

## Proposed design

### Independent state and transaction boundaries

- Commercial stage remains on the lead and follows the approved transition graph. Escalation state and delivery state are separate records; neither implicitly advances nor rewrites the other.
- Each command validates actor role, idempotency key, current state, required evidence and active policy constraints before mutation.
- A single database transaction writes the domain transition, disposition/audit evidence and any required outbox event. A rejected command leaves no partial stage, approval or delivery state.
- Database constraints and service-level checks jointly prevent unknown disposition values, invalid transitions and duplicate active transfer identity.

### Dispositions

Add an explicit operator qualification command from `new` or `under_review` to `prequalified`, recording actor, reason and timestamp. It rejects ignored/opted-out leads and non-responding WI-004 decisions unless a linked escalation has been resolved with `transfer_eligibility`; unresolved escalation work blocks later transfer approval.

Support only `No Answer`, `Info Sent`, `Transferido`, `Call Back` and `No le interesa` with the REQ-B02 stage map. `No Answer` requires a usable phone or documented missing-phone recovery task; absent phone creates or updates visible recovery work while preserving the documented disposition mapping. With a usable phone, it creates a fixed, editable follow-up draft that remains pending until human approval and is rechecked with deterministic compliance rules on approval. It does not send substantive content automatically. `Info Sent` requires an approved substantive draft with delivery evidence or a documented operator-recorded external action. `Transferido` records only the disposition after a distinct approved transfer exists and its partner request identifier is known. `Call Back` requires a timezone-aware timestamp later than command time. `No le interesa` requires a reason and only records opt-out when explicit revocation evidence is present.

### Escalation lifecycle and SLA

Extend the existing escalation record with explicit owner/claim evidence and lifecycle timestamps. Authorized operators may claim/resolve assigned work; supervisors may assign/reassign and close with reason. Preserve the reason, priority, redacted summary, suggested role and due time created by WI-004. SLA due times use the recorded rule version and configured business calendar; breach is derived from due time and unresolved state, with audit evidence when surfaced/recorded. Resolution actions are limited to documented outcomes (draft/request information/transfer eligibility/reconciliation link/close) and never themselves approve transfer.

### Transfer, outbox and delivery

- An explicit `ApproveTransfer` command checks role, lead eligibility, current escalation/review evidence and idempotency key. It records approver and approval time, creates one transfer request and its outbox event in the same transaction.
- The transfer command never relies on `Transferido` text or stage to imply permission. The `transferred` stage is applied only when partner acceptance returns a valid request/case ID; pending delivery remains represented independently.
- An outbox worker claims events with bounded concurrency and records each attempt. Retryable errors schedule the next attempt using configurable exponential backoff with a maximum attempt count. Permanent errors or exhausted retries move to `dead_letter`.
- Authorized manual replay appends replay audit evidence and requeues the same logical effect with a controlled replay generation; it cannot create a second transfer or partner case. Already successful effects are not replayed.
- The simulator supports deterministic success, retryable failure and permanent failure responses. n8n invokes documented FastAPI commands and displays branches; it does not write domain tables or implement retry policy.

### API and UI

FastAPI exposes role-protected queries and commands for CRM disposition, escalation queue/detail/claim/assignment/resolution, transfer approval, delivery attempts and manual replay. Responses contain safe summaries and correlation identifiers. Next.js proxies through FastAPI and provides lead disposition actions, owned escalation/SLA views, delivery history and recovery controls. Invalid input returns stable actionable error codes suitable for UI and n8n branching.

## Data and migration

Add an ordered Supabase SQL migration for normalized disposition/audit evidence, transfer approvals/records, outbox events and append-only attempts, with foreign keys, allowed-state checks, uniqueness/idempotency constraints and role-safe RPC/service boundaries as appropriate. Extend existing escalation persistence without changing WI-004's redaction boundary. Update deterministic reset/seeds with synthetic scenarios for each disposition and delivery outcome. Supabase migrations remain the sole schema authority.

## Risks and mitigations

- **Transfer approval confused with outcome:** keep approval, delivery and commercial stage separate; set `transferred` only after partner acceptance.
- **Retry/replay duplicates a partner case:** stable logical idempotency key and simulator deduplication; successful effects cannot be reissued.
- **SLA ambiguity across timezones/business hours:** persist UTC instants and timezone/calendar evidence from the selected rule version.
- **Recovery UI bypasses command validation:** all mutations route through role-checked FastAPI commands; no direct UI/n8n database writes.
- **Manual external-action claims weaken audit:** require actor, timestamp, reason and evidence reference; label them distinctly from simulated delivery.

## Review questions

1. Confirm that `transferred` means partner acceptance (with request/case ID), while an approved but pending request stays in an independent delivery state.
2. Confirm the proposed supervisor/operator permissions for escalation assignment, claim, resolution and closure.
3. Confirm bounded exponential retry as the default policy, with attempt/backoff values configured in WI-005 rather than fixed here.
