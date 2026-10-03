# partner-delivery Specification

## Purpose
TBD - created by archiving change 2026-10-02-wi-005-crm-dispositions-escalation-partner-handoff. Update Purpose after archive.
## Requirements
### Requirement: Human-approved transfer creates one outbox request
Only an authorized operator's explicit approval command SHALL create a transfer record and transactional outbox event. Approval, transfer delivery state and commercial lead stage SHALL remain independently represented.

#### Scenario: Transfer is approved
- **WHEN** an authorized operator approves an eligible lead with a valid idempotency key
- **THEN** one approval record, transfer record and pending outbox event commit together with correlation evidence

#### Scenario: Transfer approval is repeated
- **WHEN** the same approval command is replayed with its idempotency key
- **THEN** the API returns the original transfer and creates no additional partner request

#### Scenario: Unauthorized actor attempts approval
- **WHEN** a role without transfer authority invokes the approval command
- **THEN** the API rejects the command and creates no transfer or outbox event

### Requirement: Delivery attempts are idempotent and auditable
The delivery worker SHALL record append-only attempts and SHALL NOT repeat an effect after success. Retryable errors SHALL use configured bounded backoff; permanent errors and exhausted retries SHALL enter `dead_letter`.

#### Scenario: Partner accepts transfer
- **WHEN** the simulator accepts a transfer request
- **THEN** delivery is marked successful with the partner request/case ID and the same effect cannot be delivered again

#### Scenario: Partner returns retryable failure
- **WHEN** a delivery attempt receives a retryable error and retry budget remains
- **THEN** the attempt is recorded and the event is scheduled according to configured backoff

#### Scenario: Retry budget is exhausted
- **WHEN** a delivery fails permanently or exhausts its configured attempts
- **THEN** the event enters `dead_letter` with safe error category and visible recovery status

### Requirement: Manual replay is controlled and cannot duplicate a case
Only an authorized role SHALL manually replay a dead-letter transfer. Replay SHALL be audited, preserve the stable logical idempotency key, and SHALL NOT replay an already successful effect.

#### Scenario: Dead-letter transfer is replayed
- **WHEN** an authorized operator replays an eligible dead-letter event
- **THEN** the system records replay actor/reason/time and requeues the same logical transfer without creating a second partner case

#### Scenario: Successful transfer replay is requested
- **WHEN** any actor requests replay after success
- **THEN** the system rejects the request and returns existing delivery evidence without contacting the simulator again
