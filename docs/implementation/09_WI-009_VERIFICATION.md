# WI-009 Verification Record

Status: local implementation verified; hosted demo and final clean-reset rehearsal remain open.

## Verified locally

- `pnpm quality` — passed: formatting, lint, type checks, 11 web tests, 93 Python tests, and repository boundary/secret-pattern checks. Four existing Starlette deprecation warnings remain.
- `pnpm --dir apps/web build` — production build passed.
- `pnpm exec supabase test db --local` — passed: 8 files, 198 pgTAP assertions.
- `openspec validate wi-009-reliability-scale-demo-release --strict --no-interactive` — passed.
- Disposable memory-backed n8n 2.41.3 import — all four tracked workflows imported successfully. No credentials or persistent data were mounted.
- `make load-test` — 200 deterministic synthetic inbound events plus 20 replays; 200/200 results queryable, zero request errors/losses, 20/20 replay responses marked replayed, zero duplicate effects. Initial ingest was 14.86 unique events/s, p50 474 ms, p95 1,138.59 ms. Result visibility took 12.173 s; async backlog is not applicable to this synchronous endpoint.

The load run ID was `a0c2be4db662`. It used the existing local fixture database without reset, so its synthetic rows remain there. Exact run timestamps were not emitted by that first run; the harness now records timestamps on subsequent runs. Post-run resource sampling found 12 reported CPUs, 3.6 GiB RAM, and 1 GiB swap fully used; timings are local, machine-specific observations and do not establish production capacity.

## Not completed / release gates

- A clean-environment startup timing and final supervisor-reset rehearsal were not run. The latter would require a database reset, which has not been authorized; do not infer that the existing demo fixtures were restored by the load test.
- No hosted resources have been created. The connected Supabase organization's project quote was USD 0/month, but the connected tools did not expose Railway's plan/usage or a reliable combined upper bound. Since the total must stay under USD 7, the hosting cost gate remains closed until that bound can be verified.
- Hosted login, service networking, demo flows, running-cost checks, and the October 9 shutdown remain unverified and must not be marked complete.

The local application remains the source of truth. Do not archive this OpenSpec change until the remaining accepted work is either completed or explicitly descoped by the user and final verification is updated.
