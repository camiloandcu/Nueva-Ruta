# Synthetic Inbound Load Method and Report

## Scope

The harness submits at least 200 unique fictional inbound events through authenticated FastAPI, replays a bounded subset, and polls results until each unique source event is queryable or a 60-second result-visibility timeout is reached. Ingestion is synchronous and has no separate async queue, so async backlog drain is explicitly reported as not applicable; result-visibility time is recorded separately. It requires deterministic AI mode, uses the seeded local operator, does not print secrets, and has no external consumer or AI traffic.

Run after local identities and migrations are ready:

```bash
make load-test
```

The wrapper starts local Supabase if needed (without resetting the database or rewriting Auth identities) and creates a temporary, isolated API container with deterministic AI forced and no OpenAI key. It uses an already-bootstrapped local synthetic operator identity and removes only that temporary container when the command exits; it does not start or alter the ordinary app stack. No `.env` edit is needed. The script exits nonzero on failed requests, missing results or unresolved drain work. Each output includes the short synthetic run ID, start/end UTC timestamps, conditions, successful unique results, request errors/losses, replay count/idempotency evidence, throughput, p50/p95 observed request latency, ingest duration and result-visibility drain duration. Do not infer production capacity or extrapolate to external networks from this local result.

## Results

Measured on the local WSL2 development environment:

| Run date/time (timezone) | Runtime / host | Event count / concurrency | Provider mode | Throughput | p50 / p95 | Losses | Replay/idempotency | Drain |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-04 (exact timestamps were not emitted in this run) | WSL2 Linux x86_64; 12 reported CPUs, 3.6 GiB RAM, 1 GiB swap (full at post-run check); Docker 29.7.2; Python 3.12.12 / uv 0.12.0 | 200 / 8; 20 replay | deterministic | 14.86 unique events/s; 7.98 total requests/s including replay and drain | 474.00 / 1,138.59 ms | 0 | 20/20 replayed; 0 duplicate effects | async queue N/A; 12.173 s result visibility |

Run ID: `a0c2be4db662`. All 200 unique results became queryable; initial and replay request errors were zero; no unresolved results remained after the 60-second limit. The 220 inbound requests produced 220 latency samples.

Conditions and caveats: the API image was warm/cached. The run used the existing local Supabase fixture database without reset; the generated synthetic events remain in it. Host resource measurements were collected immediately after the run, not sampled throughout; low free memory and fully used swap make the timings machine-specific. Exact start/end timestamps were not emitted by this first run; the harness now records them for future runs. Node `24.18.0` and pnpm `11.17.0` were installed on the host but not in the API container. The target of 200 leads/hour remains a design target; this local API run does not support production capacity claims.
