# Temporary Hosted Demo Operations

Status: hosted demo is active for the approved temporary window and must be shut down by 2026-10-09 23:59 America/Bogota. Local Supabase + Compose remains authoritative.

## Hard constraints

- Provider topology: Railway application services and Supabase Cloud Auth/Postgres.
- Spend cap: USD 7 total through shutdown.
- End: 2026-10-09 23:59 America/Bogota.
- Public surface: authenticated Next.js web only. API, n8n, simulator and database remain private.
- Data/AI: synthetic fixtures only, no live OpenAI requests, no customer/campaign data.
- Secrets: managed provider variables, never source, logs, n8n exports, Docker build args or public docs.
- End action: stop Railway services; pause Supabase; verify public service is unavailable; keep the synthetic database/project rather than deleting it.

Railway exposes a hard limit of minimum USD 10; the exception is documented and requires ongoing usage checks. 

## Actual resource ledger

| Provider/resource        | Identifier (private ops only)                        | State                 | Cost evidence                                                                                                                                                                | Last checked |
| ------------------------ | ---------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Railway project/services | Private project `Influgain WI-009 Demo`, environment `demo` | Four app services deployed; web is the only public entrypoint | Last readable CLI snapshot: USD 0.0006 current usage/current bill;  | 2026-10-05 |
| Supabase Cloud project   | `influgain-wi009-demo`, `sa-east-1`                  | Active, migrations and synthetic baseline applied | Organization project-creation quote was USD 0/month. Verify current billing again before shutdown. | 2026-10-05 |

Do not place service keys, operator passwords, or full secret values in this ledger. Record only non-secret identifiers and redacted amounts/statuses in private implementation notes.

## Expiry runbook

By 2026-10-09 23:59 America/Bogota:

1. Stop all Railway application services and confirm they have no running replicas/deployments.
2. Pause the Supabase Cloud project; preserve the project and synthetic rows.
3. Verify the public web endpoint is unavailable and private API/n8n/simulator have no public domains.
4. Check provider billing/usage state and note any subscription charge outside compute that remains the account owner's responsibility.
5. Update the WI-009 verification report with shutdown timestamps and final cost evidence. Never delete the cloud project as a substitute for pausing it.
