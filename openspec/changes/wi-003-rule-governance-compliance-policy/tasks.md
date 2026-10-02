## 1. Typed Rule and Compliance Core

- [ ] 1.1 Define strict typed models for every WI-003 rule section, schema version and cross-reference.
- [ ] 1.2 Implement canonical serialization, SHA-256 hashing, deterministic YAML import/export and normalized path diffing.
- [ ] 1.3 Implement structural and cross-field validation for ranges, timezones, transitions, references and duplicate publication.
- [ ] 1.4 Implement deterministic compliance checks with stable codes for terminology, conditional claims, prohibited figures/promises and automatic-template restrictions.
- [ ] 1.5 Add focused golden, positive and negative unit tests for normalization, round trip, hashes, diffs and compliance evidence.

## 2. Persistence and Fictional Seed Policy

- [ ] 2.1 Add the Supabase migration for editable drafts, immutable published versions, active-version state, lineage and audit constraints.
- [ ] 2.2 Add database triggers/functions that reject published-version mutation and atomically publish only validated supervisor-confirmed content.
- [ ] 2.3 Add the approved fictional YAML seed with thresholds, debt types, CA/TX/FL coverage, operating hours, templates, feature flags and compliance controls.
- [ ] 2.4 Integrate deterministic initial publication into reset and add database tests for stable hashes, monotonic versions, immutability and rollback lineage.

## 3. Protected FastAPI Contracts

- [ ] 3.1 Add protected rule history, active-version, draft-detail and export query endpoints.
- [ ] 3.2 Add YAML import, draft validation and normalized diff endpoints using the authoritative domain services.
- [ ] 3.3 Add supervisor-only publish and rollback-draft commands with content-hash confirmation and audit evidence.
- [ ] 3.4 Add API authorization and integration tests covering operator review, supervisor publication, stale hashes, invalid policy and immutable history.

## 4. Next.js Review Interface

- [ ] 4.1 Add authenticated rule history and active-version views using FastAPI only.
- [ ] 4.2 Add YAML import/editor, structured validation issues and deterministic export controls.
- [ ] 4.3 Add the human-readable diff and explicit supervisor publish confirmation flow.
- [ ] 4.4 Add UI/API integration tests for valid review, blocked publication, operator denial and derived rollback preparation.

## 5. Verification and Closure

- [ ] 5.1 Document the fictional policy, rule lifecycle, schema/version semantics, validation codes and safe rollback procedure.
- [ ] 5.2 Run formatting, lint, type, unit, UI/API integration, migration/reset, database and OpenSpec validation checks and record WI-003 evidence.
- [ ] 5.3 After implementation verification, archive the completed WI-003 OpenSpec change, sync its specifications and validate the resulting main specs before closing the work item.
