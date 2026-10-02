# rule-governance Specification

## Purpose
TBD - created by archiving change wi-003-rule-governance-compliance-policy. Update Purpose after archive.
## Requirements
### Requirement: Versioned rule document
The system SHALL define a strict versioned rule document covering classification triggers, debt ranges and types, state coverage, operating hours, escalation SLA, retries, stage transitions, automatic templates, feature flags and compliance controls.

#### Scenario: Complete document validates
- **WHEN** a rule document supplies every required section with allowed values and consistent references
- **THEN** the system returns normalized content with no validation errors

#### Scenario: Unknown or inconsistent policy fails
- **WHEN** a rule document contains an unknown field, conflicting range, invalid timezone, dangling transition or inconsistent reference
- **THEN** validation returns stable field-level error codes and the document cannot be published

### Requirement: Approved fictional defaults
The repository SHALL seed a clearly fictional rule document containing the approved USD 5,000–100,000 continuation range, supported unsecured debt types, California/Texas/Florida coverage and Monday–Friday 09:00–18:00 `America/New_York` operating hours.

#### Scenario: Clean reset restores the approved policy
- **WHEN** the local database is rebuilt from migrations and seed assets
- **THEN** exactly one deterministic initial published version is active with the approved fictional defaults and stable content hash

### Requirement: YAML import and deterministic export
Authorized users SHALL be able to import valid YAML as a database draft and export normalized draft or published content as deterministic YAML without rebuilding the application.

#### Scenario: Valid YAML becomes a draft
- **WHEN** an authorized operator or supervisor imports valid rule YAML
- **THEN** the system creates a draft with normalized content, validation result, source metadata and content hash candidate

#### Scenario: Invalid YAML does not become publishable
- **WHEN** imported YAML is malformed or fails rule validation
- **THEN** the system returns actionable parse or validation errors and does not create a publishable version

#### Scenario: Export and reimport preserve normalized content
- **WHEN** an exported rule version is reimported
- **THEN** its normalized content and canonical content hash are identical to the source version

### Requirement: Human-readable diff and publication review
The system SHALL provide a stable human-readable diff between a draft and the active published version before publication.

#### Scenario: Reviewer inspects material changes
- **WHEN** a reviewer opens a valid draft
- **THEN** the interface and API identify added, removed and changed normalized policy paths with old and new safe values

#### Scenario: Unchanged draft is identified
- **WHEN** normalized draft content equals the active version
- **THEN** the system reports no material changes and prevents duplicate publication

### Requirement: Supervisor-only immutable publication
Only an authenticated supervisor SHALL publish a valid reviewed draft, and every published version SHALL be immutable, monotonically versioned and linked to its actor, timestamp, content hash, source draft and parent or derived version.

#### Scenario: Supervisor publishes a reviewed draft
- **WHEN** a supervisor submits a valid draft and confirms the current content hash after reviewing its diff
- **THEN** the system atomically publishes and activates the next version and creates matching audit evidence

#### Scenario: Operator cannot publish
- **WHEN** an operator attempts to publish a valid draft
- **THEN** the system denies publication and leaves active and historical versions unchanged

#### Scenario: Stale confirmation cannot publish changed content
- **WHEN** a draft content hash differs from the hash confirmed by the supervisor
- **THEN** publication fails and requires a new diff review

#### Scenario: Published history cannot be rewritten
- **WHEN** any runtime actor attempts to update or delete a published version
- **THEN** the database rejects the mutation and preserves the active version and audit history

### Requirement: Rollback through derived publication
Rollback SHALL create a new draft derived from an earlier published version and SHALL take effect only by publishing a new monotonically versioned record.

#### Scenario: Supervisor rolls back to earlier content
- **WHEN** a supervisor derives, reviews and publishes a rollback draft from an earlier version
- **THEN** the new active version has the earlier normalized content, a new version number/hash context and explicit derivation lineage without modifying history
