## Context

WI-002 established authenticated application roles, audit records and deterministic synthetic data. Later lead, CRM and delivery work requires policy decisions to reference an exact version, but the repository has no rule model or lifecycle yet. ADR-009 fixes the initial fictional thresholds and coverage, while ADR-010 establishes YAML as the reproducible seed format and the database as the runtime authority.

WI-003 must deliver both governance and deterministic compliance validation without processing leads or sending messages. FastAPI remains the exclusive business boundary, Supabase migrations remain the schema authority, and Next.js may provide a review interface without duplicating validation logic.

## Goals / Non-Goals

**Goals:**

- Define one explicit, typed rule document that covers all policy categories reserved for WI-003.
- Seed reproducible YAML, import it as a database draft and export normalized database content back to YAML.
- Validate rule structure and cross-field invariants centrally in FastAPI.
- Show reviewers a stable human-readable diff before supervisor publication.
- Publish immutable, content-addressed versions with full lineage and audit evidence.
- Support rollback only as a newly published version derived from prior content.
- Expose deterministic compliance evaluation independently of future lead-processing workflows.

**Non-Goals:**

- Classifying or pre-qualifying actual lead records.
- Applying state transitions, retry schedules or SLAs to operational entities.
- Sending automatic or human-approved messages.
- AI-assisted drafting, classification or compliance review.
- Partner transfer, reconciliation or reporting behavior.

## Decisions

### 1. Use one versioned rule document with explicit sections

The normalized document will contain schema metadata plus sections for classification triggers, debt policy, state coverage, operating schedule, SLA, retry settings, stage transitions, automatic templates, feature flags and compliance controls. Pydantic models in the FastAPI domain layer will own structural and cross-field validation. The document will reject unknown fields so misspelled policy does not silently disappear.

**Alternative considered:** Independent uncoordinated tables for each policy family were rejected because a publication could expose a mixture of partially updated rules and make exact decision provenance ambiguous.

### 2. Canonicalize before diffing, hashing or publishing

YAML is an interchange format, not the equality model. Imports will parse into typed models and serialize to canonical JSON-compatible content with stable key ordering and normalized scalar representations. The system will compute a SHA-256 content hash from that canonical form. Diffs and duplicate detection will compare normalized documents, while exports will emit deterministic YAML.

**Alternative considered:** Hashing raw YAML was rejected because comments, key order and formatting could produce different hashes for the same policy.

### 3. Separate editable drafts from immutable published versions

Drafts may be created from YAML, the active version or any historical version and may be replaced while still drafts. Publication will transactionally validate current content, verify supervisor authorization, allocate the next monotonic version, persist immutable normalized content/hash/lineage, activate it and create an audit event. Database triggers will reject updates or deletes of published versions.

**Alternative considered:** A status flag on a mutable row was rejected because later edits could silently change the policy referenced by historical decisions.

### 4. Make rollback a normal derived publication

Rollback selects an earlier published version as the source of a new draft, exposes the diff against the current active version and publishes a new version with `derived_from_version_id` and rollback intent. It never reactivates or rewrites the old row in place.

**Alternative considered:** Moving the active pointer directly to an old version was rejected because it hides the rollback event and breaks a monotonic history.

### 5. Keep every protected rule operation behind FastAPI

FastAPI will expose query, import, validate, diff, export, publish and rollback-draft contracts. Operators and supervisors may inspect, import and validate drafts; only supervisors may publish. Next.js route handlers will forward the server-side Supabase session to these APIs and will not write rule tables directly.

**Alternative considered:** Direct Supabase writes from the UI were rejected because they would bypass authorization, canonicalization, cross-field validation and audit boundaries.

### 6. Treat compliance checks as deterministic policy evaluation

The compliance module will return stable violation codes, severity and safe explanations for required `consejero` terminology, unconditional savings/payment claims, prohibited numeric promises/figures, unsafe automatic templates and non-allowlisted automatic purposes. Fixed automatic template bodies must be explicitly versioned in the rule document and must not contain placeholders that personalize substantive claims.

**Alternative considered:** Free-form reviewer judgment or AI-only checking was rejected because publication safety must be reproducible and available without an AI key.

### 7. Seed policy through YAML but activate through the governed path

The repository will contain one clearly fictional default YAML document. Database reset will create or import its initial published version deterministically with stable content and hash, while subsequent YAML changes enter as drafts and require normal supervisor publication. The seed path will be isolated from ordinary runtime permissions.

**Alternative considered:** Reading YAML directly on every request was rejected because runtime policy would depend on filesystem deployment and lack database history.

## Risks / Trade-offs

- **[One document may become large as later rules grow]** → Keep explicit cohesive sections and add schema versions/migrations rather than premature table fragmentation.
- **[Canonicalization changes could alter hashes]** → Version the document schema and canonicalization contract; include golden round-trip and hash tests.
- **[Regex-based compliance controls can overmatch Spanish text]** → Use named deterministic patterns with fixture-based positive/negative tests and expose reasons for human review.
- **[Draft replacement can obscure editing history]** → Audit imports and material draft updates while reserving immutable guarantees for published versions.
- **[Seed publication bypass could be reused at runtime]** → Restrict it to migration/reset context and revoke direct execution from ordinary authenticated roles.
- **[UI and API validation can drift]** → Treat API results as authoritative; UI only renders typed issues and diffs returned by FastAPI.

## Migration Plan

1. Add typed rule models, canonicalization, validation, diff and compliance services with focused unit tests.
2. Add the Supabase migration for drafts, immutable versions, active-version state and publication audit/lineage constraints.
3. Add the approved fictional YAML seed and deterministic initial publication path.
4. Add protected FastAPI query/import/validate/diff/export/publish/rollback-draft endpoints and authorization tests.
5. Add the minimal Next.js rule history, editor/import, validation, diff and publish review interface.
6. Verify migration/reset, YAML round trip, stable hashes, immutable publication, rollback lineage and UI/API integration.

Rollback before later work items is a migration/application revert followed by a reset of the local synthetic database. Published versions must never be deleted from a running environment merely to represent business rollback.

## Open Questions

None block proposal review. Exact UI component structure and YAML library version will be selected during implementation without changing the approved lifecycle or policy semantics.
