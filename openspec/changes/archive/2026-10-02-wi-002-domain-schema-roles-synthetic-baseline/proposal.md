## Why

Later lead, partner, reporting and content workflows need a stable domain model, enforceable application roles and a repeatable fictional dataset. WI-002 establishes that source of truth without introducing classification, reconciliation or reporting behavior prematurely.

## What Changes

- Add the authoritative Supabase SQL schema and constraints for application users, creators, leads, messages, consent evidence, audit events, content sources and partner-import provenance needed by the baseline fixtures.
- Seed password-protected local identities and application roles for operator, supervisor and Influgain analyst, then enforce those roles at the FastAPI boundary.
- Restrict the analyst to the minimum attribution and aggregate-ready data surface, excluding unredacted message content.
- Add five complete fictional creator profiles, 48 lead/message fixtures, 30 deliberately dirty partner rows and ten fictional content sources.
- Make seed generation deterministic for business identifiers and reference-relative timestamps while preserving the required fixture coverage matrix.
- Add a confirmation-protected, supervisor-only reset that restores the baseline and records an audit event.
- Label all bundled data as synthetic and document the reserved-looking `555-01xx` phone convention.
- Exclude lead classification, policy publication, partner normalization/reconciliation, dashboards and content generation.

## Capabilities

### New Capabilities

- `domain-data-baseline`: Core domain persistence and a deterministic, coverage-tested synthetic dataset with immutable import provenance.
- `application-role-access`: Supabase identity verification and FastAPI authorization for operator, supervisor and analyst data boundaries.
- `synthetic-demo-reset`: A supervisor-confirmed reset that restores the synthetic baseline and audits the action.

### Modified Capabilities

None.

## Impact

- Affected areas: Supabase migrations and seed data, FastAPI identity/authorization and domain query contracts, Next.js server-side session integration, local reset commands, tests and fixture documentation.
- Data model: introduces the first business-domain tables under the existing Supabase-only migration authority.
- Authentication: extends the WI-001 Auth session proof with seeded local identities and application roles; no external identity provider is added.
- Dependencies: may add a focused Python JWT/PostgreSQL client only if required by the approved implementation; no hosted service or paid account is introduced.

