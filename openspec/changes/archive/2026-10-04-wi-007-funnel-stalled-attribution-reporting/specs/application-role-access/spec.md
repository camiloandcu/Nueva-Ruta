## ADDED Requirements

### Requirement: Role-scoped operational reporting
FastAPI SHALL authorize reporting queries for the seeded application roles and minimize analyst drill-through to the attribution and aggregate-ready fields necessary for analysis.

#### Scenario: Analyst opens report evidence
- **WHEN** an authenticated analyst follows a supported report link
- **THEN** FastAPI returns safe identifiers, original creator/channel/source attribution, status, timestamps, category and provenance references while omitting unredacted message details and raw phone values

#### Scenario: Unauthenticated viewer requests a report
- **WHEN** a report query or drill-through has no valid authenticated principal
- **THEN** FastAPI rejects the request without returning aggregate or business evidence
