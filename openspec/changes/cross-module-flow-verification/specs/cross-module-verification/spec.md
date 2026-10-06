## ADDED Requirements

### Requirement: Reproducible cross-module journey evidence

The project SHALL maintain automated synthetic browser journeys that connect the main operator actions to their authoritative case, delivery, escalation, partner, and reporting records.

#### Scenario: Case progresses through reviewed communication

- **WHEN** an operator approves an Intake draft and opens the associated CRM case
- **THEN** the same stable case label and approved-undelivered state SHALL be visible
- **AND** delivery and disposition evidence SHALL appear only after their respective authorized actions on that case

#### Scenario: Escalation ownership and resolution

- **WHEN** a supervisor assigns an escalation and the assigned operator starts review
- **THEN** the named owner, lifecycle state, and audit evidence SHALL identify that case and actor
- **AND** another operator's unauthorized action SHALL fail without changing the escalation

#### Scenario: Partner evidence reaches reporting

- **WHEN** a synthetic transfer or partner import produces delivery, recovery, or reconciliation evidence
- **THEN** the related case and source enrollment SHALL remain traceable through the operational UI and report
- **AND** an ambiguous or conflicting record SHALL not be presented as a confirmed commission outcome

#### Scenario: Role isolation

- **WHEN** an analyst opens permitted reporting or reconciliation routes and attempts a CRM command
- **THEN** permitted evidence SHALL be visible and the CRM command SHALL be denied without mutation

### Requirement: Verification uses isolated synthetic state

Cross-module journeys SHALL use synthetic fixtures and unique command identifiers, SHALL not mutate hosted demo records, and SHALL report any untested hosted-authenticated boundary as a limitation.

#### Scenario: Repeat local browser suite

- **WHEN** the suite runs after an earlier successful run
- **THEN** its fixtures and idempotency keys SHALL avoid unintended collisions or false success from prior records
