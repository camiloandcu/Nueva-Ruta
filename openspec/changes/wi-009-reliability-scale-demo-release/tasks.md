## 1. Runtime and log hardening

- [x] 1.1 Review existing health/readiness checks and add missing safe diagnostics for the current service graph; API and simulator request metadata now share safe correlation behavior.
- [x] 1.2 Standardize correlation IDs and structured redacted logs across API and simulator boundaries without logging query strings, request bodies, headers, or path IDs; tracked n8n workflows propagate correlation IDs through FastAPI and the simulator boundary.
- [x] 1.3 Add regression checks for secret/PII leakage in request logs and document service-level readiness behavior.

## 2. Reproducible quality and scale evidence

- [x] 2.1 Audit the aggregate quality, migration, database, OpenSpec and repository-boundary commands; close gaps without adding product behavior. (Aggregate quality, web build, repository boundary, strict change validation and local Supabase database tests pass.)
- [x] 2.2 Implement or refine a deterministic synthetic load harness for at least 200 inbound events and controlled replay.
- [x] 2.3 Record throughput, p50/p95, result-visibility time, losses, duplicates and run conditions in a scale report; async backlog is documented as not applicable because ingestion is synchronous.
- [ ] 2.4 Perform a clean-environment startup timing and final supervisor-reset rehearsal; record outcomes and caveats.

## 3. Documentation and portable workflows

- [x] 3.1 Refresh README as the current product overview with architecture, safe synthetic demo status, setup, roles, boundaries and links.
- [x] 3.2 Complete and internally link architecture/operations, decision, compliance, partner-data cleaning, AI-use, and scale documents.
- [x] 3.3 Validate credential-free n8n exports/imports from a clean disposable local instance; added missing stable workflow IDs and removed colliding shared tag metadata.
- [x] 3.4 Add a six-minute Spanish-first demo script and recording checklist covering the approved end-to-end story.

## 4. Temporary Railway + Supabase Cloud demo

- [ ] 4.1 Inspect current provider plan/account state and calculate projected total; stop before provisioning if USD 7 cannot be guaranteed. (User confirmed a 30-day USD 5 Railway trial. CLI showed USD 0 current usage/bill, but the plan is not exposed and the minimum compute hard limit is USD 10, so the USD 7 cap cannot be mechanically enforced.)
- [ ] 4.2 Provision the minimum Railway web/API/n8n/simulator services and one Supabase Cloud project using managed secrets and tracked SQL migrations/seeds only. (Private Railway project and Supabase project created; no services deployed. Supabase is paused pending secure CLI access to the required service-role key.)
- [ ] 4.3 Configure private service networking, application login/redirects, synthetic demo accounts, health checks and no public API/n8n/simulator endpoints.
- [ ] 4.4 Verify hosted login, core demo flows, reset protections, secret boundaries and running cost while preserving the local stack as the source of truth.
- [ ] 4.5 By 2026-10-09 (America/Bogota), stop Railway services, pause Supabase, verify public access is unavailable and record shutdown/cost state without deleting data.

## 5. Final verification and archive

- [x] 5.1 Run full quality/build/database/migration/repository/OpenSpec validation after local release changes. Local quality, production build, 198 database assertions, repository checks and strict OpenSpec validation pass; hosted checks remain blocked by the cost gate.
- [x] 5.2 Record local checks and measured load results, plus outstanding startup/reset/hosting gates, in `docs/implementation/09_WI-009_VERIFICATION.md`.
- [ ] 5.3 Archive WI-009 and synchronize its specifications after implementation verification.
