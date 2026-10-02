## Context

The repository currently contains the approved planning package but no application runtime. WI-001 establishes the production-relevant local foundation on which the lead, CRM, reporting and content work items will be built. The approved architecture assigns durable data and authentication to Supabase local, all future business behavior to FastAPI, visible orchestration to n8n and operator interaction to Next.js.

The foundation must be easy to demonstrate, recover from partial startup failures and expose enough diagnostics to distinguish an unhealthy service from a product defect. It must run without external accounts or paid infrastructure and remain small enough to implement within the 10-hour estimate.

## Goals / Non-Goals

**Goals:**

- Start and stop the complete local stack through one documented wrapper interface.
- Pin the application toolchains and provide consistent install, lint, type-check and test commands.
- Establish Supabase SQL migrations as the only schema history and verify reset from an empty database.
- Prove a server-side Supabase Auth session from Next.js and connectivity from Next.js to FastAPI.
- Provide explicit liveness/readiness checks for every application service.
- Keep secrets out of version control and make missing configuration fail with actionable output.
- Preserve the architectural path for future domain work without implementing it.

**Non-Goals:**

- Domain schemas, authorization roles, lead fixtures or business audit records.
- Lead classification, DMP qualification, CRM dispositions, partner reconciliation, reporting or content generation.
- Production authentication hardening, public deployment or external provider integration.
- n8n business workflows, retry policies or failure queues beyond proving service reachability.
- A second PostgreSQL instance, Alembic or direct domain-table access from Next.js or n8n.

## Decisions

### 1. Use one repository with explicit application and infrastructure boundaries

The implementation will use `apps/web`, `apps/api` and `apps/simulator` for executable applications; `supabase` for local configuration and SQL migrations; an infrastructure location for Compose and n8n assets; and root-level wrapper commands and documentation. This matches the approved architecture and makes ownership visible to reviewers.

**Alternative considered:** A single application containing UI, API and simulators would start faster initially, but it would obscure the business API boundary and make later work items harder to review independently.

### 2. Use Supabase CLI and Docker Compose as coordinated but separate lifecycle owners

Supabase CLI will own PostgreSQL, Auth and Studio. Docker Compose will own `web`, `api`, `n8n` and `simulator`. A root wrapper will sequence both systems, wait for dependencies, run migrations and report service URLs. Application containers will use published Supabase endpoints and configuration supplied at runtime rather than relying on undocumented Supabase container names.

The wrapper contract will expose at least start, stop, reset and verify operations. It must be idempotent enough that rerunning start after a partial failure either recovers or reports the failing layer clearly.

**Alternative considered:** Recreating Supabase services inside the project Compose file would offer one native Compose graph, but would duplicate Supabase CLI configuration and weaken parity with the selected local workflow.

### 3. Keep migration authority exclusively in Supabase SQL files

The initial migration establishes only the migration mechanism; it will not add business-domain tables. Database reset and verification will use Supabase CLI. Python ORM metadata may be introduced later for mapping, but it will not create or migrate schemas, and Alembic will not be configured.

**Alternative considered:** Alembic alongside Supabase migrations was rejected because two schema histories create ordering and recovery ambiguity.

### 4. Separate liveness, readiness and boundary smoke tests

FastAPI and the simulator will expose small liveness/readiness endpoints. Next.js will expose a health route and a diagnostics path that performs a server-side call to FastAPI. n8n and Supabase readiness will use their supported health/status interfaces.

An integration smoke test will create or use a synthetic local-only authentication identity, establish a Supabase session through the Next.js server-side auth path and verify the FastAPI call. Runtime credentials will be derived from local configuration or non-secret smoke inputs and will not be committed as real credentials.

**Alternative considered:** Treating container `running` state as health was rejected because it does not prove dependency readiness or the UI-to-API/Auth boundaries.

### 5. Enforce FastAPI as the future business boundary from the first scaffold

Next.js may call Supabase Auth for identity/session concerns. It will use a typed HTTP client for FastAPI for all future business operations. n8n will call documented FastAPI endpoints and will not receive a direct domain persistence path. WI-001 contains no domain tables, so verification will combine repository boundary checks with the absence of a domain schema and a working UI-to-API smoke call.

**Alternative considered:** Allowing Next.js or n8n to use Supabase data APIs directly would reduce early code, but it would split validation, authorization and audit behavior across runtimes.

### 6. Pin toolchains while selecting dependency versions during implementation

The implementation will record exact Node.js and Python runtime expectations and lock JavaScript and Python dependencies. The concrete supported versions will be selected from versions available and supportable in the implementation environment, then captured in version files, lockfiles and the README. Root commands will normalize install, format, lint, type-check and test behavior.

This proposal intentionally does not freeze unverified version numbers before dependency resolution.

**Alternative considered:** Floating versions would reduce initial setup work but make the under-15-minute clean-start claim and later debugging unreliable.

### 7. Make configuration explicit and fail closed

Version-controlled environment examples will document every required variable with safe placeholders. Actual environment files, generated state and credentials will be ignored. Startup validation will name missing variables without printing secret values. No external provider keys are required for WI-001.

**Alternative considered:** Silent defaults for all variables were rejected because they hide configuration faults and make failures harder to diagnose.

## Risks / Trade-offs

- **[Two lifecycle tools can drift or stop in the wrong order]** → Centralize sequencing and cleanup in the wrapper and verify repeated start/stop behavior.
- **[Containers may resolve host-published Supabase endpoints differently across operating systems]** → Keep endpoint construction in one configuration layer, document the supported environment and test from inside application containers.
- **[The Auth smoke test may become brittle because it crosses several services]** → Keep it synthetic, isolated and separate from unit/static checks; emit the exact failed boundary.
- **[n8n startup can dominate resources and startup time]** → Use a minimal pinned configuration, health polling and no business workflows in this work item.
- **[A broad scaffold could consume time intended for product behavior]** → Limit each app to health, connectivity and session proof; defer all domain modules and visual polish.
- **[Local Supabase development keys are easy to mistake for deployable secrets]** → Label them local-only, generate or discover them at runtime where practical and scan tracked files before completion.

## Migration Plan

1. Create the repository/toolchain baseline and environment templates.
2. Initialize Supabase local configuration and an empty baseline migration path.
3. Add FastAPI and simulator health contracts, then containerize them.
4. Add the Next.js shell, server-side Auth integration and typed FastAPI health client.
5. Add pinned n8n configuration and Compose orchestration.
6. Add wrapper sequencing, readiness polling, reset and verification commands.
7. Verify from a clean local state, document measured startup behavior and create small local WI-001 commits.

Rollback is removal of the WI-001 files/commits because the repository is greenfield and the change creates no hosted state. Supabase volumes may be stopped or reset through the wrapper; no production data is involved.

## Open Questions

None block proposal approval. Exact supported runtime and dependency versions will be resolved and pinned during implementation, with any architecture-changing incompatibility returned for human review.
