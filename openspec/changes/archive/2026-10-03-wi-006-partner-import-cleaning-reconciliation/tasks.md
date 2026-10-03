## 1. Persistence and Import

- [x] 1.1 Add migration for import idempotency metadata, versioned normalized rows, quality issues, duplicate groups, canonical candidates and reconciliation evidence/decisions.
- [x] 1.2 Add authorized FastAPI CSV upload and import-status contracts with structural validation, file/row checksums and atomic raw-row persistence.
- [x] 1.3 Preserve raw job/row immutability and add constraints proving every derived/canonical/reconciliation record links to source rows.
- [x] 1.4 Extend deterministic reset/fixtures to produce repeatable expected WI-006 import and reconciliation cases.

## 2. Cleaning and Reconciliation

- [x] 2.1 Implement versioned deterministic phone, date and creator-ID normalization with explicit quality issue codes.
- [x] 2.2 Implement duplicate grouping and conflicting-ID detection without deleting occurrences or last-write-wins selection.
- [x] 2.3 Implement canonical enrollment candidates and conservative matching by unique shared ID, then unique exact normalized phone plus compatible evidence.
- [x] 2.4 Implement authorized reasoned accept/reject/link review commands with append-only audit and evidence for both raw sources.
- [x] 2.5 Derive the non-monetary potentially-commissionable proxy only for conflict-free reconciled enrollments.

## 3. Orchestration and UI

- [x] 3.1 Add exported local n8n import workflow using documented FastAPI contracts only.
- [x] 3.2 Add Next.js CSV import, job status, quality issue and reconciliation review screens through the FastAPI proxy.
- [x] 3.3 Add API/UI role-boundary, upload-validation, idempotency, provenance and recovery-path tests.

## 4. Verification and Documentation

- [x] 4.1 Add golden tests for every dirty fixture, deterministic reruns, raw immutability, contradictory creator evidence and all match/review classifications.
- [x] 4.2 Add database tests for import/review atomicity, role enforcement, audit evidence and proxy eligibility.
- [x] 4.3 Run focused application and database checks plus strict OpenSpec validation; document results in `docs/implementation/06_WI-006_VERIFICATION.md`.
- [x] 4.4 After implementation approval and verification, archive WI-006 and sync the resulting specifications.
