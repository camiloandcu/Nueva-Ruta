## ADDED Requirements

### Requirement: Documented simulated inbound contract
The system SHALL accept documented synthetic CTWA and organic events containing source event ID, inbound timestamp, channel, source detail, optional creator, message, fictional phone, consent context and conversation-window evidence through FastAPI, with n8n acting only as an orchestrating client.

#### Scenario: Valid event is accepted
- **WHEN** n8n submits a valid synthetic inbound event
- **THEN** FastAPI returns the stable lead, message and processing result identifiers with a correlation ID

#### Scenario: Invalid event fails safely
- **WHEN** an event omits a required field or violates the synthetic phone/channel contract
- **THEN** FastAPI rejects it without creating partial domain records or logging message content

### Requirement: Transactional idempotent ingestion
The system SHALL process each channel/source-event pair exactly once and SHALL return the original committed result for sequential or concurrent replay without duplicating leads, messages, decisions, drafts, escalations or automatic effects.

#### Scenario: Event is replayed
- **WHEN** the same source event is submitted more than once
- **THEN** every successful response references the same result and database counts remain unchanged after the first commit

### Requirement: Sensitive-data redaction boundary
The system SHALL detect likely SSNs, full account/card numbers and credential language before ordinary UI, logs or AI calls, SHALL replace detected spans with typed markers and SHALL create a high-priority supervisor escalation.

#### Scenario: Sensitive fixture is ingested
- **WHEN** a message contains a labeled sensitive span
- **THEN** restricted evidence preserves the minimum original record while all ordinary responses, logs, summaries and AI inputs contain only typed redaction markers

#### Scenario: Non-sensitive number is ingested
- **WHEN** a message contains an allowed fictional phone or approved approximate debt amount but no sensitive pattern
- **THEN** the redactor preserves the allowed value and does not create a false sensitive-data escalation

### Requirement: Deterministic rule-bound classification
Every actionable message SHALL receive exactly one `respond`, `ignore` or `escalate_human` decision linked to the active immutable rule version, reason code, safe explanation, evidence and any resulting draft or escalation.

#### Scenario: Explicit opt-out is decisive
- **WHEN** redacted content matches an active explicit opt-out rule
- **THEN** the system records `ignore`, suppresses ordinary messaging and may create only the governed opt-out confirmation effect

#### Scenario: Unsupported or risky request escalates
- **WHEN** active debt/state/risk/handoff rules identify unsupported coverage, high-risk language or ambiguity
- **THEN** the system records `escalate_human` and creates an owned task with priority, due time, redacted summary and suggested role

#### Scenario: Safe incomplete request responds with draft
- **WHEN** deterministic rules allow response but approved pre-qualification fields are missing
- **THEN** the system records `respond` and creates a safe question draft rather than inferring missing facts

### Requirement: Minimal approved extraction
The system SHALL extract or request only approximate debt amount/range, general debt type, state, preferred language, preferred contact time and desire to speak with a `consejero`; prohibited detailed financial fields SHALL NOT be requested or persisted as extracted values.

#### Scenario: Approved fields are present
- **WHEN** a redacted message states approved pre-qualification facts
- **THEN** the result contains normalized approved values with source/confidence evidence

#### Scenario: Prohibited field is proposed
- **WHEN** an adapter output includes SSN, account details, credentials, detailed creditors, income, expenses, rates, fees or credit score
- **THEN** output validation rejects it, records an output-contract failure and routes the work to a person

