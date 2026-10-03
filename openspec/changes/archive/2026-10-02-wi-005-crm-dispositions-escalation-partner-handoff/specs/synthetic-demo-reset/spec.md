# synthetic-demo-reset Specification Delta

## MODIFIED Requirements
### Requirement: Supervisor-confirmed synthetic baseline reset
The application SHALL expose a reset command that restores the deterministic synthetic baseline only for an authenticated supervisor who supplies the exact required confirmation. A confirmed reset SHALL clear prior synthetic CRM disposition, follow-up, transfer, outbox and delivery-attempt state, then restore deterministic CRM lead stages, a missing-phone recovery case and an overdue escalation fixture. General audit history SHALL be retained. Reset SHALL NOT create an approved partner transfer or outbox event.

#### Scenario: CRM preview cases are restored
- **WHEN** a supervisor performs a confirmed synthetic baseline reset
- **THEN** disposition-ready leads, one missing-phone recovery case and one overdue escalation fixture are restored with stable identifiers and scenario counts

#### Scenario: Accumulated synthetic CRM commands are cleared
- **WHEN** a confirmed reset follows synthetic disposition and delivery activity
- **THEN** CRM command, transfer, outbox and delivery-attempt rows are cleared while general audit events remain available

#### Scenario: Reset never authorizes partner delivery
- **WHEN** a confirmed reset completes
- **THEN** no partner transfer or outbox event is created until a separate authorized approval command
