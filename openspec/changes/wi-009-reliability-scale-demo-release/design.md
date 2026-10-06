## Context

The accepted project plan defines WI-009 as release hardening, reproducibility, a 200-event evidence run, complete documentation, n8n workflow export/import, a six-minute demo path, and a final reset rehearsal. Local Supabase CLI + Compose remains authoritative. The Product Owner has approved temporary Railway + Supabase Cloud hosting, no more than USD 7 total spend, and demo end date Friday, October 9, 2026.

The repo already contains individual Dockerfiles for Next.js, FastAPI, and the simulator, plus a Compose service for n8n. There are separate local quality, health, reset, and database-test commands. The README still describes an earlier scope. The approved budget, password-protection and shutdown constraints rule out treating a hosted URL as a production service.

## Goals / Non-Goals

**Goals**

- Make local startup, system readiness, reset, and quality evidence reproducible by a reviewer.
- Record a bounded, synthetic performance result with honest environmental limitations.
- Make the README and supporting documentation reflect the current product, local lifecycle, hosted demo boundary, and six-minute story.
- Use the connected Railway and Supabase integrations for setup/verification only after this proposal is approved.
- Ensure the short-lived hosted instance remains authenticated, synthetic-only, secret-safe, below the approved spend cap, and shut down on time.

**Non-Goals**

- Add new customer-facing workflows or claim production readiness.
- Replace Supabase Auth/PostgreSQL with a generic Railway database.
- Expose API docs, n8n, simulator, database, or admin interfaces publicly.
- Make an OpenAI request or use real campaign/consumer data.
- Delete the hosted Supabase project or its data at shutdown; pause it and stop running Railway services.

## Decisions

### Local stack stays the source of truth

Use the existing local Supabase CLI + Docker Compose lifecycle and migration/seed path. WI-009 closes documentation and verification gaps rather than inventing a second local setup. Run checks from a clean supported environment and record exact times and any environmental limitation; do not assert the 15-minute goal if the rehearsal disproves it.

### Load test uses synthetic events and deterministic behavior

Submit at least 200 unique synthetic inbound events through the documented API path, then replay a defined subset to measure duplicate effects. Keep the deterministic provider path enabled so results are reproducible and no AI usage charge is incurred. Capture accepted/rejected counts, throughput, p50/p95 request latency, backlog drain, losses and duplicate side effects. Record hardware/runtime, concurrency, seed/reset state, provider mode and test command. Clearly state that the result is a local synthetic measurement, not production capacity or live-model performance.

### Railway + Supabase Cloud is the approved temporary hosting topology

Create one Railway project from the approved repository and configure separate Docker-backed services for `web`, `api`, `n8n`, and `simulator`. Only `web` receives a public domain; API, n8n and simulator use Railway private networking. Attach persistent storage only where n8n requires it. Use Railway variables marked secret for backend/service credentials; never put values in source, build arguments, logs, or workflow exports.

Create or use one Supabase Cloud project under the connected account for Auth and PostgreSQL. Apply only the tracked Supabase migrations and synthetic seed data; configure the hosted site URL and allowed Auth redirect URLs for the Railway web origin. No local production/customer data is copied. Preserve the existing FastAPI-only business-data boundary.

Before provisioning, inspect the connected billing/account state and estimate the full configuration through the shutdown date. Keep projected and actual combined charges at or below USD 7. If the minimum plan, storage, or usage makes that impossible or cannot be bounded, stop before resource creation and report the blocker. Do not enable live AI or upgrade plans.

### Authentication is the demo password gate

Keep the application login as the public entry point and use only dedicated, synthetic demo accounts with strong unique passwords. Do not enable public sign-up. The operator, supervisor and analyst roles remain protected by FastAPI, not merely hidden UI controls. Keep all credentials in managed secrets and provide demo credentials only through an approved private handoff, never in the repository or public docs.

### Expire, stop, and pause without deleting evidence

Treat the demo as expiring at 23:59 America/Bogota on 2026-10-09. By then, stop the Railway application services and pause the hosted Supabase project; verify public endpoints no longer serve the demo and no additional hosted compute is running. Preserve hosted records rather than deleting the project. Document that a paused resource or provider account subscription may have billing semantics outside compute and verify the account’s billing state; never exceed the approved total.

### Keep workflow exports portable and secret-free

Export/import the current n8n workflows as tracked JSON under the existing workflow directory. Validate each export and import into a clean local n8n instance; use environment/credential references instead of embedding tokens or webhook secrets. Keep hosted credentials outside these files.

### Demo collateral is evidence, not a new product feature

Update README as a recruiter-facing product page with current workflows, diagram, quickstart, demo roles, constraints, and links to detailed docs. Add concise architecture/operations, decisions, compliance, partner-data cleaning, AI-use and scale reports under `/docs/`. Provide a Spanish-first timed narration, reset/preconditions, click path, transitions and a recording checklist capped at six minutes; do not fabricate a recorded performance or hosted feature.

## Risks / Trade-offs

- Clean startup time depends on Docker resources and image-cache state; report the observed condition rather than guarantee a universal time.
- A synthetic load test on a developer machine provides limited external validity; disclose test conditions and avoid extrapolating beyond the sample.
- Temporary cloud service limits, Railway billing minimums, persistent volumes and Supabase plan state can make USD 7 infeasible. Cost enforcement takes priority over deployment.
- Password-gated demo credentials could be shared; use synthetic-only data, least exposure and the firm shutdown date.
- Pausing Supabase does not delete stored synthetic rows. The user explicitly approved end date/shutdown, not deletion; preserve project data.
- The local and hosted environments can drift. Only tracked migrations and seeds may initialize the cloud demo, and local remains authoritative.

## Migration / Rollout

1. After proposal approval, create a short-lived WI-009 branch and complete code/docs/local verification first.
2. Read Railway/Supabase account state without exposing identifiers or keys; confirm a cost path within the approved ceiling before provisioning.
3. Provision the minimum hosted services, apply tracked migrations/seeds, set auth redirects/secrets, and validate login/readiness and protected role flows.
4. Run no live consumer or AI traffic; link the temporary URL only from private demo instructions if needed.
5. Stop Railway services and pause Supabase by 2026-10-09; verify no running service and record the state in the final verification report.

## Open Questions / Assumptions

- Assumption: the end date means 23:59 in the user's configured America/Bogota timezone.
- Assumption: password protection means the existing Supabase-backed login with private seeded synthetic role accounts, not public anonymous access or an additional HTTP Basic Auth layer.
- Hosting is conditional on actual billing checks; the approved USD 7 is a hard ceiling, not a target or authorization to overrun.
