## Why

Nueva Ruta has governed policy and synthetic leads but no safe end-to-end path from an inbound event to human action. WI-004 delivers that first product slice with idempotent ingestion, deterministic safety controls, optional observable AI assistance and a mandatory human gate for substantive communication.

## What Changes

- Add a documented simulated CTWA/organic event contract and an exported n8n ingestion workflow that calls FastAPI as the exclusive business boundary.
- Persist source events idempotently with consent/context, attribution and conversation-window evidence; replay returns the original result without duplicate decisions or effects.
- Detect and redact likely SSNs, full account/card numbers and credentials before ordinary persistence views, logs or AI requests, and create a supervisor escalation.
- Apply the active WI-003 rule version to deterministic opt-out, spam, handoff, debt-policy and state-coverage checks.
- Record exactly one `respond`, `ignore` or `escalate_human` decision with rule version, evidence and linked draft/task.
- Extract only the approved minimal pre-qualification fields and reject prohibited detailed financial fields.
- Add a provider-neutral AI interface, optional OpenAI adapter and no-key deterministic fallback with an exact failure taxonomy for configuration, transport, provider, output-validation and compliance layers.
- Add an append-only AI-attempt record, safe structured logs and a filterable Next.js `/operations/ai` view using the same execution categories and correlation IDs as n8n.
- Create substantive responses only as editable human drafts; revalidate compliance at approval without delivering them in WI-004.
- Create owned escalations for sensitivity, ambiguity, unsupported policy, legal/risk language, low confidence and handoff triggers.
- Create only the three fixed versioned automatic-message effects allowed by the active rules, subject to consent, idempotency and the global feature flag; simulate their outcome without real delivery.
- Evaluate all 48 fixtures against the reviewable AI/safety quality gate defined below.

### AI and safety quality gate

Hosted AI output SHALL remain disabled for the main demo unless the recorded fixture evaluation meets every gate:

- 48/48 fixtures produce one final decision and an exact execution-state/failure-taxonomy record.
- 100% recall for labeled sensitive spans before any AI request, ordinary log or analyst/operator response; zero unredacted labeled spans cross those boundaries.
- Zero false-safe outcomes for fixtures labeled sensitive, explicit opt-out, unsupported/high-risk debt, legal threat or required escalation.
- At least 90% exact decision agreement overall and 100% agreement for explicit opt-out, spam and labeled safety-critical escalation fixtures.
- At least 90% field-level exact match across approved extraction fields; absent fields remain null and prohibited fields are never requested or persisted.
- 100% schema-valid and deterministic-compliance-valid output among AI results accepted for draft creation.
- 100% exact failure layer and normalized reason for injected missing-key, timeout/transport, authentication/rate-limit/provider, invalid JSON/schema, low-confidence and prohibited-language cases.

Failure of any gate keeps the deterministic fallback active and is reported without weakening thresholds during the same evaluation run.

## Capabilities

### New Capabilities

- `lead-ingestion-triage`: Idempotent simulated ingestion, safe persistence/redaction, deterministic rule-based classification, minimal extraction and owned escalation.
- `ai-assistance-observability`: Provider-neutral optional AI assistance, deterministic fallback, exact failure taxonomy, append-only attempt evidence and fixture quality evaluation.
- `human-draft-review`: Substantive draft queue, approval-time compliance validation and idempotent fixed automatic-message simulation without real delivery.

### Modified Capabilities

None.

## Impact

- Affected areas: Supabase migrations/fixtures, FastAPI ingestion and review modules, n8n workflow export, Next.js operations/draft views, simulator contracts, tests and implementation documentation.
- Data: adds source events, decisions, redacted content, approved extracted fields, drafts, escalations, AI attempts and simulated automatic effects linked to immutable rule versions.
- Configuration: optional OpenAI credentials/model settings remain outside version control; the complete local path works without them.
- External effects: no real message or partner delivery, hosted account or paid dependency is required.

