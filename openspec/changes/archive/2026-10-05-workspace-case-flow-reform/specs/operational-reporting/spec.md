# operational-reporting Specification

## ADDED Requirements

### Requirement: Data-backed report filter choices

The reporting interface SHALL offer only valid, role-safe creator, channel and state filter choices derived from the available reporting data or an authenticated filter-options contract. Applied choices SHALL remain visible through report refresh, pagination and evidence drill-through.

#### Scenario: Available records change

- **WHEN** reporting data adds or removes an eligible creator or state
- **THEN** the corresponding filter choices update without editing fixed browser constants

#### Scenario: Viewer paginates stalled work

- **WHEN** a viewer changes the stalled-work page after choosing filters
- **THEN** the same filter context is applied and shown on the new page
