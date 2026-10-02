# WI-001 implementation verification

- Work item: `WI-001 — Repository and runtime foundation`
- Branch: `feat/wi-001-runtime-foundation`
- Verification date: 2026-10-02 (America/Bogota)
- Status: complete

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
| Compose application health | Next.js, FastAPI, n8n and simulator healthy |
| Supabase health | PostgreSQL, Auth, Studio and Kong healthy |
| Boundary smoke | Next.js → FastAPI and authenticated Supabase SSR session passed |
| Migration recovery | Database reset and post-reset authenticated smoke passed |
| Repeated lifecycle | Start → verify → reset → verify → stop → start → verify → stop passed |

The n8n version was checked against its official `n8n@2.41.3` release before pinning: <https://github.com/n8n-io/n8n/releases/tag/n8n@2.41.3>.

## Startup measurement and environment caveat

The first fully successful `make up` completed in `395.27 s` (`6m35s`) and the verified restart after a complete stop completed in `237.33 s` (`3m57s`). Both are below the 15-minute acceptance target.

The first machine setup exposed a Docker Desktop WSL credential-helper failure while downloading public images. The wrapper now detects that specific WSL configuration and uses an ignored, isolated Docker configuration for the public WI-001 images. Supabase's initial image downloads occurred during the failed diagnostic attempt, so `6m35s` is not claimed as an image-cache-empty benchmark. Total observed cold-image preparation plus the first successful build remained approximately `14m24s`, but network and Docker Desktop conditions can change that figure.

The final verified reviewer sequence is:

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
