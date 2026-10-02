## Context

WI-001 provides a healthy local Supabase, Next.js, FastAPI, n8n and simulator foundation, but deliberately contains no business schema or roles. WI-002 must create the durable persistence and authorization baseline required by later work while keeping all bundled records fictional and resettable. Supabase SQL migrations remain the sole schema authority, Supabase Auth owns identity, and FastAPI remains the exclusive business-data boundary for Next.js and n8n.

The approved planning set fixes the fixture volumes and coverage: five creator profiles, 48 lead fixtures, 30 dirty partner rows and ten content sources. It also requires three application roles, deterministic reset, analyst message restrictions, explicit synthetic labels and reserved-looking `555-01xx` phone values.

## Goals / Non-Goals

**Goals:**

- Introduce constrained relational tables for the minimum domain and fixture provenance needed by WI-002.
- Verify Supabase access tokens in FastAPI and map authenticated identities to explicit application roles.
- Expose role-filtered FastAPI contracts sufficient to prove operator, supervisor and analyst boundaries.
- Seed a deterministic synthetic baseline whose counts, identifiers, defect categories and relative-age states are testable.
- Restore that baseline through an explicit supervisor-only confirmed command with durable audit evidence.

**Non-Goals:**

- Lead classification, pre-qualification, policy rules, drafts, dispositions or external delivery.
- Partner-row normalization, canonicalization, reconciliation or reporting metrics.
- Content ranking or script generation.
- Hosted Supabase, third-party identity providers, enterprise SSO or production-grade consumer-data certification.
- Direct business-table access from Next.js or n8n.

## Decisions

### 1. Keep schema and baseline data in the Supabase migration/seed lifecycle

Business tables, enums, indexes, foreign keys and database invariants will be added through ordered SQL migrations. Deterministic fixture rows will live in the Supabase seed path and use stable business IDs. Reset will rebuild migrations and seed data through the existing wrapper rather than introduce Alembic or an application-owned parallel schema history.

**Alternative considered:** ORM-created tables and Python fixture factories were rejected as the authoritative path because they would split schema ownership and make clean reset behavior harder to inspect.

### 2. Model identity and application authorization separately

Supabase Auth will authenticate seeded local identities. A domain `app_users` record keyed to `auth.users.id` will assign exactly one initial role: `operator`, `supervisor` or `analyst`. FastAPI will validate bearer tokens against the local Supabase issuer/JWKS or supported Auth verification endpoint, load the application role server-side and apply authorization in dependencies/services rather than trusting client claims or navigation state.

**Alternative considered:** Storing only a mutable role claim in browser-visible metadata was rejected because it weakens the server-side authorization boundary and complicates auditing role changes.

### 3. Use explicit domain entities and immutable provenance

The schema will keep creator, lead, message, consent and audit concerns separate. Partner fixture rows will be stored as immutable raw import records linked to an import job, filename, row number and checksums. Content sources remain their own fictional source records. Fields needed only by later normalization, reconciliation or reporting behavior are deferred unless required to preserve raw fixture evidence.

**Alternative considered:** One denormalized fixture table was rejected because it obscures ownership, constraint testing and later provenance requirements.

### 4. Enforce analyst minimization through dedicated API representations

Operator and supervisor contracts may expose synthetic message details needed to prove the workflow baseline. Analyst contracts will return only identifiers, attribution dimensions, safe status/timestamps and redacted or omitted message fields. Authorization tests will exercise the FastAPI response boundary; UI hiding alone is insufficient.

**Alternative considered:** Returning full records and hiding message content in Next.js was rejected because an analyst could still call the API directly.

### 5. Make fixtures deterministic from a fixed reference instant

Stable UUIDs/business IDs and a fixed seed reference instant will make repeated resets byte-for-byte stable where absolute values matter. Fixtures that represent relative age will derive their timestamps from that declared reference instant, so expected within-SLA, approaching-SLA and stale categories remain reproducible. Tests will assert counts, category coverage, uniqueness and repeatability.

**Alternative considered:** Seeding from wall-clock `now()` was rejected because identical resets would produce drifting evidence and brittle tests.

### 6. Treat reset as an audited application command

The developer lifecycle may rebuild the database, but the product reset contract will require an authenticated supervisor, an exact confirmation value and a transaction that restores baseline business rows. The audit record will capture actor, timestamp, reason/correlation data and reset outcome without storing secrets or unredacted sensitive text. Unauthorized or incorrectly confirmed requests will leave business data unchanged.

**Alternative considered:** Exposing an unrestricted seed endpoint or relying only on the shell command was rejected because it would not prove the required product authorization and audit behavior.

## Risks / Trade-offs

- **[Seeded credentials can be mistaken for production credentials]** → Keep values local-only, source passwords from ignored environment configuration and label the accounts as demo identities.
- **[Reset can erase reviewer-created demo state]** → Require supervisor authorization and exact confirmation, scope deletion to known synthetic business tables and record the operation.
- **[JWT verification can couple tests to a running Auth service]** → Separate token-verification integration tests from authorization service unit tests and keep issuer/audience settings explicit.
- **[Fixture matrices can overlap and obscure coverage]** → Store declared fixture tags or maintain a machine-readable manifest so tests report every required category and expected count.
- **[Raw partner defects can violate domain constraints]** → Preserve raw strings in provenance tables; apply strict constraints only to canonical domain fields, leaving normalization for WI-006.
- **[A broad schema can pre-design later workflows]** → Add only fields required by approved WI-002 requirements and fixture evidence; defer rule, decision, reconciliation and reporting tables.

## Migration Plan

1. Add the core domain migration with enums, tables, constraints, indexes and least-privilege database grants.
2. Add stable synthetic seed assets and local Auth identity bootstrap using ignored environment credentials.
3. Add FastAPI token verification, role lookup and role-filtered read/reset contracts.
4. Extend the local wrapper with seed/reset operations that fail closed and preserve actionable diagnostics.
5. Add constraint, authorization, fixture-integrity and repeatability tests plus a generated coverage report.
6. Verify two consecutive resets against the same expected baseline and document the local demo identities and synthetic-data conventions.

Rollback before later work items is a database reset after reverting the WI-002 migration and application commits. No hosted or production data is involved.

## Open Questions

None block proposal review. Exact library choices for JWT verification and PostgreSQL access will be selected during implementation from actively supported versions compatible with the pinned Python runtime, without changing the approved boundaries.
