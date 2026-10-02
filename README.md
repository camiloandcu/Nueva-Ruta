# Nueva Ruta

Nueva Ruta is a fictional Spanish-language debt-management operations product for the US Hispanic market. It will make creator-attributed lead handling, human-reviewed messaging, partner handoff and imperfect-data reconciliation visible and auditable. WI-001 provides only the production-relevant local runtime foundation; it deliberately contains no lead or financial business behavior.

## Runtime architecture

```text
Browser -> Next.js -> FastAPI -> Supabase local PostgreSQL
              |           |
              |           +-> Supabase Auth health
              +-> Supabase Auth session

n8n ---------> FastAPI contracts (future work items)
simulator ----> external boundary fixtures (future work items)
```

- **Next.js App Router** owns the Spanish operator shell and server-side session handling.
- **FastAPI** is the exclusive boundary for future business reads and writes.
- **Supabase local** owns PostgreSQL, Auth and Studio. Its SQL migrations are the only schema history.
- **n8n** will make orchestration visible without becoming the source of truth.
- **Simulator** will emulate chat and partner boundaries without external accounts.

## Prerequisites

- Docker Desktop or Docker Engine with Compose v2. In WSL, enable Docker Desktop integration for the distribution.
- Node.js `24.18.0` and pnpm `11.17.0` (Corepack is acceptable).
- Python `3.12.12` and uv `0.12.0`.
- `curl` and a POSIX shell.
- At least 6 GB of free Docker memory is recommended for the combined Supabase and application stack.

No Supabase account, n8n account or paid service is required.

## First start (target: under 15 minutes)

```bash
cp .env.example .env
```

Replace every `replace-with-a-local-*` value in `.env` with local random values. The smoke password must contain lowercase and uppercase letters plus digits and be at least 12 characters. Do not reuse production credentials. Then install locked dependencies and start:

```bash
pnpm install --frozen-lockfile
uv sync --frozen
make up
make verify
```

The wrapper starts Supabase first, reads its local anonymous key into the ignored `.env.runtime`, builds the application containers and waits for readiness. It prints every local URL when successful. No dashboard resources or n8n nodes must be created manually.

## Daily commands

| Command | Result |
|---|---|
| `make up` | Start Supabase and the Compose applications, then wait for readiness |
| `make verify` | Check every service plus Next.js → FastAPI and Auth SSR smoke paths |
| `make reset` | Rebuild the local database from Supabase SQL migrations |
| `make quality` | Run format, lint, type, tests, architecture and secret-pattern checks |
| `make down` | Stop Compose and Supabase local services |

Service URLs after startup:

- Web: <http://localhost:3000>
- FastAPI docs: <http://localhost:8000/docs>
- n8n: <http://localhost:5678>
- Simulator docs: <http://localhost:8081/docs>
- Supabase Studio: <http://localhost:54323>

## Migration and boundary rules

All schema changes belong in `supabase/migrations`. Do not add Alembic. Next.js may use Supabase directly only for authentication/session handling; all future business data must cross FastAPI. n8n follows the same boundary. `pnpm verify:repo` checks these WI-001 invariants.

## Troubleshooting

- **Docker is unavailable in WSL:** enable the distribution under Docker Desktop → Settings → Resources → WSL Integration, reopen the shell and run `docker version`. When Docker Desktop configures its Windows credential helper inside WSL, the wrapper uses an ignored, public-image-only Docker config so startup does not depend on that helper.
- **A required variable is missing:** copy `.env.example` again and replace its local placeholders. The wrapper reports variable names but never values.
- **Supabase is partially running:** run `make down`, then `make up`. The wrapper is designed for repeated lifecycle use.
- **A port is already occupied:** stop the conflicting local service. The reserved ports are 3000, 5678, 8000, 8081 and 54320–54329.
- **Auth smoke fails after a reset:** rerun `make verify`; the synthetic local identity is recreated at runtime and no business fixture is inserted.

## Current scope

This increment proves runtime health, migration recovery, session establishment and architectural boundaries. Lead ingestion, DMP pre-qualification, CRM dispositions, retries, partner reconciliation, reporting and content are intentionally reserved for separately reviewed OpenSpec changes.
