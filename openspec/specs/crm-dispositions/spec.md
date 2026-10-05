# crm-dispositions Specification

## Purpose
TBD - created by archiving change 2026-10-02-wi-005-crm-dispositions-escalation-partner-handoff. Update Purpose after archive.
## Requirements
### Requirement: Qualification is an explicit operator decision
An authorized operator SHALL be able to move an eligible lead from `new` or `under_review` to `prequalified` with a recorded reason. Ignored/opted-out leads, unresolved escalations and non-responding WI-004 decisions without resolved transfer-eligibility evidence SHALL be rejected without changing the stage.

#### Scenario: Eligible lead is qualified
- **WHEN** an authorized operator records a reason for a synthetic lead in `new` or `under_review` with no disqualifying decision or consent state
- **THEN** the lead moves to `prequalified` and the actor, time and reason are audited

#### Scenario: Ineligible lead is rejected
- **WHEN** an operator tries to qualify an ignored, opted-out or unresolved-escalation lead
- **THEN** the command fails and the commercial stage remains unchanged

### Requirement: Exactly five supported dispositions
The system SHALL accept only `No Answer`, `Info Sent`, `Transferido`, `Call Back` and `No le interesa`. Unknown values SHALL be rejected with an actionable error and SHALL NOT mutate lead state.

#### Scenario: Unknown disposition is rejected
- **WHEN** an actor submits an unsupported disposition
- **THEN** the API returns a stable actionable error, records safe error/audit evidence and leaves the lead and side effects unchanged

### Requirement: Disposition mapping and required evidence
The system SHALL apply the approved mapping: `No Answer` to `contact_attempted`; `Info Sent` to `info_sent`; `Transferido` to `transferred`; `Call Back` to `callback_scheduled`; and `No le interesa` to `closed_not_interested`. Each command SHALL validate its required evidence as defined in REQ-B02 before changing state.

#### Scenario: Callback without a future instant is rejected atomically
- **WHEN** an actor requests `Call Back` without a future timezone-aware timestamp
- **THEN** the command fails without changing stage, recording a successful disposition or creating an outbox effect

#### Scenario: No Answer has no usable phone
- **WHEN** an actor records `No Answer` for a lead without a usable phone
- **THEN** the system creates or updates visible missing-phone recovery work, records the documented `contact_attempted` stage and links the disposition to that recovery work

#### Scenario: Info Sent requires approved evidence
- **WHEN** an actor records `Info Sent` without an approved substantive draft and simulated delivery evidence or a documented manual-action record
- **THEN** the system rejects the disposition without changing stage

#### Scenario: Explicit opt-out closes the lead
- **WHEN** an actor records `No le interesa` with a reason
- **THEN** the lead moves to `closed_not_interested`, and opt-out is recorded only when explicit revocation evidence is present

### Requirement: Atomic disposition audit
Every accepted disposition SHALL record actor, timestamp, prior stage, resulting stage, reason, generated draft reference, rule/template version and side-effect status in the same transaction as its state change.

#### Scenario: Disposition succeeds
- **WHEN** a valid authorized command passes transition and evidence checks
- **THEN** the resulting stage, disposition evidence, audit record and required outbox event commit atomically

### Requirement: Transfer requires distinct explicit approval
The `Transferido` disposition SHALL require a previously recorded explicit approval by an authorized operator and a partner request ID. Neither pre-qualification, disposition text nor escalation resolution SHALL constitute transfer approval.

#### Scenario: Transfer disposition has no approval
- **WHEN** an actor submits `Transferido` without an approved transfer record and accepted partner request ID
- **THEN** the command fails without mutating the commercial stage

### Requirement: Exact CRM case selection

The CRM interface SHALL honor an authorized deep-linked immutable CRM state ID, retain it across refresh and filters, and display the business label as the primary identifier. For source-event cases, it SHALL link back to the matching intake evidence.

#### Scenario: Deep-linked case is present

- **WHEN** the CRM opens with a valid case ID while other leads exist
- **THEN** only that case is selected, its label and stage are visible, and subsequent actions target that immutable ID

#### Scenario: Deep-linked case is missing

- **WHEN** the CRM opens with an invalid or inaccessible case ID
- **THEN** the interface explains that the requested case is unavailable and does not silently select a seed case
