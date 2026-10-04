## ADDED Requirements

### Requirement: Creator content fixtures reset deterministically
A confirmed synthetic reset SHALL restore the ten approved fictional source cards and exactly three initial source-linked script versions in pending-review state.

#### Scenario: Content planning fixtures are restored
- **WHEN** a supervisor performs a confirmed reset after source/script review activity
- **THEN** the same ten sources and three pending-review script fixtures return with stable identifiers, valid creator/source links and compliance evidence

#### Scenario: Reset does not publish content
- **WHEN** creator content fixtures are restored
- **THEN** no script is published, scheduled or delivered, and general audit history remains available
