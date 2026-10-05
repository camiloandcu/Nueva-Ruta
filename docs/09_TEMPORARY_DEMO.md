# Temporary Hosted Demo Operations

Status: setup is conditional on verified provider costs staying within the approved USD 7 total ceiling. Local Supabase + Compose remains authoritative.

## Hard constraints

- Provider topology: Railway application services and Supabase Cloud Auth/Postgres.
- Spend cap: USD 7 total through shutdown; no overage, plan upgrade or unbounded billing path.
- End: 2026-10-09 23:59 America/Bogota.
- Public surface: authenticated Next.js web only. API, n8n, simulator and database remain private.
- Data/AI: synthetic fixtures only, no live OpenAI requests, no customer/campaign data.
- Secrets: managed provider variables, never source, logs, n8n exports, Docker build args or public docs.
- End action: stop Railway services; pause Supabase; verify public service is unavailable; keep the synthetic database/project rather than deleting it.

## Provisioning gate

Before starting workloads or database provisioning, record read-only provider account/plan state, project cost preview, chosen organization/workspace, projected compute/storage/network charges, and expected duration. If anything needed to establish the total is unknown or the ceiling cannot be enforced, stop before billable provisioning and report the blocker. Do not infer that a free tier means zero total cost without checking account billing state.

## Actual resource ledger

| Provider/resource        | Identifier (private ops only)                        | State                 | Cost evidence                                                                                                                                                                | Last checked |
| ------------------------ | ---------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Railway project/services | Private project `Influgain WI-009 Demo`; no services | No workloads deployed | User-confirmed USD 5 / 30-day trial; CLI workspace usage and estimated bill were USD 0. Workspace hard-limit minimum is USD 10, so no strict USD 7 enforcement is available. | 2026-10-05   |
| Supabase Cloud project   | `influgain-wi009-demo`, `sa-east-1`                  | Created and paused    | Connected organization quote: USD 0/month for project creation; paused before migrations/seeds.                                                                              | 2026-10-05   |

Do not place service keys, operator passwords, or full secret values in this ledger. Record only non-secret identifiers and redacted amounts/statuses in private implementation notes.

## Expiry runbook

By 2026-10-09 23:59 America/Bogota:

1. Stop all Railway application services and confirm they have no running replicas/deployments.
2. Pause the Supabase Cloud project; preserve the project and synthetic rows.
3. Verify the public web endpoint is unavailable and private API/n8n/simulator have no public domains.
4. Check provider billing/usage state and note any subscription charge outside compute that remains the account owner's responsibility.
5. Update the WI-009 verification report with shutdown timestamps and final cost evidence. Never delete the cloud project as a substitute for pausing it.

## Current state

The user confirmed the Railway workspace has a 30-day USD 5 trial and asked us to proceed. We created a private Railway project (no services or deployments) and a Supabase project in `sa-east-1`; the Supabase project is paused. Railway has USD 0 current usage/bill and no hard limit. Its minimum compute hard limit is USD 10, so the exact USD 7 ceiling cannot be mechanically enforced. The Supabase MCP provides the publishable key but not the server-only service-role key required by FastAPI. We stopped before deploying, migrating, or seeding anything; no runtime services are running and no hosted data has been copied.
