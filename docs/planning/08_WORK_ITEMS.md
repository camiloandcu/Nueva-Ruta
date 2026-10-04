# Ordered Work Items — Nueva Ruta Ops

Status: approved by human (2/10/2026 12:56 p.m. COL)
Schema: project work-item map, not an OpenSpec change
Total budget: 96 hours

## Delivery protocol

1. The Product Owner reviews and explicitly approves the complete planning package.
2. The Product Owner explicitly says to start development.
3. The agent prepares an OpenSpec proposal for only the next work item.
4. The agent stops for review; it does not mark the proposal accepted.
5. After explicit approval, the work item is implemented on a short-lived local branch, verified and reported.
6. The agent stops again before proposing the next item.
7. Material discoveries update the durable planning documents and are reviewed before changing downstream scope.

WI-007 implementation is approved and complete locally; its pull request is pending. No other work item is active.

## Sequence overview

| Order | ID | Work item | Estimate | Depends on |
|---:|---|---|---:|---|
| 1 | WI-001 | Repository and runtime foundation | 10 h | planning approval |
| 2 | WI-002 | Domain schema, roles and synthetic baseline | 10 h | WI-001 |
| 3 | WI-003 | Rule governance and compliance policy | 10 h | WI-002 |
| 4 | WI-004 | Lead ingestion, triage and human drafts | 15 h | WI-003 |
| 5 | WI-005 | CRM dispositions, escalation and partner handoff | 14 h | WI-004 |
| 6 | WI-006 | Partner import, cleaning and reconciliation | 12 h | WI-002, WI-005 |
| 7 | WI-007 | Funnel, stalled-work and attribution reporting | 9 h | WI-005, WI-006 |
| 8 | WI-008 | Creator profiles and content planning | 6 h | WI-002, WI-003, WI-007 |
| 9 | WI-009 | Reliability, scale, documentation and demo release | 10 h | WI-001–WI-008 |
|  |  | **Total** | **96 h** |  |

## WI-001 — Repository and runtime foundation

- Status: proposed.
- Business value: gives every later change a reproducible, observable environment and avoids demo-day setup risk.
- Goal: establish a valid local repository and healthy empty application stack without implementing product workflows.

### In scope

- Create agreed repository structure and baseline ignores.
- Add pinned Python and Node.js project tooling.
- Initialize Supabase local configuration, PostgreSQL/Auth and the authoritative SQL migration path.
- Add a minimal Next.js App Router shell with Supabase Auth SSR integration.
- Add Compose services for FastAPI, n8n and simulators connected to the Supabase local network/endpoints.
- Add one wrapper command for Supabase CLI plus Compose startup.
- Add environment examples, health checks, migration command and empty-database/auth smoke test.
- Document prerequisites and initial startup.

### Out of scope

- Domain tables beyond migration infrastructure.
- Business roles, rules, lead behavior or fixtures beyond the minimum auth connection smoke test.
- External accounts or hosted deployment.

### Acceptance criteria

- A clean supported environment can start all containers from documented commands.
- Supabase PostgreSQL/Auth, Next.js, FastAPI, n8n and simulator health checks pass.
- Next.js reaches FastAPI and establishes a seeded/smoke-test Supabase session without direct domain-table access.
- Supabase migrations are the sole schema authority; no Alembic history exists.
- No secrets are committed.
- Dependency, format, lint, type and test commands exist and pass on the baseline.
- A small local commit history references WI-001; nothing is pushed or merged.

### Verification

- Clean Compose build/start/stop.
- Health endpoint checks.
- Supabase migration reset/verification.
- Next.js/FastAPI/Auth boundary smoke test.
- Static checks and test runner.

### Future `opsx:propose` input

“Implement WI-001 from `docs/planning/08_WORK_ITEMS.md`: establish the Supabase local, Next.js, FastAPI, n8n and simulator runtime foundation only. Preserve FastAPI as the exclusive business boundary and exclude domain features.”

## WI-002 — Domain schema, roles and synthetic baseline

- Status: proposed.
- Business value: creates a stable source of truth and repeatable demo state for all business flows.
- Goal: implement core persistence, seeded roles, synthetic creators/leads/enrollments/content sources and protected reset.

### In scope

- Core database tables and constraints for users, creators, leads, messages, consent, audit and import provenance needed by fixtures.
- Supabase Auth identities and server-side Next.js sessions for operator, supervisor and analyst.
- FastAPI identity verification and application-role authorization.
- Five complete fictional creator profiles.
- 48 lead fixtures, 30 dirty partner rows and ten content sources matching coverage matrices.
- Deterministic seed and supervisor-confirmed reset.
- Synthetic-data labels and reserved phone documentation.

### Out of scope

- Classification behavior, rule publication, reconciliation logic or dashboards.
- Hosted Supabase, third-party identity providers or enterprise SSO.

### Acceptance criteria

- Fixture counts and expected defect categories are automated tests.
- Seed/reset produces identical business identifiers and expected timestamps/relative-age behavior.
- Analyst cannot access restricted unredacted message details.
- Reset requires supervisor, confirmation and audit event.
- No fixture resembles or references a real consumer intentionally.

### Verification

- Migration/constraint tests.
- Authentication/authorization tests.
- Seed integrity and reset-repeatability tests.
- Fixture coverage report.

### Future `opsx:propose` input

“Implement WI-002 using REQ-A02, REQ-D01, REQ-D02, REQ-E02, REQ-E06 and REQ-E08. Do not add decision or reporting behavior.”

## WI-003 — Rule governance and compliance policy

- Status: proposed.
- Business value: moves business judgment out of source code and provides auditability for policy changes.
- Goal: implement YAML seeds, database drafts, validation, diff, immutable supervisor publication and deterministic compliance controls.

### In scope

- Rule schema for classification triggers, debt ranges/types, state coverage, SLA, retries, stage transitions, automatic templates and feature flags.
- Approved fictional defaults: USD 5,000–100,000, CA/TX/FL, approved debt types and operating hours.
- YAML import/export.
- Draft validation and human-readable diff.
- Supervisor-only immutable publication.
- Rollback by publishing a new derived version.
- Deterministic checks for `consejero`, conditional savings, prohibited figures/promises and automatic-template restrictions.

### Out of scope

- Processing real inbound leads.
- AI provider integration.
- Message or partner delivery.

### Acceptance criteria

- Valid YAML becomes a draft without rebuild.
- Conflicting ranges or unsafe automatic templates cannot publish.
- Operator cannot publish.
- Published versions are immutable and decisions can reference them later.
- Export/import round trip preserves normalized content.
- Rollback does not rewrite history.

### Verification

- Schema and policy unit tests.
- Permission tests.
- Immutable version and hash tests.
- UI/API diff and publication integration test.

### Future `opsx:propose` input

“Implement WI-003 from ADR-009, ADR-010 and compliance requirements. Deliver rule governance only; no lead workflow yet.”

## WI-004 — Lead ingestion, triage and human drafts

- Status: proposed.
- Business value: delivers the first end-to-end product slice from inbound lead to a safe human action.
- Goal: ingest idempotently, redact, classify, minimally pre-qualify and create human-reviewable drafts or escalations.

### In scope

- Simulated CTWA/organic contract and n8n ingestion workflow.
- Idempotent source event handling.
- Consent/context and source attribution.
- Sensitive-data detection/redaction.
- Deterministic classification rules.
- Provider-neutral AI interface, OpenAI candidate adapter and no-key fallback.
- Structured extraction of approved fields.
- Draft queue and compliance revalidation at approval.
- Three fixed automatic messages with feature flag and idempotency.
- Escalation creation for risk, ambiguity, unsupported coverage and low confidence.
- AI fixture evaluation with a reviewable quality threshold defined in its proposal.

### Out of scope

- CRM dispositions and partner transfers.
- Partner CSV reconciliation and reporting dashboards.
- Real channel delivery.

### Acceptance criteria

- Every accepted fixture gets one decision and rule version.
- Replayed event produces no duplicate effect.
- Substantive output remains a draft.
- Sensitive spans never reach ordinary logs/UI/AI.
- Automatic messages are limited to the allowlist and can be disabled.
- Provider timeout preserves ingestion and produces deterministic fallback/human work.
- Every decision exposes decision source, AI attempt status, failure layer and normalized reason.
- Developers can distinguish intentional deterministic processing, provider/connectivity failure and rejected model output in the Next.js operations view, n8n branches and structured logs.
- Terminology and prohibited-claim tests pass across all fixtures.

### Verification

- Unit tests for redaction, classification and pre-qualification.
- AI contract and fallback tests.
- Exact fallback taxonomy tests for configuration, transport, provider, output validation and compliance failures.
- Next.js `/operations/ai` filter/badge tests and correlated n8n/log evidence.
- Integration test from n8n webhook through draft/task.
- Fixture-based evaluation report.

### Future `opsx:propose` input

“Implement WI-004 using REQ-A01–A09 and REQ-E03–E04. Define and expose the AI quality gate for review within this change; do not implement CRM dispositions.”

## WI-005 — CRM dispositions, escalation and partner handoff

- Status: proposed.
- Business value: turns reviewed leads into controlled operational outcomes and demonstrates recovery without the Product Owner.
- Goal: implement full escalation lifecycle, five dispositions, commercial stages, outbox/retry/DLQ and human-approved simulated transfer.

### In scope

- Escalation assignment, claim, SLA, resolution and closure.
- Independent commercial, operational and delivery state models.
- Five disposition commands and validation.
- Draft generation where required.
- Transactional outbox, delivery attempts, retry backoff and DLQ.
- n8n disposition and transfer workflows.
- Simulated Consejería Clara webhook with success/retry/permanent-failure modes.
- Manual replay and failure UI.

### Out of scope

- CSV import/reconciliation.
- Aggregate reporting beyond operational views required to execute/recover work.
- Real partner connectivity.

### Acceptance criteria

- Every disposition maps exactly as documented and audits before/after state.
- Callback without a future timestamp fails without mutation.
- Transfer cannot occur without explicit authorized approval.
- Repeated transfer command cannot create a second partner case.
- Retryable failure retries; exhausted failure reaches DLQ and can be replayed.
- Missing phone and invalid disposition produce visible recovery work.

### Verification

- State-transition tests.
- Outbox/idempotency integration tests.
- n8n/API/simulator contract tests.
- End-to-end success, retry and dead-letter paths.

### Future `opsx:propose` input

“Implement WI-005 from REQ-A10 and REQ-B01–B05, preserving the human transfer gate and independent state models.”

## WI-006 — Partner import, cleaning and reconciliation

- Status: implemented and verified (2026-10-03).
- Business value: prevents dirty partner data from silently corrupting creator attribution and commission decisions.
- Goal: import immutable raw rows, normalize reproducibly and reconcile conservatively with human review.

### In scope

- CSV upload/import job and n8n trigger.
- File/row metadata, checksums and raw immutability.
- Phone/date/creator normalization and quality issues.
- Duplicate grouping without deletion.
- Match by shared ID, then unique exact normalized phone plus compatible evidence.
- Ambiguous/conflict/unmatched review cases.
- Analyst accept/reject/link with evidence and reason.
- Non-monetary commission proxy logic.

### Out of scope

- Full dashboard visualization beyond import/reconciliation screens.
- Fuzzy automatic phone matching.
- Monetary commission calculation.

### Acceptance criteria

- All deliberate dirty fixture cases produce documented expected results.
- Raw values never change.
- Contradictory creator ID cannot auto-match as commission-safe.
- Ambiguous candidates require a person.
- Review decision retains automatic evidence and both raw sources.
- Every canonical/reconciled record is traceable to source rows.

### Verification

- Golden reconciliation fixtures.
- Import idempotency and provenance tests.
- Data-quality issue assertions.
- Analyst permission and audit tests.

### Future `opsx:propose` input

“Implement WI-006 from REQ-C01–C04 and C07–C08. No aggregate dashboard expansion beyond the review workflow.”

## WI-007 — Funnel, stalled-work and attribution reporting

- Status: implemented and verified locally; pull request pending.
- Business value: gives Nueva Ruta and Influgain a shared view of operational health, creator quality and commission risk.
- Goal: implement governed metric queries and Spanish dashboards using the approved definitions.
- UI delivery: implement the dashboards in Next.js while FastAPI remains the only source of business queries.

### In scope

- Received-to-reconciled funnel.
- Creator/channel/state/time filters.
- Time to first action and decision distribution.
- Draft and escalation backlog/SLA.
- Stalled lead view with threshold, age, owner and action.
- Webhook/retry/DLQ metrics.
- Data-quality and reconciliation categories.
- Potentially commissionable count with blockers.
- Drill-through to evidence and raw provenance.

### Out of scope

- BI vendor integration.
- Causal claims about creator performance.
- Monetary commission output.

### Acceptance criteria

- Fixed fixture counts match expected metric tests.
- Denominators are visible.
- Organic leads remain unattributed unless evidence exists.
- Enrollment totals include unmatched/conflicted categories while commission proxy excludes them.
- Seeded stale cases appear with correct thresholds and rule versions.
- Analyst access remains limited to needed detail.

### Verification

- Metric query unit/integration tests.
- Aggregate reconciliation tests.
- Filter/empty-state/UI tests.
- Traceability walkthrough from dashboard to raw row.

### Future `opsx:propose` input

“Implement WI-007 from REQ-C05–C07 and the metric definitions in `docs/planning/05_DATA_AND_REPORTING.md`, using Next.js only as the UI and FastAPI for all business queries.”

## WI-008 — Creator profiles and content planning

- Status: proposed.
- Business value: closes the loop between lead evidence, creator strategy and compliant content production.
- Goal: expose complete creator profiles, rank sources transparently and deliver three traceable scripts.

### In scope

- Creator profile screens linked to funnel evidence.
- Next.js profile and content screens backed only by FastAPI contracts.
- Ten fictional source records with explicit provenance.
- Explainable ranking using frequency, funnel proximity, freshness and risk.
- Three Spanish 30–45 second vertical-video scripts.
- Script versions, source links, creator fit and human-review status.
- Compliance validation for every script.

### Out of scope

- Scraping real trends.
- Real testimonials.
- Social scheduling or publishing.

### Acceptance criteria

- Five profiles contain every approved field.
- Ranking displays factor contributions.
- Three scripts link to valid sources and are prioritized.
- Savings language is conditional; no invented figures or guarantees occur.
- Fictional trends and stories are visibly identified.

### Verification

- Profile/source completeness tests.
- Ranking determinism tests.
- Script traceability and compliance tests.
- Manual duration/read-through check.

### Future `opsx:propose` input

“Implement WI-008 from REQ-D01–D04 using the approved synthetic creator personas and source provenance rules.”

## WI-009 — Reliability, scale, documentation and demo release

- Status: proposed.
- Business value: converts working features into credible, repeatable evaluation evidence.
- Goal: harden observability, execute scale and clean-start evidence, complete product documentation and prepare the final demo/deployment decision.

### In scope

- Structured redacted logs, correlation IDs and readiness checks.
- Complete regression/e2e suite for prior work items.
- Load test of at least 200 events with documented stub/live conditions.
- Product-facing README and verified sub-fifteen-minute quickstart.
- Final architecture, decisions, compliance, cleaning, AI-use and scale documentation.
- Exported/importable n8n workflows.
- Six-minute video script and recording checklist.
- Temporary hosting comparison and separate authorization gate.
- Final local demo reset rehearsal.

### Out of scope

- Unapproved cloud account use.
- Production SLA or security certification.
- Feature expansion not required by existing acceptance criteria.

### Acceptance criteria

- Clean startup succeeds from documented prerequisites within fifteen minutes.
- The single documented wrapper starts Supabase local and Compose services without manual dashboard configuration.
- Full test/static/migration/OpenSpec validation passes.
- Load report contains throughput, p50/p95, backlog, losses and duplicates without unsupported claims.
- Video path fits six minutes and demonstrates the agreed flows.
- Required deliverables are present and internally linked.
- If hosting is declined, local delivery is still complete.
- If hosting is approved, it uses synthetic data, password protection, external secrets and a shutdown date.

### Verification

- Clean-environment rehearsal.
- Full automated checks.
- Load and reset runs.
- Documentation link/checklist review.
- Timed video dry run.

### Future `opsx:propose` input

“Implement WI-009 as release hardening only. Do not add product features beyond closing documented acceptance gaps.”

## Change-control rules

- A work item's OpenSpec proposal may refine implementation details but may not silently contradict accepted ADRs or requirements.
- New scope must identify its effect on budget, sequence and downstream work items.
- A newly discovered production/legal requirement is documented as an unknown or future change unless the Product Owner explicitly adds it to the demo.
- Work-item completion updates this file's status and evidence links but does not auto-approve the next item.
- The agent must stop at every proposal and completion boundary.
