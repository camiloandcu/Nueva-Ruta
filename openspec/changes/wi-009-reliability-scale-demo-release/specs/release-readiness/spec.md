## ADDED Requirements

### Requirement: Reproducible release readiness evidence
The repository SHALL provide linked, accurate instructions and executable checks for the current product so a reviewer can start, verify and reset the local synthetic demo without manual dashboard setup.

#### Scenario: Reviewer performs a clean start
- **WHEN** a reviewer follows the documented prerequisites and wrapper path from a clean supported environment
- **THEN** the repository reports per-service readiness, records the observed elapsed time against the under-15-minute target, and identifies any environmental caveat without exposing secrets

#### Scenario: Release verification runs
- **WHEN** the release verification command set runs
- **THEN** formatting, lint, type checks, application tests, migrations/database tests, repository-boundary checks and strict OpenSpec validation complete and their results are recorded

#### Scenario: Demo reset is rehearsed
- **WHEN** the final local demo rehearsal is prepared
- **THEN** the protected supervisor reset restores the documented synthetic baseline and leaves audit evidence without clearing unrelated history

### Requirement: Redacted correlation-ready operational evidence
Services SHALL expose health/readiness separately where applicable and write structured, redacted operational logs that allow a failure to be traced across service boundaries by correlation ID.

#### Scenario: A request fails across services
- **WHEN** a synthetic request encounters a service or provider failure
- **THEN** safe structured evidence identifies the affected service/layer and correlation ID without secrets, credentials, full phone values, raw message bodies, or hidden reasoning

#### Scenario: A secret or sensitive value is inspected
- **WHEN** repository and test log samples are scanned for known secret and sensitive-data patterns
- **THEN** no configured secret or unredacted sensitive test value is present

### Requirement: Honest synthetic load evidence
The project SHALL provide a reproducible test of at least 200 unique synthetic inbound events and document throughput, p50/p95 latency, backlog drain, losses, duplicate effects and test conditions without claiming unsupported production capacity.

#### Scenario: A deterministic load run completes
- **WHEN** the documented synthetic load command runs with deterministic provider behavior
- **THEN** it reports submitted, accepted/rejected, duplicated/replayed and lost event counts, throughput, p50/p95 latency and backlog drain with environment and concurrency details

#### Scenario: Load results are presented
- **WHEN** a reviewer reads the scale report
- **THEN** local synthetic/stub results are distinguished from hosted-provider, production or live-user performance and no unmeasured guarantee is stated

### Requirement: Portable workflow and six-minute demo collateral
The repository SHALL contain validated, credential-free n8n workflow exports and a timed demo script/recording checklist that fits within six minutes and demonstrates the approved end-to-end story.

#### Scenario: Workflow exports are imported
- **WHEN** exported workflows are loaded into a clean local n8n instance
- **THEN** they import without manual source edits and require credentials to be configured separately from tracked files

#### Scenario: Demo walkthrough is rehearsed
- **WHEN** the demo script is followed from its documented synthetic starting state
- **THEN** it fits within six minutes and demonstrates intake, a human control point, recovery/reconciliation evidence, reporting and source-linked content planning without a feature-tour detour

### Requirement: Bounded temporary hosted demo
An approved hosted demo SHALL run only on the approved Railway and Supabase Cloud topology, use synthetic data and authenticated role access, keep secrets outside the repository, remain within the explicit spend cap, and be stopped by its approved end date.

#### Scenario: Hosted demo is provisioned within budget
- **WHEN** the temporary demo is provisioned after authorization
- **THEN** only the web service is public, internal API/orchestration/simulator services use private connectivity, no live AI is enabled, and creation stops if projected or actual charges could exceed the approved USD 7 total

#### Scenario: Hosted demo reaches its end date
- **WHEN** the approved demo end date is reached
- **THEN** Railway services are stopped and the Supabase project is paused, public demo access is unavailable, and no project data is deleted without separate authorization
