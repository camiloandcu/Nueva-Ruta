# Architecture — Nueva Ruta Ops

Status: approved by human (2/10/2026 12:56 p.m. COL)

## Architectural drivers

Priority order approved by the Product Owner:

1. Visible automation.
2. Engineering quality.
3. Visual polish.

Additional drivers are deterministic compliance, human approval, idempotency, dirty-data traceability, local reproducibility, optional external services, 200+ leads/hour as a measured target, 96 implementation hours and USD 20 maximum external spend.

## System context

```text
Creators / organic traffic
           |
           v
  Chat/CTWA simulator
           |
           v
    Nueva Ruta Ops <------ Operator / Supervisor
           |
           +-------------> Influgain analyst
           |
           v
Consejería Clara simulator
           |
           v
 Dirty enrollment CSV
```

## Container view

```text
Browser
  |
  v
Next.js App Router -------- Supabase Auth (SSR)
  |
  v
FastAPI: only business API ---------------- Optional hosted AI
  |                    ^                              |
  v                    |                              |
Supabase local         +------------ n8n ------------+
PostgreSQL/Auth                         |
  ^                                     v
  +---------------------- partner/chat simulators
```

Next.js and n8n never write business-domain tables directly. They use authenticated FastAPI contracts so authorization, idempotency, audit and transaction boundaries remain centralized.

### n8n

Purpose: show operational automation and branching.

Owns:

- webhook entry and orchestration;
- calls to documented FastAPI commands;
- visible success/retry/failure branches;
- partner webhook simulation flow;
- import trigger and safe replay demonstrations.

Does not own:

- business eligibility rules;
- reconciliation algorithms;
- metric definitions;
- source-of-truth state;
- complex JavaScript copies of domain logic.

### FastAPI application

Purpose: own domain behavior and testable contracts.

Suggested modules:

```text
apps/api/
  domain/
    leads/
    rules/
    crm/
    escalations/
    partner/
    reconciliation/
    reporting/
    content/
  application/
    commands/
    queries/
  adapters/
    ai/
    chat/
    partner/
  infrastructure/
    db/
    outbox/
    auth/
    logging/
```

Domain modules should remain cohesive and generally within 200–400 lines per source file; large generated migrations or templates are exceptions.

### Supabase local

Purpose: provide local PostgreSQL, authentication and Studio through a production-relevant development workflow.

Owns:

- authentication identities and sessions;
- domain entities and state transitions;
- immutable audit events;
- published rules and drafts;
- transactional outbox and delivery attempts;
- raw/canonical partner data and reconciliation;
- reportable facts.

Supabase SQL migrations are the only schema authority. Alembic or a second migration history SHALL NOT be introduced. Supabase REST, Realtime and Storage remain outside the critical path until a reviewed work item demonstrates business value.

n8n execution history is diagnostic evidence, not business truth. PostgreSQL remains the durable source of operational truth even though it is run by Supabase locally.

### Next.js application

Purpose: provide a production-like Spanish operator interface using App Router and Supabase Auth with server-side session handling.

Suggested structure:

```text
apps/web/
  app/
    (auth)/
    (operations)/
    api/              # UI-only/backend-for-frontend concerns
  components/
  lib/
    api-client/       # typed FastAPI client
    auth/
  tests/
```

Next.js route handlers may manage UI/session concerns but SHALL NOT reimplement domain rules or mutate domain tables through Supabase clients.

Screens:

- login and role-aware navigation;
- lead inbox/detail and redacted history;
- draft review and approval;
- escalation queue and SLA states;
- dispositions, callbacks and transfer approval;
- rule editor/diff/history;
- imports, data quality and reconciliation review;
- funnel, creator, stalled-work and error reports;
- creator profiles, content sources and scripts;
- protected demo reset.

### Simulators

- Chat/CTWA: sends inbound events and records simulated delivery.
- Partner webhook: configurable success, retryable failure, permanent failure and delayed response.
- Partner CSV: static dirty fixtures plus upload path.

All simulator contracts must match replaceable adapter interfaces.

## Main interface contracts

Exact payloads will be specified in the relevant work item, but these boundaries are stable:

| Contract | Direction | Purpose |
|---|---|---|
| `InboundMessage` | n8n → API | idempotent lead/message receipt |
| `ClassificationResult` | API → n8n/UI | decision, evidence, links |
| `ApproveDraft` | UI → API | authorized substantive send command |
| `ApplyDisposition` | UI → API | validated stage transition |
| `ApproveTransfer` | UI → API | explicit human handoff authorization |
| `PartnerTransferRequest` | n8n → simulator | future real partner boundary |
| `PartnerEnrollmentImport` | UI/n8n → API | immutable row ingestion |
| `PublishRuleVersion` | UI → API | supervisor-controlled policy activation |
| `AIExtractionRequest` | API → provider | redacted structured assistance |

Each mutating command carries actor or service identity, correlation ID and idempotency key where repetition is possible.

## Data and transaction strategy

### Transactional outbox

The FastAPI transaction writes domain facts and pending effects together in Supabase PostgreSQL. A worker claims pending outbox rows using PostgreSQL locking, records attempts and transitions them to delivered, retry-scheduled or dead-letter.

No Redis is included initially. At 200 leads/hour, a second broker would increase deployment and debugging cost without adding evaluator-visible value. The outbox boundary permits replacement if measured load later justifies it.

### Audit model

Audit events record:

- event time in UTC;
- actor/service;
- entity and ID;
- action and reason;
- before/after references or safe diffs;
- correlation and causation IDs;
- rule/template/model version when applicable.

Audit records must not contain unredacted sensitive patterns.

### Time

- Persist timestamps in UTC.
- Render explicit timezone.
- Operating schedule seed: Monday–Friday, 09:00–18:00 `America/New_York`.
- Callback requires timestamp and timezone.

## Security boundary

- Seeded demo identities in Supabase Auth.
- Supabase Auth sessions handled server-side by Next.js.
- FastAPI verifies authenticated identity and enforces business roles for every protected command/query.
- Role authorization lives in FastAPI application services, not only in Next.js routes or components.
- Next.js and n8n cannot bypass FastAPI to mutate business tables.
- Secrets through environment variables; none in repo or n8n exports.
- Analyst access limited to necessary aggregate/attribution data.
- PII redaction before logs and AI.
- Synthetic-only data in local and temporary hosted environments.
- Protected reset and replay actions with confirmation/audit.

This is security appropriate to a controlled synthetic demo, not certification for production consumer financial data.

## AI adapter

```text
Domain input
  → deterministic sensitive-data redaction
  → provider-neutral request
  → hosted provider or deterministic fallback
  → schema validation
  → confidence/completeness check
  → deterministic compliance post-filter
  → draft or escalation
```

The candidate OpenAI model is configuration, not a domain dependency. The initial evaluation may compare `gpt-5.6-luna` with `gpt-6.1-sol` for difficult Spanish drafts, subject to actual account availability. No model is allowed to change rules or execute sends/transfers.

### Developer-visible AI execution state

Every processed decision stores independent execution dimensions:

```text
decision_source:
  deterministic_only | ai_assisted | deterministic_fallback

ai_attempt_status:
  not_requested | skipped_configuration | succeeded | failed

failure_layer:
  none | configuration | transport | provider | output_validation | compliance
```

Normalized reasons distinguish intentional no-AI paths from faults:

- intentional: `deterministic_rule_decisive`, `automatic_template`, `ai_disabled_by_policy`;
- configuration: `missing_api_key`, `budget_guard`;
- transport/provider: `dns_or_connection`, `timeout`, `authentication`, `rate_limit`, `provider_5xx`;
- output/instruction contract: `invalid_json`, `schema_invalid`, `required_field_missing`, `low_confidence`, `prompt_contract_violation`, `prohibited_language`.

The append-only `ai_attempts` record includes correlation ID, lead, provider/model, prompt version, safe provider status, latency, token/cost metadata when available, validation results, fallback route and linked draft/task. It stores no secrets, sensitive text or hidden reasoning.

Next.js displays timeline badges and a filterable operations view: green for AI used, red for provider/transport fallback, amber for rejected output and gray for intentional deterministic processing. n8n exposes separate success, technical-failure, quality-failure and intentional-deterministic branches. JSON logs use the same correlation ID.

## Local deployment

Local startup combines Supabase CLI and Docker Compose behind one documented wrapper command:

- Supabase local: PostgreSQL, Auth and Studio with pinned project configuration.
- `web`: Next.js UI.
- `api`: FastAPI and the initial domain/outbox worker.
- `n8n`: workflow orchestration with imported JSON workflows.
- `simulator`: chat and partner endpoints, combined if this keeps the project small.

Supabase CLI owns its local services. Compose connects the application services to the named local network and published Supabase endpoints without creating a second PostgreSQL instance.

Required health checks:

- Supabase PostgreSQL/Auth readiness;
- Next.js readiness and authenticated-session smoke test;
- application readiness and migration status;
- n8n reachability;
- simulator health.

Startup sequence must support Supabase migrations, seed, workflow import and a smoke test. A reviewer should not manually create n8n nodes or configure Supabase services by hand.

## Temporary deployment

Platform selection is deferred until the architecture package is approved and implementation reaches WI-009. Options will be compared for multi-container support, persistent PostgreSQL, sleep/cold-start behavior, password protection, log access, teardown and total cost.

No external account will be connected without a separate MCP-versus-manual decision.

## Scale strategy

The target 200 leads/hour equals approximately 3.33 per minute. The architecture accepts quickly and processes asynchronous effects. Controls:

- bounded AI concurrency;
- provider timeout;
- retries with backoff;
- backlog visibility;
- idempotent commands;
- indexed operational queries;
- load testing with and without live AI.

Acceptance is based on measured throughput, p50/p95, backlog drain, losses and duplicate effects. The design target is not a performance claim until tests run.

## Alternatives rejected

### FastAPI only

Simpler runtime and testing, but it weakens the visible-automation story central to the evaluation.

### n8n only

Highly visible, but complex rules, reconciliation, testing and state ownership would be fragile and harder to review.

### Next.js plus Supabase without FastAPI

Fewer runtime services, but it would spread business rules and authorization across route handlers, database policies, functions and n8n. This weakens failure recovery, business traceability and Python-based data reconciliation. Next.js and Supabase are therefore adopted without removing FastAPI as the business boundary.

### Redis/Celery from the start

Mature worker tooling, but unnecessary operational complexity for the target rate and demonstration budget.

## Architectural verification

- Unit tests for rules, transitions, redaction, normalization, reconciliation and metrics.
- Integration tests for database constraints, outbox, adapters and role permissions.
- Contract tests for n8n/API/simulator payloads.
- End-to-end tests for the video-critical flows.
- Load test for 200+ events.
- Clean-start and reset tests.
- OpenSpec validation for each future work item change.
