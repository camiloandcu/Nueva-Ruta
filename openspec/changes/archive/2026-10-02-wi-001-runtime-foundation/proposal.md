## Why

Every later Nueva Ruta workflow depends on a reproducible, observable local environment. Establishing the empty runtime first reduces demo-day setup risk while preserving the approved FastAPI boundary and Supabase migration authority before domain behavior is introduced.

## What Changes

- Establish the repository layout and pinned Node.js and Python toolchains.
- Configure Supabase local for PostgreSQL, Auth and Studio, with Supabase SQL migrations as the sole schema authority.
- Add a minimal Next.js App Router shell with server-side Supabase Auth session handling and FastAPI connectivity diagnostics.
- Add minimal FastAPI and simulator services plus an n8n service, all with health checks and no business workflows.
- Add a single wrapper interface for startup, shutdown, database reset and verification across Supabase CLI and Docker Compose.
- Add environment templates, secret-safety controls, baseline static checks and smoke tests.
- Document a clean startup path that requires no manual dashboard configuration and targets completion in under 15 minutes.
- Explicitly exclude domain tables, business roles, lead processing, CRM behavior, partner imports, AI integration and hosted deployment.

## Capabilities

### New Capabilities

- `local-runtime-foundation`: Reproducible local orchestration, service health, migration ownership, authentication smoke coverage and architectural boundary checks for the empty Nueva Ruta stack.

### Modified Capabilities

None.

## Impact

- Affected areas: repository root, `apps/web`, `apps/api`, `apps/simulator`, `supabase`, n8n configuration, Compose configuration, wrapper scripts and developer documentation.
- Local prerequisites: Docker with Compose, Supabase CLI, a pinned Node.js runtime/package manager and a pinned Python runtime/package manager.
- Runtime services: Supabase local PostgreSQL/Auth/Studio, Next.js, FastAPI, n8n and the simulator.
- No external account, paid dependency, production data or hosted resource is introduced.
- No existing API or capability is changed because this is the first implementation work item.
