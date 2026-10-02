## 1. Ingestion and Persistence Boundary

- [ ] 1.1 Add the Supabase migration for source events, restricted/redacted evidence, decisions, extracted fields, drafts, escalations, AI attempts and simulated automatic effects.
- [ ] 1.2 Implement the documented synthetic CTWA/organic event and response schemas with strict field and fictional-data validation.
- [ ] 1.3 Implement transactional channel/source-event idempotency, including concurrent replay tests and stable original-result retrieval.
- [ ] 1.4 Integrate WI-004 tables and expected outcomes into deterministic reset without duplicating the WI-002 fixture universe.

## 2. Redaction, Rules and Minimal Extraction

- [ ] 2.1 Implement typed sensitive-span detection/redaction before ordinary UI, logs and adapter calls, with positive and negative fixtures.
- [ ] 2.2 Implement active-rule evaluation for opt-out, spam, handoff/risk triggers, debt policy, state coverage and operating hours.
- [ ] 2.3 Implement exactly-one decision persistence with immutable rule-version evidence and linked draft/task outcomes.
- [ ] 2.4 Implement approved minimal field extraction and reject prohibited financial fields from adapter/domain output.
- [ ] 2.5 Add deterministic classification, extraction, escalation and redaction unit/constraint tests across all fixture categories.

## 3. Optional AI and Observable Fallback

- [ ] 3.1 Define the provider-neutral structured-assistance contract, deterministic adapter/fallback and optional OpenAI adapter configuration.
- [ ] 3.2 Implement strict output schema, confidence and deterministic compliance validation before AI evidence can create a draft.
- [ ] 3.3 Persist append-only AI attempts with execution dimensions, exact failure taxonomy, correlation data and safe metadata.
- [ ] 3.4 Add adapter/failure injection tests for missing key, connection/DNS, timeout, authentication, rate limit, provider 5xx, invalid JSON/schema, low confidence and prohibited language.
- [ ] 3.5 Build the 48-fixture evaluator and machine-readable report for every approved redaction, false-safe, agreement, extraction, compliance and taxonomy threshold.

## 4. FastAPI, n8n and Simulator Flow

- [ ] 4.1 Add authenticated FastAPI ingestion/result, redacted lead, draft review/approval, escalation and AI-operations contracts.
- [ ] 4.2 Export the n8n inbound workflow with success, technical-failure, quality-failure and intentional-deterministic branches using shared correlation categories.
- [ ] 4.3 Extend the simulator with synthetic CTWA/organic events and deterministic provider success/failure modes without real delivery.
- [ ] 4.4 Add integration tests from n8n/simulator-shaped request through idempotent decision and resulting draft, escalation or fixed effect.

## 5. Human Review and Operations UI

- [ ] 5.1 Implement the Next.js redacted lead and pending-draft review interface through authenticated FastAPI proxies only.
- [ ] 5.2 Implement approval-time compliance revalidation, checksum/audit evidence and blocked-content escalation without delivery.
- [ ] 5.3 Implement `/operations/ai` filters, badges and correlated safe timeline evidence for all execution/failure categories.
- [ ] 5.4 Add web/API tests proving analyst/redaction boundaries, substantive human gates, exact failure labels and automatic-template restrictions.

## 6. Verification and Closure

- [ ] 6.1 Document the inbound contract, redaction boundary, decision/fallback taxonomy, quality-gate calculations and explicit no-delivery scope.
- [ ] 6.2 Run the full 48-fixture evaluation and record whether the optional adapter configuration passes every reviewed threshold.
- [ ] 6.3 Run formatting, lint, type, unit, integration, migration/reset, database, n8n/export and OpenSpec validation checks and record WI-004 evidence.
- [ ] 6.4 After implementation verification, archive the completed WI-004 OpenSpec change, sync its specifications and validate the resulting main specs before closing the work item.
