# Partner Import and Reconciliation Specification

## Purpose
Define immutable partner CSV ingestion, deterministic data cleaning, evidence-based enrollment reconciliation and auditable human review for WI-006.

## ADDED Requirements

### Requirement: Immutable and idempotent partner import
The system SHALL accept authorized partner CSV imports through FastAPI, preserve the original file/row values with file and row checksums, and make repeated submission of the same import idempotent.

#### Scenario: A valid CSV is imported
- **WHEN** an authorized operator submits a structurally valid partner CSV
- **THEN** the system records an import job and every raw row with row number, original values, file checksum and row checksum in one atomic import

#### Scenario: The same CSV is submitted again
- **WHEN** a file with the same stable import identity is submitted again
- **THEN** the original import result is returned and duplicate jobs or raw rows are not created

#### Scenario: An invalid CSV is rejected
- **WHEN** a CSV has invalid encoding, required headers or malformed structure
- **THEN** the system returns actionable validation errors and creates no partial import

#### Scenario: Raw provenance is accessed after import
- **WHEN** an application path attempts to update or delete an import job or raw row
- **THEN** the mutation is rejected and the original file/row evidence remains unchanged

### Requirement: Versioned deterministic normalization
The system SHALL store normalized partner fields and quality issues as derived records linked to immutable raw rows and an explicit normalization version.

#### Scenario: A raw row is normalized
- **WHEN** the same raw row is processed with the same normalization version more than once
- **THEN** the normalized result and issue set are deterministic and are not duplicated

#### Scenario: A normalization policy is revised
- **WHEN** the system processes a raw row with a later normalization version
- **THEN** it stores new derived evidence without modifying the raw row or erasing the earlier normalized result

#### Scenario: A date or identity is defective
- **WHEN** an enrollment has a blank, impossible, future or ambiguous date, or a missing/unknown creator ID
- **THEN** the system preserves the raw value and records the corresponding explicit quality issue without inventing a canonical value

### Requirement: Conservative duplicate grouping and canonical candidates
The system SHALL group duplicate source occurrences and form traceable canonical enrollment candidates without deleting raw rows or silently selecting conflicting data.

#### Scenario: Exact duplicate occurrences are found
- **WHEN** two or more raw rows are exact duplicates
- **THEN** every occurrence remains stored and linked to one duplicate/canonical group with its frequency visible

#### Scenario: A business ID has conflicting source values
- **WHEN** rows share a partner enrollment ID but disagree on relevant values
- **THEN** the system marks a conflict for review and does not apply last-write-wins

### Requirement: Evidence-based enrollment matching
The system SHALL match partner-reported enrollments to Nueva Ruta leads by unique exact shared external ID first, then by unique exact normalized phone with compatible evidence, and SHALL preserve unmatched, ambiguous or contradictory cases for review.

#### Scenario: A unique shared external ID has compatible evidence
- **WHEN** exactly one lead and one partner enrollment share an external ID and no evidence contradicts the link
- **THEN** the system records an exact-ID match with the evidence and source provenance

#### Scenario: A unique exact phone has compatible evidence
- **WHEN** no exact-ID match exists and exactly one lead has the same normalized phone with compatible evidence
- **THEN** the system records an exact-phone match with the evidence and source provenance

#### Scenario: Creator attribution contradicts the candidate
- **WHEN** partner creator evidence contradicts the lead's original creator attribution
- **THEN** the candidate is marked conflicted, is not automatically commission-safe and requires human review

#### Scenario: Multiple candidates or no candidate exists
- **WHEN** evidence yields multiple possible leads or no viable lead
- **THEN** the system marks the enrollment review-required or unmatched and does not choose a fuzzy/approximate match

### Requirement: Auditable human reconciliation review
Authorized analysts SHALL be able to accept, reject or link a reconciliation candidate with a reason while preserving the automatic evidence and both sides' raw provenance.

#### Scenario: An analyst records a review decision
- **WHEN** an authorized analyst accepts, rejects or links a candidate with a non-empty reason
- **THEN** the system appends actor, timestamp, decision, reason, automatic evidence and references to the partner and lead source rows

#### Scenario: A review command is unauthorized or incomplete
- **WHEN** a user lacks the required role or submits a decision without required reason/evidence
- **THEN** the command is rejected without changing the reconciliation decision

#### Scenario: A reviewer traces a reconciliation
- **WHEN** a reviewer follows a reported enrollment to its reconciliation evidence
- **THEN** the reviewer can inspect the source file/row, original values, normalized evidence/version, candidate lead and original lead attribution, and any human decision

### Requirement: Conflict-free non-monetary eligibility proxy
The system SHALL expose a potentially-commissionable proxy only for conflict-free reconciled enrollments and SHALL NOT calculate monetary commission or alter original creator attribution.

#### Scenario: A reconciled enrollment has no unresolved blocker
- **WHEN** an enrollment is uniquely reconciled with required provenance and no unresolved identity, duplicate, creator or date conflict
- **THEN** it may be included in the non-monetary potentially-commissionable count

#### Scenario: A reconciliation has an unresolved conflict
- **WHEN** an enrollment is ambiguous, unmatched, conflicted or missing required evidence
- **THEN** it is excluded from the proxy and its blocker category remains visible

### Requirement: FastAPI-owned orchestration and review surface
The import workflow SHALL use FastAPI as the only business-domain API, with Next.js screens for import and human review and n8n orchestration that does not access domain tables directly.

#### Scenario: n8n processes an import
- **WHEN** the exported n8n workflow starts or observes an import job
- **THEN** it uses documented FastAPI contracts and does not read or mutate Supabase business tables directly

#### Scenario: An operator reviews import quality
- **WHEN** an authorized user views an import
- **THEN** the UI exposes job status, quality issues, match/review categories and the required human-review path
