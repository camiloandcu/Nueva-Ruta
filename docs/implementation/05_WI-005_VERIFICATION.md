# WI-005 Verification

## Delivered

- Added operator-controlled CRM qualification and the exact five approved lead dispositions, with append-only audit events.
- Added escalation assignment, claim, resolve, and close actions; editable compliance-reviewed follow-up drafts; and missing-phone recovery.
- Added supervisor-approved partner handoff through a durable outbox with idempotency, retry policy, attempt history, dead-letter visibility, and explicit replay.
- Added a deterministic partner-transfer simulator and an n8n workflow example. The web UI and API proxy use authenticated operations endpoints.
- Wired `AI_PROVIDER`, `OPENAI_API_KEY`, and `OPENAI_MODEL` from the local Compose environment into the API, and extended the HTTP timeout for real model calls. GPT-6 Luna requests use `reasoning.effort=none`.

## Verification

- Manual OpenAI smoke test: one fixed, harmless Responses API prompt returned HTTP 200 from `gpt-6-luna`, with the expected marker response. Usage was 14 input + 9 output tokens (23 total). The API key and response ID were not recorded here.
- Python: Ruff passed; mypy passed for 22 source files; pytest passed (52 tests).
- Web: ESLint and TypeScript checks passed; Node tests passed (7 tests).
- Database: local schema lint passed; Supabase pgTAP passed (4 files, 87 tests).
- OpenSpec strict validation passed.

## Scope and operational notes

The manual OpenAI request confirms the configured key and model can access the Responses API. It does not submit lead data and does not exercise a full application ingestion request. The app-level provider behavior is covered by automated tests. The Compose environment wiring was inspected without printing the secret.

The local Supabase database was updated additively to apply and test the migrations; it was not reset. An existing WI-004 ingestion test was corrected to create linked fixture rows before asserting append-only behavior.

The WI-005 proposal now explicitly includes operator qualification from `new` / `under_review` into `prequalified` and editable No Answer drafts. These close reachable lifecycle gaps discovered during implementation and are covered by database/API tests.
