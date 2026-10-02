# local-runtime-foundation Specification

## Purpose
TBD - created by archiving change wi-001-runtime-foundation. Update Purpose after archive.
## Requirements
### Requirement: Unified local lifecycle
The repository SHALL provide one documented wrapper interface that coordinates Supabase CLI and Docker Compose for stack startup, shutdown, database reset and verification without manual dashboard configuration.

#### Scenario: Clean local startup
- **WHEN** a developer with the documented prerequisites and environment configuration runs the start operation from a clean supported environment
- **THEN** Supabase local and every application service start in dependency order and the wrapper reports their local URLs and readiness

#### Scenario: Partial startup failure
- **WHEN** a required service cannot become ready within its configured timeout
- **THEN** the wrapper exits unsuccessfully and identifies the failing service or configuration layer without exposing secret values

#### Scenario: Repeated lifecycle use
- **WHEN** a developer repeats the documented start and stop operations
- **THEN** the lifecycle completes without requiring manual container, network or dashboard cleanup

### Requirement: Healthy empty application stack
The local stack SHALL include Supabase PostgreSQL/Auth/Studio, Next.js, FastAPI, n8n and a simulator, with explicit health or status checks that distinguish process liveness from dependency readiness where applicable.

#### Scenario: Stack verification succeeds
- **WHEN** all local services and their required dependencies are available
- **THEN** the verification operation reports each service healthy and exits successfully

#### Scenario: Dependency is unavailable
- **WHEN** an application process is running but a required dependency is unavailable
- **THEN** its readiness check reports an unhealthy state with a non-secret diagnostic while its liveness result remains independently observable

### Requirement: Authoritative schema lifecycle
The system SHALL use Supabase SQL migrations as its sole schema authority, SHALL support rebuilding the local database from those migrations and SHALL NOT introduce Alembic or a second schema history.

#### Scenario: Database reset from migration history
- **WHEN** a developer runs the documented reset operation against the local Supabase project
- **THEN** the database is recreated successfully from the tracked Supabase migration history

#### Scenario: Empty domain baseline
- **WHEN** WI-001 migrations are applied
- **THEN** no Nueva Ruta business-domain tables, roles, lead fixtures or workflow data are created

### Requirement: Server-side authentication smoke path
The Next.js application SHALL use Supabase Auth with server-side session handling and SHALL provide an automated smoke path that establishes and verifies a synthetic local-only authenticated session.

#### Scenario: Authentication smoke succeeds
- **WHEN** the stack is ready and the authentication smoke test runs with its local synthetic identity
- **THEN** Next.js establishes a Supabase session, observes the authenticated identity through the server-side path and completes without adding business fixtures

#### Scenario: Authentication service is unavailable
- **WHEN** Supabase Auth cannot be reached during the smoke test
- **THEN** the test fails with the authentication boundary identified and without logging credentials or session tokens

### Requirement: FastAPI business boundary baseline
The foundation SHALL make FastAPI the exclusive interface for future business-domain reads and writes. Next.js MAY access Supabase directly only for authentication/session concerns, while Next.js and n8n SHALL NOT receive a direct business-domain table write path.

#### Scenario: UI reaches the application API
- **WHEN** the boundary smoke test runs against a healthy stack
- **THEN** Next.js reaches FastAPI through the configured HTTP client and receives a successful readiness response

#### Scenario: Boundary verification runs
- **WHEN** repository verification inspects the WI-001 scaffold
- **THEN** it confirms there are no business-domain tables and no direct domain persistence implementation in Next.js or n8n

### Requirement: Orchestrator and simulator readiness
n8n and the simulator SHALL run locally with pinned configuration, expose observable health and reach only the interfaces required by the empty foundation.

#### Scenario: Orchestration services are ready
- **WHEN** the application stack starts successfully
- **THEN** n8n and the simulator pass their health checks without requiring a business workflow, external webhook or hosted account

#### Scenario: Foundation contains no business automation
- **WHEN** the WI-001 n8n assets and simulator routes are inspected
- **THEN** they contain only configuration, health and connectivity scaffolding and do not classify leads, send messages or transfer data

### Requirement: Reproducible and safe developer tooling
The repository SHALL pin supported Node.js and Python runtimes and dependency graphs, SHALL provide commands for formatting, linting, type checking and tests, and SHALL exclude actual credentials and generated local state from version control.

#### Scenario: Baseline quality checks pass
- **WHEN** dependencies are installed from the tracked lockfiles and the aggregate quality command runs
- **THEN** formatting verification, linting, type checking and baseline tests complete successfully

#### Scenario: Required configuration is missing
- **WHEN** a required environment variable is absent
- **THEN** startup or verification fails with an actionable variable name and does not print any configured secret value

#### Scenario: Tracked-file secret check
- **WHEN** WI-001 completion verification examines tracked files
- **THEN** it finds only safe examples or local public configuration and no actual account credentials, private keys or session tokens

### Requirement: Reviewer-ready startup documentation
The README SHALL document prerequisites, initial installation, lifecycle commands, service URLs, health verification, database reset and troubleshooting sufficiently for a clean supported environment to reach a verified stack in under 15 minutes under normal local conditions.

#### Scenario: Reviewer follows the clean-start guide
- **WHEN** a reviewer starts from the documented prerequisites and follows the README without prior project state
- **THEN** the reviewer can start and verify the complete local stack without manually creating Supabase resources or n8n nodes

#### Scenario: Startup duration is recorded
- **WHEN** final WI-001 verification is performed from a clean local state
- **THEN** the implementation report records the measured startup duration and any environmental caveat affecting the 15-minute target

