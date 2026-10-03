# human-draft-review Specification Delta

## ADDED Requirements

### Requirement: No Answer follow-up remains an editable human draft
Recording `No Answer` with a usable phone SHALL create one editable follow-up draft linked to the disposition idempotency key. The draft SHALL remain pending until authorized approval, and approval SHALL run deterministic compliance validation without delivering the message.

#### Scenario: Operator approves a compliant follow-up
- **WHEN** an authorized operator submits edited follow-up content that passes current deterministic compliance checks
- **THEN** the system records the content checksum and approval actor/time while leaving delivery pending for a separate action

#### Scenario: Operator submits prohibited follow-up content
- **WHEN** edited follow-up content fails deterministic compliance checks
- **THEN** approval is rejected and no approval or delivery state is written

### Requirement: Escalations have an auditable lifecycle independent of lead stage
Authorized users SHALL be able to assign, claim, resolve and close an escalation with actor, timestamp and reason evidence. Escalation assignment and resolution SHALL NOT implicitly change the commercial lead stage or approve a partner transfer.

#### Scenario: Operator claims assigned work
- **WHEN** an authorized operator claims an open escalation
- **THEN** the escalation records its owner and claim time while the commercial lead stage remains unchanged

#### Scenario: Supervisor closes work with a reason
- **WHEN** a supervisor closes an escalation with a reason
- **THEN** the escalation records closure evidence and retains the lead's independent commercial stage

#### Scenario: Escalation SLA is breached
- **WHEN** an escalation remains unresolved past its due time
- **THEN** the operational view identifies it as breached using its persisted due time and shows owner and next action
