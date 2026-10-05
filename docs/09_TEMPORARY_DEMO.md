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

Before creating resources, record read-only provider account/plan state, project cost preview, chosen organization/workspace, projected compute/storage/network charges, and expected duration. If anything needed to establish the total is unknown or the ceiling cannot be enforced, stop before provisioning and report the blocker. Do not infer that a free tier means zero total cost without checking account billing state.

## Actual resource ledger

| Provider/resource | Identifier (private ops only) | State | Cost evidence | Last checked |
| --- | --- | --- | --- | --- |
| Railway project/services | Pending cost gate | Not provisioned | Account plan/usage unavailable through connected Railway tools; no resource cost forecast yet | 2026-10-04 |
| Supabase Cloud project | Pending estimate acknowledgement | Not provisioned | Connected organization quote: USD 0/month for project creation; usage/organization billing not included | 2026-10-04 |

Do not place service keys, operator passwords, or full secret values in this ledger. Record only non-secret identifiers and redacted amounts/statuses in private implementation notes.

## Expiry runbook

By 2026-10-09 23:59 America/Bogota:

1. Stop all Railway application services and confirm they have no running replicas/deployments.
2. Pause the Supabase Cloud project; preserve the project and synthetic rows.
3. Verify the public web endpoint is unavailable and private API/n8n/simulator have no public domains.
4. Check provider billing/usage state and note any subscription charge outside compute that remains the account owner's responsibility.
5. Update the WI-009 verification report with shutdown timestamps and final cost evidence. Never delete the cloud project as a substitute for pausing it.

## Current state

At the time this document was added, provider integrations were connected and read-only checks found no existing Railway project and no existing Supabase project. Project creation remains on hold until Railway's current plan/usage and the full forecast are known and the Supabase USD 0/month quote is acknowledged. No cloud resource has been created.
