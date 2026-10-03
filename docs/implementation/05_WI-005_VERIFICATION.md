# WI-005 Verification

## Delivered

- Added operator-controlled CRM qualification and the exact five approved lead dispositions, with append-only audit events.
- Added escalation assignment, claim, resolve, and close actions; editable compliance-reviewed follow-up drafts; and missing-phone recovery.
- Added supervisor-approved partner handoff through a durable outbox with idempotency, retry policy, attempt history, dead-letter visibility, and explicit replay.
- Added deterministic partner-transfer simulator modes plus authenticated n8n workflows for CRM dispositions and partner dispatch/replay. Both call FastAPI only. The web UI and API proxy use authenticated operations endpoints.
- Extended the deterministic reset to restore 48 lead records plus one synthetic escalation SLA case, a prequalified missing-phone recovery case, and additional disposition-ready stages. Reset clears transactional CRM/delivery state inside its supervisor-authorized transaction but preserves general audit history and never pre-approves a transfer.
- Added UI contract tests for the five dispositions, callback handling, transfer gating, missing-phone display, dead-letter replay and safe error feedback. Added n8n workflow contract tests.
- Wired `AI_PROVIDER`, `OPENAI_API_KEY`, and `OPENAI_MODEL` from the local Compose environment into the API, and extended the HTTP timeout for real model calls. GPT-6 Luna requests use `reasoning.effort=none`.

## Verification

- Manual OpenAI smoke test: one fixed, harmless Responses API prompt returned HTTP 200 from `gpt-6-luna`, with the expected marker response. Usage was 14 input + 9 output tokens (23 total). The API key and response ID were not recorded here.
- Python: Ruff passed; mypy passed for 22 source files; pytest passed (57 tests).
- Web: ESLint and TypeScript checks passed; Node tests passed (8 tests).
- Database: local schema lint passed; Supabase pgTAP passed (5 files, 121 tests).
- OpenSpec strict validation passed.

## Scope and operational notes

The manual OpenAI request confirms the configured key and model can access the Responses API. It does not submit lead data and does not exercise a full application ingestion request. The app-level provider behavior is covered by automated tests. The Compose environment wiring was inspected without printing the secret.

The local Supabase database was updated additively to apply and test the migrations; it was not reset. Database reset coverage runs twice inside a rolled-back pgTAP transaction, including after creating an approved synthetic transfer, retry attempt and disposition. General audit events remain intact while the supervisor-authorized reset clears synthetic operational records.

The full-repository Ruff check also exposed formatting-only violations in the existing WI-004 evaluator and ingestion tests on `main`. Those two files were reformatted without changing behavior, and the root Ruff check now passes.

The WI-005 proposal explicitly includes operator qualification from `new` / `under_review` into `prequalified` and editable No Answer drafts. Reset fixtures and callback paths are tested transactionally; the mode selector and simulator contract exercise delivery outcomes without pre-approving synthetic partner transfers.
