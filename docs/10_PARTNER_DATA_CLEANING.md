# Partner Data Cleaning and Reconciliation

Partner files are treated as source evidence, not as a clean replacement for Nueva Ruta records. The import path preserves immutable raw rows and uses reproducible normalization to make defects visible before a person confirms a relationship.

## Pipeline

1. Upload a CSV through the UI or n8n import workflow; FastAPI validates the file contract and creates an import job.
2. Persist original row number and raw source values with job provenance and checksum. Raw records are not edited in place.
3. Normalize supported phone/date/creator fields into canonical values, retaining parse status and quality issues.
4. Group exact duplicates for review without deleting any source row.
5. Generate match candidates conservatively: exact shared identifiers first; otherwise unique normalized phone plus compatible evidence. No fuzzy phone match is automatic.
6. Send ambiguity, conflict, missing evidence and unmatched cases to analyst review. Keep accept/reject/link rationale and actor audit.
7. Count only conflict-free, approved reconciliations in the non-monetary commission proxy.

## Guardrails

- A contradictory creator identifier prevents automatic attribution.
- One phone with multiple candidate leads is ambiguous, not an invitation to guess.
- Raw partner values, normalized values, quality findings and human decisions remain separately traceable.
- Report totals include unmatched/conflicted categories; commission proxy excludes uncertain links.
- Partner data and simulator responses are synthetic in this prototype. No real partner export is authorized.

## Review evidence

See [WI-006 implementation verification](implementation/06_WI-006_VERIFICATION.md), the [partner-import workflow](../infra/n8n/workflows/README.md), and the [metric definitions](planning/05_DATA_AND_REPORTING.md). Tests include dirty values, duplicates, missing fields, incompatible creator evidence, ambiguous candidates, and analyst decision/audit behavior.
