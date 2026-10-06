# WI-009 Verification Record

Status: local implementation and hosted demo baseline verified; final clean-start/reset rehearsal, ongoing cost gate, final operational-flow review and scheduled shutdown remain open.

## Verified locally

- `pnpm quality` — passed after the hosted report fix: formatting, lint, type checks, 12 web tests, 97 Python tests, and repository boundary/secret-pattern checks. Four existing Starlette deprecation warnings remain.
- `pnpm --dir apps/web build` — production build passed.
- `pnpm exec supabase test db --local` — passed: 8 files, 198 pgTAP assertions.
- `openspec validate wi-009-reliability-scale-demo-release --strict --no-interactive` — passed.
- Disposable memory-backed n8n 2.41.3 import — all four tracked workflows imported successfully. No credentials or persistent data were mounted.
- `pnpm exec openspec validate wi-009-reliability-scale-demo-release --strict` — passed after the final code changes.
- Regression test for scheduled callback age/status — passed. It prevents the report composer from treating callback due-time as a normal elapsed-time unit.
- `make load-test` — 200 deterministic synthetic inbound events plus 20 replays; 200/200 results queryable, zero request errors/losses, 20/20 replay responses marked replayed, zero duplicate effects. Initial ingest was 14.86 unique events/s, p50 474 ms, p95 1,138.59 ms. Result visibility took 12.173 s; async backlog is not applicable to this synchronous endpoint.

The load run ID was `a0c2be4db662`. It used the existing local fixture database without reset, so its synthetic rows remain there. Exact run timestamps were not emitted by that first run; the harness now records timestamps on subsequent runs. Post-run resource sampling found 12 reported CPUs, 3.6 GiB RAM, and 1 GiB swap fully used; timings are local, machine-specific observations and do not establish production capacity.

## Hosted demo verification

- Railway project `Influgain WI-009 Demo`, environment `demo`; services `web`, `api`, `simulator` and `n8n`. Only `web` has a public domain: `https://web-demo-ffe2.up.railway.app`. API, simulator and n8n communicate over Railway private networking. All services have small resource limits and serverless sleep enabled.
- Supabase project `influgain-wi009-demo` (`sa-east-1`) is `ACTIVE_HEALTHY`. All 14 tracked migrations were applied in order; only the synthetic baseline was seeded. Auth public signup is disabled and the callback allow-list is restricted to the web domain.
- Three synthetic demo users were provisioned for operator, supervisor and analyst roles. Passwords are managed for private handoff and are not stored in source or these records.
- Hosted checks: `/login` returned 200; `/api/health` and `/api/diagnostics` returned 200 with web/API/Supabase Auth ready; unauthenticated report access returned 401. A real hosted supervisor login returned 303, authenticated `/api/operations/reports/overview` returned 200 with seeded synthetic data, logout returned 303 to `/login`, and the report route again returned 401 after logout.
- API service was redeployed at commit `029aa7a` after fixing the callback scheduled-time report failure. Railway reports deployment `11625366-5ea4-4837-a4ac-20b930462eb7` as `SUCCESS`.
- Railway's last readable CLI usage snapshot before token refresh trouble showed USD 0.0006 current usage/current bill and USD 0.0003 estimated bill. The user's account is on a 30-day USD 5 trial. There is no hard limit; Railway's minimum compute hard limit is USD 10 (or USD 0, which blocks compute), so the approved USD 7 cap cannot be mechanically enforced. A later CLI refresh could not persist the OAuth token because the home directory is read-only. No claim is made that future cost is bounded; keep checking usage and stop services if projected spend approaches USD 7. Supabase's project-creation quote was USD 0/month; recheck billing before shutdown.

## Not completed / release gates

- A clean-environment startup timing and final supervisor-reset rehearsal were not run. The existing local fixture database was not reset; do not infer that the load-test rows were removed.
- Hosted login/logout, readiness, report access and unauthenticated protection passed, but the complete six-minute operational walkthrough and reset-protection rehearsal remain outstanding.
- By 2026-10-09 23:59 America/Bogota, stop Railway services, pause Supabase, verify the public endpoint is unavailable, check final billing/usage, and record the shutdown. Preserve the project and synthetic rows.

The local application remains the source of truth. Do not archive this OpenSpec change until remaining rehearsals and the scheduled shutdown are complete or explicitly descoped by the user, and final verification is updated.
