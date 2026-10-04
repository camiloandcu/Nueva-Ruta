# synthetic-demo-reset Specification

## Purpose
TBD - created by archiving change wi-002-domain-schema-roles-synthetic-baseline. Update Purpose after archive.
## Requirements
### Requirement: Supervisor-confirmed synthetic baseline reset
The application SHALL expose a reset command that restores the deterministic synthetic baseline only for an authenticated supervisor who supplies the exact required confirmation. The baseline SHALL include deterministic WI-006 import, normalization, quality, duplicate and reconciliation scenarios linked to the immutable synthetic partner rows.

#### Scenario: Confirmed supervisor reset succeeds
- **WHEN** an authenticated supervisor submits the exact confirmation value
- **THEN** the application restores the baseline transactionally and returns the resulting fixture counts

#### Scenario: Incorrect confirmation fails closed
- **WHEN** a supervisor submits a missing or incorrect confirmation value
- **THEN** the application rejects the reset and preserves all existing business rows

#### Scenario: Non-supervisor reset is denied
- **WHEN** an operator or analyst submits the correct confirmation value
- **THEN** the application denies the reset and preserves all existing business rows

#### Scenario: WI-006 import and review cases are restored deterministically
- **WHEN** a supervisor performs a confirmed synthetic baseline reset
- **THEN** expected normalized rows, quality issues, duplicate/conflict groups and reconciliation review cases are restored with stable identifiers and linked raw provenance

### Requirement: Reset action is auditable
Every accepted reset SHALL create a durable audit event identifying the actor, timestamp, action, reason or correlation identifier and successful outcome without exposing credentials or unredacted sensitive text.

#### Scenario: Successful reset leaves audit evidence
- **WHEN** a confirmed supervisor reset completes
- **THEN** exactly one corresponding audit event remains queryable after the baseline restoration

#### Scenario: Repeated reset remains deterministic
- **WHEN** a supervisor performs two independently confirmed resets
- **THEN** each reset restores the same baseline and produces its own distinct audit event

### Requirement: CRM operational fixtures reset without pre-authorizing delivery
A confirmed reset SHALL clear prior synthetic CRM disposition, follow-up, transfer, outbox and delivery-attempt state, then restore deterministic CRM lead stages, a missing-phone recovery case and an overdue escalation fixture. General audit history SHALL be retained. Reset SHALL NOT create an approved partner transfer or outbox event.

#### Scenario: CRM preview cases are restored
- **WHEN** a supervisor performs a confirmed synthetic baseline reset
- **THEN** disposition-ready leads, one missing-phone recovery case and one overdue escalation fixture are restored with stable identifiers and scenario counts

#### Scenario: Accumulated synthetic CRM commands are cleared
- **WHEN** a confirmed reset follows synthetic disposition and delivery activity
- **THEN** CRM command, transfer, outbox and delivery-attempt rows are cleared while general audit events remain available

#### Scenario: Reset never authorizes partner delivery
- **WHEN** a confirmed reset completes
- **THEN** no partner transfer or outbox event is created until a separate authorized approval command

### Requirement: Deterministic reporting metric fixtures
The synthetic reset SHALL restore fixed metric expectations and representative within-threshold, approaching and breached items relative to a declared reference instant and published rule version.

#### Scenario: Reporting metrics are seeded repeatably
- **WHEN** a supervisor resets the synthetic baseline more than once
- **THEN** stable lead, transfer, delivery, canonical enrollment, reconciliation and quality counts plus their source links remain identical

#### Scenario: Stalled categories are represented
- **WHEN** a report query runs against the restored fixture at its declared reference instant
- **THEN** it contains expected within, approaching and breached examples for lead, escalation, partner delivery and reconciliation work with matching threshold and rule-version evidence

#### Scenario: Metric tests use a fixed instant
- **WHEN** reporting fixture expectations are validated
- **THEN** tests use an explicit `as_of` instant and do not depend on the machine clock
