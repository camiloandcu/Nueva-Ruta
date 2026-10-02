## 1. Repository and Toolchain Baseline

- [ ] 1.1 Create the approved application and infrastructure directories, baseline ignore rules and root command interface without domain modules.
- [ ] 1.2 Select and record supported Node.js and Python versions, initialize package metadata and commit exact dependency lockfiles.
- [ ] 1.3 Configure aggregate format, lint, type-check and test commands for JavaScript/TypeScript and Python projects.

## 2. Supabase Local Foundation

- [ ] 2.1 Initialize pinned Supabase local configuration for PostgreSQL, Auth and Studio without hosted project linkage.
- [ ] 2.2 Add the authoritative empty baseline SQL migration path and document the prohibition on Alembic or a second schema history.
- [ ] 2.3 Add and verify database start, status and reset commands from a clean local state.

## 3. FastAPI and Simulator Services

- [ ] 3.1 Scaffold FastAPI with separate liveness and readiness endpoints and structured non-secret diagnostics.
- [ ] 3.2 Scaffold the simulator with health/connectivity behavior only and no lead, chat or partner business routes.
- [ ] 3.3 Add focused unit tests and container definitions for both Python services.

## 4. Next.js and Authentication Boundary

- [ ] 4.1 Scaffold the minimal Next.js App Router shell, health route and typed FastAPI readiness client.
- [ ] 4.2 Configure Supabase Auth server-side session handling without adding business roles or direct domain-table access.
- [ ] 4.3 Implement an automated synthetic local Auth session and Next.js-to-FastAPI boundary smoke test that redacts credentials and tokens.

## 5. n8n and Local Orchestration

- [ ] 5.1 Add a pinned minimal n8n service with persistent local development state and health verification, but no business workflows.
- [ ] 5.2 Add Docker Compose orchestration for web, API, n8n and simulator using published Supabase endpoints and explicit health dependencies.
- [ ] 5.3 Implement the root wrapper operations for start, stop, reset and verify, including readiness polling, timeouts and actionable failure output.

## 6. Configuration Safety and Architectural Checks

- [ ] 6.1 Add complete environment examples, runtime configuration validation and ignore rules for actual credentials and generated state.
- [ ] 6.2 Add verification that WI-001 contains no business-domain schema and no direct domain persistence path from Next.js or n8n.
- [ ] 6.3 Add a tracked-file secret scan or equivalent automated check suitable for the local baseline.

## 7. End-to-End Verification and Documentation

- [ ] 7.1 Run clean build, start, health, Auth/API smoke, database reset, repeated lifecycle and shutdown verification and resolve failures.
- [ ] 7.2 Document prerequisites, setup, lifecycle commands, service URLs, migration ownership and troubleshooting in the product-facing README.
- [ ] 7.3 Measure and record clean startup time against the under-15-minute target, including any supported-environment caveats.
- [ ] 7.4 Run all static checks and tests, inspect tracked files for secrets, and record WI-001 evidence in small local Conventional Commits without pushing or merging.
