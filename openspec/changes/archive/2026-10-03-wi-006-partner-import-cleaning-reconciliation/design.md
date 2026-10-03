## Context

WI-002 already stores synthetic partner import jobs and raw rows with immutable guards. `docs/planning/05_DATA_AND_REPORTING.md` defines the 30-row dirty partner fixture, approved phone/date/duplicate policies, data layers and evidence levels. FastAPI owns business-domain reads and writes; Next.js and n8n use documented FastAPI contracts. WI-006 adds the import-to-reconciliation path without changing source authority.

## Goals and non-goals

**Goals:** accept partner CSV files safely; preserve immutable provenance; produce repeatable normalization and explicit quality issues; identify duplicates without dropping source occurrences; auto-link only on approved unambiguous evidence; support reasoned human review; expose a non-monetary eligibility proxy.

**Non-goals:** fuzzy auto-matching, payment calculation, creator-attribution repair, partner connectivity, cloud storage or aggregate reporting dashboards.

## Proposed design

### Import and orchestration

- An authenticated operator submits a CSV through the Next.js screen to a FastAPI multipart endpoint. FastAPI validates the declared schema, file encoding and structural limits before accepting it; rejected uploads leave no partial import. The exact operational limits and accepted header aliases should follow existing repository configuration where present and be documented in the implementation report.
- FastAPI computes a file checksum and stable row checksums, assigns or reuses an idempotent import identity, and inserts the immutable import job/raw rows in one transaction. Original header/value strings and row numbers are retained; source rows are never rewritten.
- A successful import emits an import-job identifier for the exported n8n workflow. n8n calls FastAPI to start/observe processing and does not access Supabase tables. Normalization and reconciliation writes remain transactions owned by FastAPI/database functions.
- Processing is repeatable: the same import and normalization version cannot create duplicate derived records. A later normalization version creates new derived evidence linked to the same raw rows rather than changing prior results.

### Normalization, quality and duplicates

- Persist a normalization version and one derived record per raw row. Preserve parsed candidates and structured issue codes alongside normalized phone, timestamp candidate and creator ID; do not replace source fields.
- Phone normalization removes presentation punctuation and recognizes explicit US `+1` and ten-digit forms. It does not infer missing digits or automatically match approximate values. A one-digit difference can be recorded as a review hint only.
- Parse only documented deterministic date formats. Store unambiguous timestamps in UTC; retain ambiguous dates as unresolved candidates. Impossible, blank and future dates receive separate issue codes.
- Creator normalization trims/normalizes the identifier representation but does not invent identities; unknown or contradictory IDs produce quality/conflict evidence.
- Group exact duplicate occurrences without deleting any raw row. A repeated business identifier with changed values is a conflict, not last-write-wins. Same phone/date under distinct partner IDs remains distinct unless review establishes a link.

### Canonical candidates and reconciliation

- Build canonical enrollment candidates from source occurrences under an explicit deterministic selection/grouping policy. Every canonical field points to source row evidence; conflicting occurrences remain visibly conflicted and no raw row is designated authoritative by arrival order.
- Apply the approved matching order: a unique exact shared external ID may link if no evidence contradicts it; otherwise, a unique exact normalized phone may link only when date/status and creator evidence are compatible. No creator ID from the partner overrides the original lead attribution.
- Store automatic candidate links, match method, evidence snapshot, normalization version, conflict flags and status (`matched`, `review_required`, `unmatched`, or equivalent constrained values). Contradictory creator IDs, multiple candidates, conflicting IDs, phone disagreement or insufficient evidence block commission-safe status.
- Analyst accept/reject/link commands require a reason and use the existing role policy. Each decision appends actor, timestamp, prior decision, selected/rejected candidates, automatic evidence and source-row references. Human decisions add reconciliation evidence; they do not rewrite raw partner values or original lead attribution.

### Proxy, APIs and UI

- Derive `potentially_commissionable` only for a uniquely reconciled enrollment with no unresolved duplicate, identity, creator or date conflict and with required source evidence. It is a count/category, not a money amount or payment authorization.
- FastAPI exposes role-protected upload/import status, issue and reconciliation queries, and review commands with stable actionable errors. API responses expose only the source details needed for review and safe provenance references.
- Next.js provides an import form, job status, data-quality issue list and reconciliation review UI. All mutations go through FastAPI; analyst permissions are enforced in API/domain logic, not only hidden controls.
- The n8n export orchestrates import processing and reports completion/failure using FastAPI. It contains no database credentials or direct table access.

## Data and migration

Add an ordered Supabase migration for versioned normalized rows, quality issues, duplicate groups, canonical enrollment candidates, reconciliation candidates/decisions and supporting audit evidence. Foreign keys must preserve links to immutable import jobs/raw rows, leads and transfer records where applicable. Add uniqueness/idempotency constraints scoped to import identity and normalization version, allowed status/match-method constraints, append-only decision evidence and role-safe RPC/service boundaries. Extend deterministic reset and fixture loading to recreate the 30 raw rows plus expected normalized/reconciliation outcomes. Do not edit existing raw provenance in place.

## Risks and mitigations

- **Ingestion rejects legitimate CSV variation:** document supported schema/header aliases and return row/column-specific errors; never silently coerce unknown columns into business fields.
- **Duplicate selection becomes implicit data loss:** preserve every occurrence and represent grouping/conflict separately; prohibit last-write-wins.
- **A strong-looking phone match hides contradictory attribution:** creator/ID conflict blocks automatic commission-safe resolution and appears in the review evidence.
- **Normalization policy changes invalidate past decisions:** version derived records and preserve prior evidence; reprocessing is idempotent within a version.
- **Human review is not reproducible:** require reason, actor, timestamp, both raw-source references and captured automatic evidence for each decision.
- **n8n bypasses domain authorization:** workflow calls FastAPI only; enforce role and transaction boundaries in the API/database.

## Review questions

1. Approve operator-only CSV upload with analyst/supervisor reconciliation decisions under the existing role policy.
2. Approve deterministic automatic links only for unique exact external IDs or unique exact normalized phones with compatible evidence; all conflicts and ambiguity require human review.
3. Approve the described local n8n orchestration boundary and the non-monetary `potentially_commissionable` proxy definition.
