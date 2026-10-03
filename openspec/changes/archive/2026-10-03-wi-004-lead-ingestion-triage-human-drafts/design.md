## Context

WI-001–WI-003 established the local stack, roles, deterministic fixtures and immutable rule governance. The system can now authenticate users and publish policy, but the 48 synthetic leads are static records rather than the result of an executable ingestion flow. WI-004 must prove the first end-to-end operational slice while preserving FastAPI as the business boundary and keeping all substantive communication under human control.

The safety order is deterministic: validate and deduplicate, preserve restricted original evidence, redact downstream representations, evaluate decisive rules, optionally request structured AI assistance, validate its schema/confidence/compliance, then produce one decision plus a draft or escalation. AI availability must never determine whether the inbound event is safely preserved.

## Goals / Non-Goals

**Goals:**

- Accept simulated CTWA and organic events through n8n/FastAPI with transactionally idempotent results.
- Keep restricted originals separate while guaranteeing only redacted text reaches ordinary UI, logs and AI.
- Evaluate the active immutable rule version for deterministic triage and record traceable evidence.
- Extract only approved minimal fields and represent unknowns explicitly.
- Make AI optional, provider-neutral, observable and replaceable with deterministic fallback.
- Create human drafts, owned escalations and fixed automatic effects with explicit gates and idempotency.
- Demonstrate execution and failure categories consistently across database evidence, API, UI, n8n and logs.

**Non-Goals:**

- CRM dispositions, commercial-stage execution, partner transfer or message delivery.
- Partner CSV cleaning/reconciliation or aggregate reporting dashboards.
- Real CTWA/WhatsApp, hosted provider requirement or production consumer-data handling.
- AI authority over rules, eligibility, send approval, escalation closure or attribution.

## Decisions

### 1. Use one transactional idempotency boundary in FastAPI/PostgreSQL

FastAPI will validate the event envelope and call a database transaction keyed by channel plus source event ID. The transaction will create or return the source event, lead/message evidence, decision and pending internal effects as one result. Concurrent replays will resolve through a unique constraint and load the committed original result.

**Alternative considered:** n8n-only deduplication was rejected because retries or alternate clients could bypass it and create split domain state.

### 2. Separate restricted original evidence from redacted operational text

Inbound text will be scanned before ordinary application handling. Restricted original content will use the narrowest database representation and server-only access, while redacted text and typed redaction evidence drive classification, logs, UI and AI requests. Logs contain identifiers, categories and hashes, never original or redacted message bodies.

**Alternative considered:** Overwriting the original with redacted text was rejected because it destroys traceable evidence; exposing the original through normal message endpoints was rejected as unnecessary risk.

### 3. Make deterministic rules authoritative and AI advisory

Explicit opt-out, obvious spam, sensitivity, configured handoff/risk triggers, debt policy and state coverage will resolve or constrain the decision before AI. AI may extract approved fields, summarize redacted content and propose a safe draft only when policy permits. A validated AI result cannot override a deterministic escalation or ignore outcome.

**Alternative considered:** One model call deciding the entire path was rejected because it would make safety, policy and fallback nondeterministic.

### 4. Use a strict provider-neutral AI result contract

The adapter input contains redacted text, allowed field schema, active rule references and logical prompt version. Output contains only approved fields, confidence, proposed summary/classification and optional draft. Pydantic validation, confidence thresholds and deterministic compliance checks run after the provider. The OpenAI implementation is one adapter selected by configuration; a deterministic adapter/fallback requires no key.

**Alternative considered:** Passing provider-specific objects through domain services was rejected because it couples decisions, tests and UI evidence to one vendor.

### 5. Store orthogonal AI execution dimensions

Each decision will record `decision_source`, `ai_attempt_status`, `failure_layer` and one normalized reason independently. Append-only AI attempts hold safe provider/model/prompt identifiers, timestamps, latency, status, token/cost metadata when available and validation outcomes. Correlation IDs align API responses, n8n branches, logs and `/operations/ai` filters.

**Alternative considered:** A single success/failure flag was rejected because it cannot distinguish intentional no-AI processing from connectivity faults or rejected model output.

### 6. Keep draft approval separate from delivery

Substantive outputs are stored as drafts with checksums and source rule/model metadata. Operator approval re-runs current deterministic compliance checks and records audit evidence, but WI-004 creates no real delivery. If policy changed or content is blocked, approval fails and creates or updates a supervisor escalation.

**Alternative considered:** Combining approval and delivery was deferred to WI-005 so this work item can prove the human/safety boundary without introducing outbox retry semantics prematurely.

### 7. Represent fixed automatic messages as idempotent simulated effects

Only receipt/privacy, after-hours and opt-out-confirmation templates from the active published rules may create automatic effects. The global flag, consent/opt-out ordering and a unique event/template/version key are checked before creation. The effect is visible and auditable but not delivered externally in WI-004.

**Alternative considered:** Treating these messages as ordinary AI drafts was rejected because they are fixed governed exceptions; real delivery is out of scope.

### 8. Evaluate safety before enabling hosted output

The fixture evaluator will compare actual results with version-controlled expected labels for all 48 leads and injected adapter failures. It will calculate redaction recall, false-safe count, decision agreement, approved-field exact match, schema/compliance acceptance and taxonomy agreement exactly as specified in the proposal. A machine-readable report and human summary will state whether hosted output may be enabled.

**Alternative considered:** Qualitative spot checks were rejected because they cannot support a reviewable model/configuration decision or detect regressions.

## Risks / Trade-offs

- **[Pattern redaction can miss or over-redact]** → Use typed patterns, labeled positive/negative fixtures and a fail-safe escalation whenever a sensitive pattern is detected or ambiguous.
- **[Concurrent duplicates can observe incomplete work]** → Keep acquisition and decision creation in one transaction and resolve uniqueness conflicts after the winning transaction commits.
- **[Provider failures can hide behind final fallback]** → Persist an append-only attempt with exact layer/reason before creating the deterministic fallback outcome.
- **[Strict zero-false-safe gates can disable hosted AI frequently]** → Treat that as an intended safety outcome; do not lower the reviewed threshold within the run.
- **[Existing seed leads overlap with ingestion fixtures]** → Give evaluator events stable source IDs and reset them deterministically rather than creating a second incompatible fixture universe.
- **[UI could leak restricted content through errors]** → Use explicit redacted response models and safe normalized error messages; test response/log bodies for labeled spans.

## Migration Plan

1. Add the transactional schema for source events, restricted/redacted evidence, decisions, extracted fields, drafts, escalations, AI attempts and simulated automatic effects.
2. Implement deterministic redaction, minimal extraction, triage and active-rule evaluation with focused fixture tests.
3. Add the provider-neutral adapter, deterministic fallback and OpenAI candidate behind optional configuration.
4. Add FastAPI ingestion, decision, draft approval and operations queries with role-aware redacted representations.
5. Export and test the n8n workflow plus simulator contract and branch taxonomy.
6. Add Next.js lead/draft review and `/operations/ai` views through authenticated FastAPI proxies.
7. Run the 48-fixture quality evaluation, full migration/reset/integration suite and document evidence.

Rollback before later work items is application/migration reversion followed by a reset of the synthetic local database. No external messages or partner effects exist to unwind.

## Open Questions

None block review. The concrete OpenAI model identifier remains configuration selected only after the recorded quality gate; deterministic local verification does not require provider access.

