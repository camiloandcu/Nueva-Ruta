## Why

WI-005 and WI-006 now provide the operational lead, transfer, delivery, partner-import and reconciliation facts, but there is no governed read surface that combines them. Operators and analysts cannot yet see where work is flowing, what is stalled, or which reported enrollments are safe to count in the non-monetary attribution proxy.

## What Changes

- Add FastAPI-owned, read-only reporting queries for the received-to-reconciled funnel, first-action/decision timing, CRM and escalation backlog/SLA, partner delivery outcomes, import quality and reconciliation/commission-proxy blockers.
- Add a Spanish-first Next.js reporting area with shared creator/channel/state/date filters, visible denominators, empty states and safe drill-through to supporting evidence.
- Add stalled-work classification using the accepted defaults in `docs/planning/03_DOMAIN_WORKFLOWS.md`, linked to the immutable rule version that supplied each threshold.
- Extend the synthetic reset with stable reporting expectations and within-threshold, approaching and breached examples so the dashboards can be verified without wall-clock waits.
- Keep the read model derived from existing domain facts; reporting does not mutate operational records, assign attribution, infer causation or calculate money.

## Capabilities

### New Capabilities

- `operational-reporting`: governed funnel, operational, stalled-work and attribution-risk metrics with role-scoped evidence drill-through.

### Modified Capabilities

- `application-role-access`: specify permitted analyst access to aggregates and minimized drill-through evidence.
- `rule-governance`: add immutable, versioned stalled-work threshold configuration for reports.
- `synthetic-demo-reset`: restore deterministic reporting fixtures and metric expectations.

## Impact

- Affected areas: Supabase reporting functions/views and fixture reset; FastAPI reporting queries; Next.js Spanish dashboards; metric/API/UI/database tests; WI-007 verification documentation.
- Rule policy: introduce a schema-version-2 `stalled_work` policy using the defaults already approved in `docs/planning/03_DOMAIN_WORKFLOWS.md`; seed it as a new active immutable version derived from version 1, preserving existing rule history.
- Data: no separate mutable reporting source of truth. Metrics derive from accepted lead events, CRM state/history, rule versions, escalations, drafts, transfer/outbox attempts, import/normalized/canonical/reconciliation facts and review decisions.
- Authority: existing domain tables remain authoritative. Organic leads remain unattributed unless source evidence says otherwise; unresolved/unmatched/conflicted enrollments remain visible in volume totals but outside the proxy.

## Acceptance criteria

- The funnel reports unique counts for received, prequalified, transfer-approved, partner-accepted, enrollment-reported and enrollment-reconciled stages; each count and conversion exposes its denominator.
- Date-windowed cohorts use the lead received time for lead funnel/conversion comparisons. Partner enrollment and delivery/quality totals remain independently visible so unmatched and conflicted partner volume is not filtered out by lead linkage.
- Creator/channel/state filtering never assigns organic or null-attribution leads to a creator. Creator comparisons are descriptive and do not imply causal lift.
- Stalled rows expose entity/link, stage or reason, age, threshold, active rule version, owner, last meaningful activity and next action; seeded within/approaching/breached cases classify deterministically.
- Reported canonical enrollment totals include exact, ambiguous, conflicting and unmatched categories; only the existing conflict-free `potentially_commissionable` facts contribute to the proxy count, with blocker categories visible.
- Analysts can access aggregates and only necessary attribution/provenance identifiers; reports never expose unredacted message content or raw phone values to analysts.
- Every report drill-through is read-only and traces an enrollment to its reconciliation case, canonical record and raw source-row references without changing source facts.
- Fixed fixture expectations reconcile to source categories, and API/database/UI tests cover filters, empty results, role boundaries, denominators and attribution edge cases.

## Verification

- Metric unit and database integration tests with fixed `as_of` instants, cohort boundaries, denominators and aggregate reconciliation.
- Stalled-work tests for each approved default, business-time threshold, rule-version attribution and within/approaching/breached fixtures.
- API authorization/minimization and read-only contract tests for every report surface.
- Next.js tests for shared filters, Spanish labels, visible denominators, empty states and evidence drill-through.
- Strict OpenSpec validation and documented local verification results in `docs/implementation/07_WI-007_VERIFICATION.md`.

## Out of scope

- BI vendor or hosted analytics integration.
- Monetary commissions, payment authorization, causal or ROI claims, and inferred attribution.
- New operational commands, source data correction, or a mutable materialized reporting store.
- Changing approved stage thresholds except through the existing supervisor-reviewed rule-version lifecycle.

## Review questions

1. Approve the reporting cohort rule: lead funnel filters use `received_at`; partner totals remain separate and continue to show unlinked/conflicted volume.
2. Approve `approaching` as 80% of the configured threshold consumed (and a callback as approaching within 15 minutes of its scheduled time), with the breached state beginning at the approved threshold.
3. Approve versioning the documented stalled-work defaults under the immutable rule lifecycle while retaining prior rule versions unchanged.
