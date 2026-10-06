## Why

The approved UX review identified a final gap: individual case, reporting, and assignment journeys pass browser tests, but the complete handoff among escalation, follow-up, partner delivery, reconciliation, and role boundaries has not been exercised as one reproducible matrix. A page can look connected while a later command or report lacks the expected record. The evaluator needs evidence that each important transition works and that denied transitions leave no misleading state.

## What Changes

- Build a compact, named workflow matrix for operator, supervisor, and analyst against isolated synthetic local data.
- Add Playwright journeys that cross Intake, CRM, escalation/follow-up, partner delivery/recovery, reconciliation, and reporting, asserting both rendered UI and authoritative API/database evidence at important boundaries.
- Cover blocked and wrong-case actions, retryable failures, role restrictions, and recovery without implying that a draft approval sends a message or that a proxy implies earned commission.
- Fix defects reproduced by these journeys, retaining existing domain guards and UI task hierarchy. Record reproducible steps and verification for every correction.
- Run repository quality, pgTAP when SQL changes, full E2E, and local runtime smoke checks. Update product-facing and implementation documentation, archive the change, sync specs, and link the verified result to an issue and PR on the current authorized feature branch.

## Capabilities

### New Capabilities

- `cross-module-verification`: reproducible synthetic journey evidence for role-specific operations and cross-module state transitions.

### Modified Capabilities

- Existing domain capabilities only where a browser journey reproduces a concrete defect; each correction must retain its authorization, audit, and idempotency rules.

## Acceptance Criteria

- The workflow matrix names the actor, starting fixture, visible action, expected authoritative record, and denied alternative for each critical transition.
- Automated browser journeys prove case identity, approval versus delivery, escalation ownership and resolution, follow-up, transfer/recovery, import/reconciliation, and report traceability across modules.
- Operator, supervisor, and analyst sessions show only permitted destinations and commands. Unauthorized and wrong-case operations fail without changing authoritative records.
- Synthetic fixtures are isolated or safely reusable. Tests do not mutate hosted demo records, depend on private hosted credentials, or call real partner/AI services.
- All relevant local quality, database, browser, and runtime checks pass; remaining hosted-authenticated gaps are documented accurately.

## Out of Scope

- Real outbound messaging, live financial decisions, payable commission calculations, and production partner connectivity.
- A new visual identity or replacing the approved operator navigation architecture.

## Review Notes

This is work item 4 of the [approved UX integration review](../../../docs/planning/ux-integration-review/00_INDEX.md). Implementation begins after this proposal is reviewed under the repository workflow.
