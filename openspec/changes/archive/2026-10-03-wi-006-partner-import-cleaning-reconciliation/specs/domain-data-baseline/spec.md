# Domain Data Baseline Specification

## MODIFIED Requirements

### Requirement: Constrained core domain persistence
The system SHALL persist application users, creators, leads, messages, consent evidence, audit events, content sources and raw partner-import provenance in constrained Supabase PostgreSQL tables managed exclusively by ordered SQL migrations. Derived normalized rows, quality issues, canonical enrollment candidates and reconciliation evidence SHALL be stored separately from immutable source rows and SHALL retain foreign-key provenance to the source file and row.

#### Scenario: Valid linked domain records are stored
- **WHEN** a lead fixture references a known creator, message and consent evidence
- **THEN** the database preserves the relationships, source timestamps, channel, source detail, initial status and conversation-window evidence

#### Scenario: Invalid references are rejected
- **WHEN** a domain row references an unknown required parent or violates an allowed-value constraint
- **THEN** the database rejects the mutation without leaving a partial record

#### Scenario: Raw partner provenance remains immutable
- **WHEN** a dirty partner fixture is loaded
- **THEN** its import job, filename, file checksum, row number, row checksum and original source strings remain linked and are not normalized in place

#### Scenario: Derived partner data remains traceable
- **WHEN** a normalized, canonical or reconciled partner record is stored
- **THEN** it references its immutable source row(s) and records the normalization version and evidence without rewriting raw values
