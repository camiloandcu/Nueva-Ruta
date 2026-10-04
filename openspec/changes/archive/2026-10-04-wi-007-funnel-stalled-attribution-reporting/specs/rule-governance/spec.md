## ADDED Requirements

### Requirement: Versioned stalled-work threshold policy
The strict rule document SHALL configure the approved stalled-work thresholds, and reports SHALL retain the exact immutable published rule version and threshold used to classify each item.

#### Scenario: Default stalled-work thresholds are seeded
- **WHEN** a clean synthetic baseline is initialized
- **THEN** its active rule version contains the documented thresholds for unclassified leads, human review, prequalified leads, Info Sent, callbacks, unconfirmed transfers and unresolved reconciliation conflicts

#### Scenario: A supervisor publishes revised thresholds
- **WHEN** a supervisor validates, reviews and publishes a new threshold policy through the existing rule lifecycle
- **THEN** new report classifications use the new immutable version while historical rule versions and prior report evidence are not rewritten

#### Scenario: Invalid threshold policy is rejected
- **WHEN** a draft omits a required stalled-work condition or supplies a non-positive/invalid threshold
- **THEN** rule validation rejects publication with an actionable field-level issue
