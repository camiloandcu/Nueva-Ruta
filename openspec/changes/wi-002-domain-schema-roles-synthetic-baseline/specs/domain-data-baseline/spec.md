## ADDED Requirements

### Requirement: Constrained core domain persistence
The system SHALL persist application users, creators, leads, messages, consent evidence, audit events, content sources and raw partner-import provenance in constrained Supabase PostgreSQL tables managed exclusively by ordered SQL migrations.

#### Scenario: Valid linked domain records are stored
- **WHEN** a lead fixture references a known creator, message and consent evidence
- **THEN** the database preserves the relationships, source timestamps, channel, source detail, initial status and conversation-window evidence

#### Scenario: Invalid references are rejected
- **WHEN** a domain row references an unknown required parent or violates an allowed-value constraint
- **THEN** the database rejects the mutation without leaving a partial record

#### Scenario: Raw partner provenance remains immutable
- **WHEN** a dirty partner fixture is loaded
- **THEN** its import job, filename, file checksum, row number, row checksum and original source strings remain linked and are not normalized in place

### Requirement: Complete fictional creator and content baseline
The seeded baseline SHALL contain exactly five complete fictional creator profiles and exactly ten fictional content sources with the approved descriptive and provenance fields.

#### Scenario: Creator profile coverage is verified
- **WHEN** fixture integrity tests inspect the baseline
- **THEN** each creator has a stable ID, fictional name and handle, platforms, audience archetype, voice, content pillars, CTA style, attribution parameters and compliance notes

#### Scenario: Content source coverage is verified
- **WHEN** fixture integrity tests inspect the content sources
- **THEN** each source has a stable ID, type, date, channel, theme and explicit fictional provenance

### Requirement: Deterministic lead and partner fixtures
The seeded baseline SHALL contain exactly 48 lead fixtures and exactly 30 raw partner rows with stable business identifiers, a declared reference instant and machine-verifiable coverage of the approved case and defect matrices.

#### Scenario: Lead matrix is complete
- **WHEN** the fixture coverage test runs
- **THEN** it reports the expected minimum counts for safe/complete, incomplete, ambiguous, risky-claim, unsupported-debt, sensitive-pattern, opt-out, spam, replay, organic and stale/after-hours cases

#### Scenario: Partner defects are represented
- **WHEN** the raw partner fixture test runs
- **THEN** it finds the approved duplicate, conflicting-ID, phone-format, phone-mismatch, missing/contradictory creator, date-quality, repeated-enrollment and ambiguous-link categories without normalizing the raw values

#### Scenario: Consecutive seeds are repeatable
- **WHEN** the same baseline is restored twice
- **THEN** stable business identifiers, expected counts, source values and reference-relative age categories are identical

### Requirement: Synthetic-only fixture safety
All bundled people, messages, phones, enrollments, creators and content SHALL be explicitly labeled fictional and SHALL avoid intentional reference to a real consumer.

#### Scenario: Reserved-looking phones are used
- **WHEN** fixture safety tests inspect bundled lead phones
- **THEN** every populated phone follows the documented fictional NANP `555-01xx` convention

#### Scenario: Reviewer sees fixture provenance
- **WHEN** a reviewer reads the fixture documentation or supported data surface
- **THEN** the data is identified as synthetic, non-contactable and unsuitable for production use

