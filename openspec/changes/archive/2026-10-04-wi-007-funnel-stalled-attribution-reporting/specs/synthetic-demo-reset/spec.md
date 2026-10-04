## ADDED Requirements

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
