# Decision Log — Nueva Ruta Ops

Status: approved by human (2/10/2026 12:56 p.m. COL)
Decision states: proposed, accepted, superseded. All entries below are accepted from discovery unless marked otherwise.

## ADR-001 — Product identity and business boundary

- Status: accepted.
- Decision: build Nueva Ruta Ops for fictional agency Nueva Ruta, partner Consejería Clara and stakeholder Influgain.
- Consequence: names, roles and simulated contracts remain consistent across fixtures, UI and demo.

## ADR-002 — United States Hispanic audience and DMP only

- Status: accepted.
- Decision: Spanish-first US audience; DMP only.
- Rejected: blending settlement, consolidation, credit repair or loan products.
- Consequence: out-of-category questions escalate and content explicitly distinguishes categories.

## ADR-003 — Automation visibility before visual polish

- Status: accepted.
- Decision: prioritize visible n8n automation, then engineering quality, then UI polish.
- Consequence: n8n remains visible, business logic remains testable, and a deliberately simple Next.js UI adds production realism without displacing failure recovery or traceability.

## ADR-004 — Hybrid n8n, FastAPI, Supabase local and Next.js architecture

- Status: accepted.
- Decision: n8n orchestrates visible workflows; FastAPI owns domain logic; Supabase local provides PostgreSQL/Auth; Next.js App Router provides the Spanish UI.
- Rejected: n8n-only, FastAPI-only UI, and Next.js/Supabase without a dedicated business API.
- Consequence: the product gains a production-like application surface while explicit FastAPI contracts preserve failure recovery, authorization and traceability.

## ADR-005 — No Redis in the initial critical path

- Status: accepted.
- Decision: PostgreSQL transactional outbox and bounded worker concurrency.
- Consequence: fewer services and adequate design for the target rate; revisit only from measurements.

## ADR-006 — Human gate for substantive actions

- Status: accepted.
- Decision: substantive messages and all transfers require a person.
- Consequence: AI output is always a draft; pre-qualification never implies transfer permission.

## ADR-007 — Three automatic transactional messages

- Status: accepted.
- Decision: receipt/privacy warning, after-hours acknowledgement and opt-out confirmation may auto-send as fixed templates.
- Rejected: automatic pre-qualification questions or AI-written acknowledgements.
- Consequence: this is a documented exception to the original literal “never publishes automatically” statement.

## ADR-008 — Minimal marketing data, detailed partner intake

- Status: accepted.
- Decision: Nueva Ruta does not collect SSN, accounts, income, expenses or detailed creditor data.
- Consequence: sensitive text is redacted/escalated; real financial intake remains with a consejero.

## ADR-009 — Editable fictional business thresholds

- Status: accepted.
- Decision: seed USD 5,000–100,000 continuation range, supported unsecured categories and California/Texas/Florida coverage.
- Consequence: labels must state fictional policy; UI permits versioned changes.

## ADR-010 — Rules: YAML seed, database runtime

- Status: accepted.
- Decision: YAML provides reproducibility; database drafts/published versions control runtime.
- Consequence: publication is immutable, supervisor-only and linked to each decision; rollback creates a new version.

## ADR-011 — Source-of-truth ownership by domain

- Status: accepted.
- Decision: Nueva Ruta owns lead origin; partner export owns reported enrollment; reconciliation owns the link.
- Rejected: one table or CSV being universally authoritative.
- Consequence: sources stay immutable and conflicts remain visible.

## ADR-012 — Conservative attribution and commission proxy

- Status: accepted.
- Decision: exact shared ID, then unique normalized phone plus compatible evidence; ambiguity requires review.
- Consequence: no fuzzy automatic phone match; no monetary commission; only conflict-free reconciled enrollment enters the proxy.

## ADR-013 — Organic attribution

- Status: accepted.
- Decision: organic is a natural inbound lead from Google, direct, referral, unpaid creator or unknown source.
- Consequence: creator ID is nullable and never invented.

## ADR-014 — AI is optional and replaceable

- Status: accepted.
- Decision: hosted provider for high-quality structured assistance and drafts, behind an adapter with deterministic fallback.
- Consequence: local startup and lead ingestion do not require an API key; model choice is evaluated, not hardcoded as business logic. Every decision exposes whether AI was used, skipped intentionally or replaced by fallback, with separate configuration, transport, provider, output-validation and compliance causes.

## ADR-015 — Five complete synthetic creator profiles

- Status: accepted.
- Decision: create full profiles across Instagram, TikTok and YouTube Shorts, not only IDs.
- Consequence: profiles connect acquisition, reporting and content planning.

## ADR-016 — Demonstrate autonomy plus limited extra evidence

- Status: accepted.
- Decision: video shows response, escalation, rule change and disposition, plus only failure recovery and reconciliation as additional proof.
- Consequence: video remains under six minutes and avoids feature-tour sprawl.

## ADR-017 — Local demo first, temporary deployment as a plus

- Status: accepted.
- Decision: local startup uses Supabase CLI plus Docker Compose behind one wrapper command; a password-protected temporary deployment is compared later.
- Consequence: hosting cannot block completion and requires separate external-service authorization; local Supabase configuration and migrations remain deployable assets.

## ADR-018 — Measured 200 leads/hour target

- Status: accepted.
- Decision: state 200/hour as a design target until load evidence exists.
- Consequence: scale note reports measured results, conditions and bottlenecks without exaggeration.

## ADR-019 — Durable planning before OpenSpec changes

- Status: accepted after process correction.
- Decision: product brief, requirements, workflows, architecture, data/reporting, compliance/AI, decisions and ordered work items are reviewed as a set before any new OpenSpec change.
- Consequence: session continuity does not depend on chat history.

## ADR-020 — One work item per OpenSpec change

- Status: accepted after process correction.
- Decision: after the planning set is approved and development is explicitly started, propose exactly one work item as one OpenSpec change and pause.
- Consequence: no umbrella project change; each proposal and implementation has its own approval gate.

## ADR-021 — Treatment of the premature monolithic change

- Status: accepted and executed with explicit Product Owner authorization.
- Decision: delete the unimplemented `build-nueva-ruta-ops` change after extracting its useful decisions into the durable planning package.
- Rejected: archive it as implemented or retain it as an active umbrella proposal.
- Consequence: no monolithic OpenSpec proposal can be mistaken for approved implementation scope; the approved planning documents preserve the needed knowledge.

## ADR-022 — Git state

- Status: accepted.
- Decision: remove the invalid empty Git metadata, initialize the local repository on `main`, and configure `https://github.com/camiloandcu/Nueva-Ruta` as `origin` without contacting or pushing to GitHub.
- Consequence: the approved planning package can be committed locally; future GitHub access still requires the established external-service authorization path.

## ADR-023 — FastAPI is the exclusive business boundary

- Status: accepted.
- Decision: all business-domain reads and writes from Next.js and n8n go through authenticated FastAPI contracts.
- Rejected: direct Next.js or n8n writes to Supabase domain tables.
- Consequence: business authorization, idempotency, audit, rules and transaction boundaries remain centralized and testable.

## ADR-024 — Supabase migrations are the schema authority

- Status: accepted.
- Decision: use Supabase CLI SQL migrations as the only schema history; do not introduce Alembic in parallel.
- Consequence: local and potential hosted Supabase environments share one migration path and avoid schema drift.

## ADR-025 — Temporary hosted demo ceiling and expiry

- Status: accepted by Product Owner (2026-10-04).
- Decision: use Railway + Supabase Cloud for the WI-009 synthetic demo only, capped at USD 7 total, with service shutdown/project pause no later than 2026-10-09 23:59 America/Bogota.
- Constraints: cost must be verifiable before provisioning; only web is public; authenticated demo accounts and synthetic data only; API, n8n, simulator and database stay private; no live AI; stop Railway compute and pause Supabase at expiry without deleting evidence.
- Consequence: if the account plan, project price, or forecast cannot be bounded within the cap, do not provision. Local Supabase + Compose remains the source of truth.
