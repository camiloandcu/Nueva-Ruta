## Why

WI-001–WI-008 deliver the product workflows, but the repository still needs a verified clean-start, bounded load evidence, complete release documentation, and a controlled demo environment before it is ready for evaluation. WI-009 closes those release-readiness gaps without adding product features or implying production certification.

## What Changes

- Harden service readiness and structured logs so failures can be traced by correlation ID without recording secrets, phone values, or unredacted message content.
- Run the complete regression, migration, repository-boundary, and strict OpenSpec checks; rehearse a clean local startup and final synthetic reset.
- Measure a deterministic synthetic load of at least 200 inbound events and report throughput, p50/p95 latency, backlog drain, losses, duplicates, and test conditions without overstating the result.
- Refresh the product-facing README and link the architecture, decision, compliance, partner-data cleaning, AI-use, load, and demo materials; validate n8n exports/imports without credentials.
- Add a six-minute demo script and recording checklist.
- Set up an optional temporary hosted demo using Railway for the existing Docker services and Supabase Cloud for PostgreSQL/Auth, subject to the approved USD 7 total cap; only synthetic fixtures, authenticated access, and externally stored secrets are allowed.
- End the hosted demo by 2026-10-09 (America/Bogota), stop its Railway services and pause its Supabase project, and verify no further service use is ongoing.

## Capabilities

### New Capabilities

- `release-readiness`: reproducible release evidence, bounded load reporting, reviewable demo materials, and temporary hosting safeguards.

### Modified Capabilities

- `local-runtime-foundation`: final clean-start, full-stack readiness, and current product documentation expectations.
- `ai-assistance-observability`: release-level redacted structured-log verification using correlation IDs.

## Impact

- Affected areas: existing health/readiness and logging code, quality/test and migration commands, synthetic load tooling, README and `/docs/` deliverables, exported `infra/n8n/workflows/`, and temporary Railway/Supabase Cloud configuration.
- Local Supabase CLI + Docker Compose remains the authoritative development/recovery path; cloud hosting is a short-lived demo only.
- Railway will run separate web, API, n8n, and simulator services with internal-only connectivity for services that do not serve browser traffic. Supabase Cloud will provide the hosted Auth/PostgreSQL environment.
- The default hosted AI path remains deterministic. No live OpenAI/model call is required by the load test or demo setup.
- External spend is capped at USD 7 total; if the selected account’s projected/committed charges cannot be held within that cap, do not provision or upgrade resources.

## Acceptance Criteria

- A clean supported local environment follows one documented wrapper path, and the measured startup result and any caveat are recorded against the under-15-minute target.
- Every service passes readiness checks; structured logs allow failure correlation and contain no tested secret or unredacted PII patterns.
- The full quality, migration, repository-boundary, and strict OpenSpec checks pass.
- A reproducible synthetic run processes at least 200 inbound events and reports all required performance, backlog, loss, and duplicate metrics with stub/live conditions stated.
- All included n8n workflows are valid, credential-free exports and the documented import path is tested.
- The required architecture, decisions, compliance, data-cleaning, AI-use, scale, quickstart, and timed demo documentation is present and internally linked.
- Hosted demo access requires the application’s authenticated account; only synthetic fixtures are hosted; API, n8n, and simulator are not publicly exposed; secrets do not enter Git; no deploy or model usage exceeds the USD 7 cap.
- Hosted services are stopped and the Supabase project paused no later than 2026-10-09 in America/Bogota; local delivery remains usable after shutdown.

## Verification

- Clean-environment startup rehearsal with elapsed time recorded.
- Full test/static/lint/type/migration/OpenSpec/repository-boundary commands.
- At least 200-event deterministic load test and reviewed report.
- n8n workflow export/import validation with secret-pattern scan.
- Final supervisor reset rehearsal and six-minute timed demo dry run.
- Read-only hosted health/security/cost check during the approved window and shutdown verification by the approved end date.

## Out of Scope

- Production SLA, high availability, security certification, real consumer data, or real partner/social accounts.
- Load claims beyond the measured synthetic test environment.
- Runtime AI use for the load test or demo; additional model usage charges.
- Ongoing hosting after 2026-10-09, paid plan/resource upgrades, or spend above USD 7.
- New product workflow features or destructive deletion of hosted project data.

## Review Notes

- Railway + Supabase Cloud, the USD 7 cap, and the 2026-10-09 demo end date are already explicitly approved by the Product Owner.
- The end date is interpreted as 23:59 America/Bogota; hosted service shutdown pauses the Supabase project and stops Railway services but does not delete stored project data.
- Deployment is contingent on checking the current account billing state and confirming the complete temporary setup stays under the cap; the approval does not authorize overage or an upgrade.
