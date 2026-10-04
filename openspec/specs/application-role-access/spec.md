# application-role-access Specification

## Purpose
TBD - created by archiving change wi-002-domain-schema-roles-synthetic-baseline. Update Purpose after archive.
## Requirements
### Requirement: Seeded local identities and application roles
The local baseline SHALL provide password-protected Supabase Auth identities mapped server-side to operator, supervisor and Influgain analyst application roles.

#### Scenario: Seeded identity receives its application role
- **WHEN** a seeded user authenticates with valid local demo credentials
- **THEN** FastAPI verifies the identity and resolves exactly the expected application role from trusted server-side data

#### Scenario: Unmapped identity is denied
- **WHEN** a valid Supabase identity has no active application-user mapping
- **THEN** FastAPI denies protected business access without assigning a default role

### Requirement: FastAPI enforces the business authorization boundary
FastAPI SHALL verify authenticated identity and enforce application-role authorization for every protected business query or command; Next.js and n8n SHALL NOT bypass this boundary through direct business-table access.

#### Scenario: Missing or invalid token is rejected
- **WHEN** a protected endpoint receives no valid Supabase access token
- **THEN** the endpoint rejects the request without returning business data or mutating state

#### Scenario: Authorized operator accesses operational fixtures
- **WHEN** an authenticated operator requests an allowed operational fixture view
- **THEN** FastAPI returns the permitted synthetic domain representation

#### Scenario: Unauthorized role attempts a supervisor command
- **WHEN** an authenticated non-supervisor invokes a supervisor-only command
- **THEN** FastAPI denies the command and leaves domain state unchanged

### Requirement: Analyst message minimization
The analyst role SHALL receive only the attribution and aggregate-ready fields necessary for analysis and SHALL NOT receive unredacted message details.

#### Scenario: Analyst queries lead attribution data
- **WHEN** an authenticated analyst requests the supported lead data surface
- **THEN** the response contains permitted identifiers, creator/channel/source, safe status and time fields while omitting or redacting original message details

#### Scenario: Analyst requests restricted message detail
- **WHEN** an authenticated analyst calls a restricted message-detail endpoint
- **THEN** FastAPI denies access without including the message content in the response or logs

### Requirement: Role-scoped operational reporting
FastAPI SHALL authorize reporting queries for the seeded application roles and minimize analyst drill-through to the attribution and aggregate-ready fields necessary for analysis.

#### Scenario: Analyst opens report evidence
- **WHEN** an authenticated analyst follows a supported report link
- **THEN** FastAPI returns safe identifiers, original creator/channel/source attribution, status, timestamps, category and provenance references while omitting unredacted message details and raw phone values

#### Scenario: Unauthenticated viewer requests a report
- **WHEN** a report query or drill-through has no valid authenticated principal
- **THEN** FastAPI rejects the request without returning aggregate or business evidence
