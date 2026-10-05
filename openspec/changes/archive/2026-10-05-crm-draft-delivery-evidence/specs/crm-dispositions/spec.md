# crm-dispositions Specification

## MODIFIED Requirements

### Requirement: Disposition mapping and required evidence

The system SHALL apply the approved mapping: `No Answer` to `contact_attempted`; `Info Sent` to `info_sent`; `Transferido` to `transferred`; `Call Back` to `callback_scheduled`; and `No le interesa` to `closed_not_interested`. Each command SHALL validate its required evidence as defined in REQ-B02 before changing state. For future `Info Sent` commands, an approved draft alone SHALL NOT count as sent evidence; the command SHALL require a same-case simulated-delivery event or a documented manual-action reference. Historical disposition records SHALL remain unchanged and SHALL not be represented as verified deliveries without such evidence.

#### Scenario: Callback without a future instant is rejected atomically

- **WHEN** an actor requests `Call Back` without a future timezone-aware timestamp
- **THEN** the command fails without changing stage, recording a successful disposition or creating an outbox effect

#### Scenario: No Answer has no usable phone

- **WHEN** an actor records `No Answer` for a lead without a usable phone
- **THEN** the system creates or updates visible missing-phone recovery work, records the documented `contact_attempted` stage and links the disposition to that recovery work

#### Scenario: Info Sent requires approved evidence

- **WHEN** an actor records `Info Sent` without a same-case simulated delivery of an approved draft or a documented manual-action record
- **THEN** the system rejects the disposition without changing stage

#### Scenario: Explicit opt-out closes the lead

- **WHEN** an actor records `No le interesa` with a reason
- **THEN** the lead moves to `closed_not_interested`, and opt-out is recorded only when explicit revocation evidence is present

## ADDED Requirements

### Requirement: Case-specific message evidence

The CRM SHALL expose approved intake response and follow-up drafts for the selected case only, including origin and delivery state. A draft SHALL never be shown as delivered solely because it was approved.

#### Scenario: Approved intake draft is available in CRM

- **WHEN** an intake response draft is approved for a source event linked to a CRM state
- **THEN** that case's CRM evidence picker shows the approved draft as undelivered until a separate delivery event is recorded

#### Scenario: Another case is selected

- **WHEN** the operator switches to a different CRM case
- **THEN** the first case's draft and delivery options are absent from the second case
