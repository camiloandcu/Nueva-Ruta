# Domain Data Baseline Specification

## ADDED Requirements

### Requirement: Stable human-readable CRM case identity

Every CRM lead SHALL have a unique, stable `LEAD-<number>` business label for operator display, while UUID keys and source provenance remain intact. The database SHALL allocate labels safely for concurrent ingestion and preserve existing fixture labels.

#### Scenario: Existing dynamic events are backfilled

- **WHEN** the case-identity migration applies to existing seeded and dynamically ingested CRM states
- **THEN** seed labels remain `LEAD-001…048`, every dynamic state receives one unique `LEAD-<number>` label, and no primary or foreign key changes

#### Scenario: Concurrent events create cases

- **WHEN** distinct source events are ingested concurrently or one event is replayed
- **THEN** each distinct CRM state has one unique stable label and replay creates no additional label or case
