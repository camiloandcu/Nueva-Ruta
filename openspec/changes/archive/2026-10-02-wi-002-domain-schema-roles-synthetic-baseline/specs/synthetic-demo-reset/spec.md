## ADDED Requirements

### Requirement: Supervisor-confirmed synthetic baseline reset
The application SHALL expose a reset command that restores the deterministic synthetic baseline only for an authenticated supervisor who supplies the exact required confirmation.

#### Scenario: Confirmed supervisor reset succeeds
- **WHEN** an authenticated supervisor submits the exact confirmation value
- **THEN** the application restores the baseline transactionally and returns the resulting fixture counts

#### Scenario: Incorrect confirmation fails closed
- **WHEN** a supervisor submits a missing or incorrect confirmation value
- **THEN** the application rejects the reset and preserves all existing business rows

#### Scenario: Non-supervisor reset is denied
- **WHEN** an operator or analyst submits the correct confirmation value
- **THEN** the application denies the reset and preserves all existing business rows

### Requirement: Reset action is auditable
Every accepted reset SHALL create a durable audit event identifying the actor, timestamp, action, reason or correlation identifier and successful outcome without exposing credentials or unredacted sensitive text.

#### Scenario: Successful reset leaves audit evidence
- **WHEN** a confirmed supervisor reset completes
- **THEN** exactly one corresponding audit event remains queryable after the baseline restoration

#### Scenario: Repeated reset remains deterministic
- **WHEN** a supervisor performs two independently confirmed resets
- **THEN** each reset restores the same baseline and produces its own distinct audit event
