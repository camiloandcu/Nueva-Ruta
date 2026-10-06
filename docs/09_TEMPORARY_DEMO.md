# Temporary Hosted Demo Operations

Status: hosted demo is active for the approved temporary window and must be shut down by 2026-10-09 23:59 America/Bogota. Local Supabase + Compose remains authoritative.

## Hard constraints

- Provider topology: Railway application services and Supabase Cloud Auth/Postgres.
- Spend cap: USD 7 total through shutdown; no overage, plan upgrade or unbounded billing path.
- End: 2026-10-09 23:59 America/Bogota.
- Public surface: authenticated Next.js web only. API, n8n, simulator and database remain private.
- Data/AI: synthetic fixtures only, no live OpenAI requests, no customer/campaign data.
- Secrets: managed provider variables, never source, logs, n8n exports, Docker build args or public docs.
- End action: stop Railway services; pause Supabase; verify public service is unavailable; keep the synthetic database/project rather than deleting it.

## Provisioning gate

For this demo the user explicitly directed us to proceed on the 30-day USD 5 trial within a USD 7 total ceiling. Railway does not expose a hard limit at that amount (minimum USD 10); the exception is documented and requires ongoing usage checks. Do not upgrade, incur overage, or continue if the USD 7 allowance is at risk. Do not infer that a free tier means zero total cost.

## Actual resource ledger

| Provider/resource        | Identifier (private ops only)                        | State                 | Cost evidence                                                                                                                                                                | Last checked |
| ------------------------ | ---------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Railway project/services | Private project `Influgain WI-009 Demo`, environment `demo` | Four app services deployed; web is the only public entrypoint | Last readable CLI snapshot: USD 0.0006 current usage/current bill; USD 0.0003 estimated. Account is on user-confirmed USD 5 / 30-day trial. No hard limit; minimum is USD 10, so the USD 7 ceiling cannot be mechanically enforced. CLI refresh later failed because OAuth token persistence is blocked by the read-only home directory. | 2026-10-05 |
| Supabase Cloud project   | `influgain-wi009-demo`, `sa-east-1`                  | Active, migrations and synthetic baseline applied | Organization project-creation quote was USD 0/month. Verify current billing again before shutdown. | 2026-10-05 |

Do not place service keys, operator passwords, or full secret values in this ledger. Record only non-secret identifiers and redacted amounts/statuses in private implementation notes.

## Expiry runbook

By 2026-10-09 23:59 America/Bogota:

1. Stop all Railway application services and confirm they have no running replicas/deployments.
2. Pause the Supabase Cloud project; preserve the project and synthetic rows.
3. Verify the public web endpoint is unavailable and private API/n8n/simulator have no public domains.
4. Check provider billing/usage state and note any subscription charge outside compute that remains the account owner's responsibility.
5. Update the WI-009 verification report with shutdown timestamps and final cost evidence. Never delete the cloud project as a substitute for pausing it.

## Current state

The user confirmed the Railway workspace has a 30-day USD 5 trial and asked us to proceed within a USD 7 ceiling. The Railway project has four services (`web`, `api`, `simulator`, `n8n`) with small limits, one replica each and serverless sleep enabled. Only `https://web-demo-ffe2.up.railway.app` is public; the other services use private networking. The Supabase Cloud project is active in `sa-east-1`, with tracked migrations and a synthetic fixture baseline. Public signup is disabled, Auth redirects are restricted to the web domain, and three synthetic role accounts are available for private handoff. No production/customer data is configured. On October 6, the web and API were deployed from commit `db5ab69`; hosted Playwright confirmed that the navigation recovers from transient API wake-up errors, and one synthetic ingestion confirmed `ai_attempt_status=succeeded` with the configured OpenAI provider. The supervisor reset then restored the baseline; the test event was absent afterward. The reset fix is recorded in `20261006150000_hosted_reset_safeupdate.sql`. The exact USD 7 ceiling is not enforceable as a provider hard limit; the last CLI usage snapshot was only USD 0.0006 on October 5, so current spend still requires checking. By October 9, 2026, stop Railway services, pause Supabase, verify public unavailability, and record final usage without deleting the project/data.
