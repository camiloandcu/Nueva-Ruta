## ADDED Requirements

### Requirement: Optional provider-neutral AI assistance
The system SHALL expose a provider-neutral structured-assistance interface with an optional OpenAI adapter and SHALL complete safe ingestion and deterministic processing without an AI key.

#### Scenario: AI is intentionally unavailable
- **WHEN** no AI key is configured or policy disables AI
- **THEN** ingestion completes with deterministic processing and records `skipped_configuration` plus the exact normalized reason

#### Scenario: Valid provider result is accepted
- **WHEN** the configured adapter returns schema-valid, sufficiently confident and compliance-valid output
- **THEN** approved fields and a proposed draft may be recorded as AI-assisted evidence without granting action authority

### Requirement: Exact fallback taxonomy
Every decision SHALL independently record decision source, AI attempt status, failure layer and one normalized reason using the approved configuration, transport, provider, output-validation and compliance taxonomy.

#### Scenario: Provider timeout occurs
- **WHEN** the adapter exceeds its configured timeout
- **THEN** ingestion remains committed, the attempt records `transport` and `timeout`, and uncertain work produces deterministic fallback plus human ownership

#### Scenario: Provider output is rejected
- **WHEN** an adapter response has invalid JSON/schema, required fields missing, low confidence, contract violation or prohibited language
- **THEN** the attempt records the exact output-validation or compliance reason and the rejected content cannot create an approved draft

### Requirement: Safe correlated observability
The system SHALL persist append-only safe AI-attempt evidence and expose matching categories/correlation IDs in structured logs, n8n branches and a filterable Next.js `/operations/ai` view without secrets, sensitive text or hidden reasoning.

#### Scenario: Developer investigates an outcome
- **WHEN** a developer filters the operations view by correlation ID or execution category
- **THEN** database evidence, UI badge, n8n branch and structured log identify whether processing was intentional deterministic, AI success, technical fallback or rejected output

### Requirement: Reviewable fixture quality gate
The evaluator SHALL run all 48 fixtures plus injected failure cases and SHALL prevent hosted AI output from being enabled unless every threshold specified in the approved proposal passes in one recorded run.

#### Scenario: Evaluation passes every gate
- **WHEN** redaction, false-safe, agreement, extraction, schema/compliance and failure-taxonomy thresholds all pass
- **THEN** the report marks the evaluated adapter/model/configuration eligible for supervised demo use and records latency/cost context when available

#### Scenario: Any safety or quality gate fails
- **WHEN** one or more reviewed thresholds fail
- **THEN** hosted output remains disabled, deterministic fallback remains active and the report identifies failed metrics without changing thresholds

