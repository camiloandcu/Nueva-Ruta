## 1. Governed reporting policy and persistence

- [x] 1.1 Extend the strict rule document/schema with the approved stalled-work defaults and validation; preserve immutable historical versions.
- [x] 1.2 Add additive report queries/views/functions with role-safe service access and stable source links; do not create a mutable reporting authority.
- [x] 1.3 Extend reset fixtures and expected-count declarations for deterministic funnel, attribution, quality and within/approaching/breached scenarios.

## 2. Metric contracts

- [x] 2.1 Implement deterministic funnel/cohort counts, visible denominators, stage conversion, decision distribution and first system/human action timing.
- [x] 2.2 Implement stalled work by stage/entity with age, status, threshold, rule version, owner, activity and next action, including business-hour calculations.
- [x] 2.3 Implement delivery, escalation, draft backlog, data-quality, reconciliation category and potentially-commissionable/blocker aggregates.
- [x] 2.4 Implement read-only FastAPI endpoints, validated shared filters, pagination and analyst-minimized evidence drill-through.
- [x] 2.5 Add golden metric, filter, attribution, denominator, zero/empty result, role-boundary and provenance tests.

## 3. Spanish reporting experience

- [x] 3.1 Add Next.js overview, funnel, stalled-work and attribution/quality views backed only by FastAPI contracts.
- [x] 3.2 Add shared creator/channel/state/date filters, visible denominators, descriptive comparison labels, empty states and evidence links.
- [x] 3.3 Add UI contract tests for filters, organic/null attribution, unmatched/conflicted volume, proxy blockers and analyst detail minimization.

## 4. Verification and documentation

- [x] 4.1 Verify aggregate totals reconcile to distinct lead, delivery, canonical-enrollment and reconciliation source categories.
- [x] 4.2 Run application, database, UI and strict OpenSpec checks; record results in `docs/implementation/07_WI-007_VERIFICATION.md`.
- [x] 4.3 After implementation approval and verification, archive WI-007 and sync the resulting specifications.
