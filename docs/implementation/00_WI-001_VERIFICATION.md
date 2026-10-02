# WI-001 implementation verification

- Work item: `WI-001 — Repository and runtime foundation`
- Branch: `feat/wi-001-runtime-foundation`
- Verification date: 2026-10-02 (America/Bogota)
- Status: implementation complete; container runtime verification pending local Docker integration

## Implemented boundaries

- Next.js App Router operator shell with server-side Supabase Auth session handling.
- FastAPI liveness/readiness API and exclusive future business-data boundary.
- Local Supabase configuration for PostgreSQL, Auth and Studio, with SQL migrations as the only schema authority.
- Pinned n8n `2.41.3` service and an intentionally empty workflow directory.
- Health-only external-system simulator.
- One wrapper interface through `make up`, `make down`, `make reset` and `make verify`.
- Locked Node.js and Python dependency graphs, static checks, tests, boundary verification and tracked-file secret-pattern checks.

## Completed verification

| Check | Result |
|---|---|
| OpenSpec validation | Passed, 4/4 artifacts complete |
| Prettier and ESLint | Passed |
| Ruff formatting/lint | Passed |
| TypeScript and mypy | Passed |
| Node architecture tests | 2 passed |
| Python tests | 3 passed |
| Repository boundary/secret-pattern check | Passed |
| Next.js production build | Passed; standalone server artifact generated |
| Supabase CLI | Installed and pinned at `2.119.0` |
| Supabase TOML syntax | Parsed successfully |

The n8n version was checked against its official `n8n@2.41.3` release before pinning: <https://github.com/n8n-io/n8n/releases/tag/n8n@2.41.3>.

## Pending runtime evidence

Docker Desktop is installed on the host, but its WSL integration is not enabled for this distribution. `docker version` currently returns the Docker Desktop WSL integration instruction instead of a client/server result. Therefore the following claims are intentionally not marked complete:

- clean Compose build/start/stop;
- Supabase database reset against running containers;
- live Next.js → FastAPI → Supabase Auth readiness;
- live authenticated SSR session smoke;
- n8n and simulator container health;
- measured clean startup duration against the 15-minute target.

After enabling Docker Desktop → Settings → Resources → WSL Integration for this distribution, run:

```bash
cp .env.example .env
# Replace the local placeholders as documented in README.md.
pnpm install --frozen-lockfile
uv sync --frozen
make up
make verify
make reset
make down
```

Record the clean-start duration here before completing tasks 2.3, 7.1 and 7.3 in the OpenSpec checklist.
