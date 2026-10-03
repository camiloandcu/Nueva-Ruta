## Why

WI-002 established immutable raw partner rows and synthetic dirty fixtures, while WI-005 established authorized transfer evidence. The system still cannot import partner CSV files, reproducibly normalize their fields, or reconcile reported enrollments to Nueva Ruta leads. Without that layer, attribution and the non-monetary commission proxy cannot distinguish supported links from ambiguity or conflict.

## What Changes

- Add an authenticated CSV import flow that records each file and row with checksums and immutable source values; repeated submission of the same file is idempotent.
- Add deterministic, versioned normalization for phone numbers, dates/timestamps, creator IDs and duplicate groups, retaining raw provenance and emitting structured quality issues rather than repairing source values.
- Add canonical enrollment candidates and conservative reconciliation: exact shared external ID first, then unique exact normalized phone with compatible evidence; contradiction, ambiguity and unmatched cases remain unresolved for review.
- Add an auditable analyst review queue with accept, reject and link decisions, reason, actor, timestamp, candidate evidence and references to both raw sources.
- Add only a non-monetary potentially-commissionable eligibility proxy for conflict-free reconciled enrollments; do not calculate payments.
- Add a local n8n import trigger that calls documented FastAPI contracts. FastAPI remains the only business-data API and database migrations remain the schema authority.
- Add focused import, cleaning, provenance, idempotency, matching, permission, audit and UI verification using the deliberate dirty fixtures.

## Capabilities

### New Capabilities

- `partner-import-reconciliation`: immutable partner CSV import, deterministic normalization and quality issues, duplicate grouping, canonical enrollment candidates, evidence-based reconciliation and human review.

### Modified Capabilities

- `domain-data-baseline`: extend the existing immutable raw partner provenance into normalized, canonical and reconciliation layers without changing existing lead or raw-row authority.
- `synthetic-demo-reset`: reset and seed deterministic partner import, quality, reconciliation and review scenarios, including deliberate dirty cases.

## Impact

- Affected areas: Supabase migrations and synthetic reset/fixtures; FastAPI import, normalization, reconciliation and review contracts; Next.js import/reconciliation screens; n8n workflow exports; tests and WI-006 implementation evidence.
- Data: additive normalized-row, quality-issue, canonical-candidate, reconciliation-candidate and review-decision records linked to immutable import jobs/raw rows, leads and transfer evidence.
- Authority: Nueva Ruta remains authoritative for original lead origin and creator attribution; Consejería Clara remains authoritative for reported enrollment; reconciliation stores evidence and human decisions but never overwrites either source.
- External effects: CSV handling and orchestration remain local and synthetic. No partner API, real consumer data or hosted service is introduced.

## Acceptance criteria

- An authorized operator can upload a CSV; the import records file and row checksums, row number and original values. Re-importing the same file is idempotent, and the raw file/rows cannot be updated or deleted through application paths.
- Normalization is deterministic and versioned, preserves every raw value, and emits documented quality issues for invalid/missing/future/ambiguous dates, invalid or absent creator IDs, phone defects and duplicates.
- Duplicate rows and conflicting business IDs are grouped or flagged without deleting occurrences or applying last-write-wins.
- Reconciliation first uses an exact unique shared external ID when present. Otherwise it auto-links only a unique exact normalized phone with compatible evidence. A contradictory creator ID, ambiguous candidate set, phone conflict or unmatched enrollment is not commission-safe and requires review or remains unmatched.
- Analyst accept/reject/link actions require a reason and persist actor, timestamp, decision, automatic evidence and references to both sides' raw provenance. Unauthorized roles cannot change reconciliation decisions.
- A reconciliation decision and canonical enrollment can be traced to the source file and row(s), original lead attribution, matching evidence, normalization version and reviewer decision where applicable.
- `potentially_commissionable` is a non-monetary derived proxy that includes only conflict-free reconciled enrollments; it never changes creator attribution or computes a payment amount.
- n8n orchestrates the import through FastAPI only; it does not read or mutate business tables directly. The UI exposes import status, quality issues and the human review path.
- Golden fixtures cover every deliberate dirty case and assert expected normalization, duplicate grouping, match classification, review requirement and proxy eligibility.

## Verification

- Golden normalization and reconciliation tests for every deliberate dirty fixture, including rerun determinism and contradictory creator evidence.
- Database tests for raw immutability, provenance foreign keys, idempotent file/row imports, duplicate preservation, role enforcement and atomic audited review decisions.
- FastAPI contract tests for upload validation, import status, quality issues, reconciliation evidence and authorized review commands.
- n8n/API contract tests and Next.js tests for upload, issue visibility and review outcomes.
- Run focused application/database checks and strict OpenSpec validation; record results in `docs/implementation/06_WI-006_VERIFICATION.md`.

## Out of scope

- Fuzzy or approximate automatic phone matching; one-digit differences may only be surfaced as review hints.
- Monetary commission calculation, payment decisions or changes to creator attribution.
- Aggregate funnel/stalled-work dashboards beyond import and reconciliation review screens (WI-007).
- Production partner connectivity, real consumer data, cloud upload storage or hosted services.
