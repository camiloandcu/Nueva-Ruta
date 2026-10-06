# Nueva Ruta Ops — Planning Index

Status: approved by human (2/10/2026 12:56 p.m. COL)
Last updated: 2026-10-04
Planning authority: these documents supersede conversational summaries once approved.

## Purpose

This package preserves the complete product and technical intent before any implementation or new OpenSpec change. It is designed to support work across sessions without relying on chat history.

## Review set

1. [01_PRODUCT_BRIEF.md](01_PRODUCT_BRIEF.md) — problem, users, outcomes, scope, success and demo story.
2. [02_REQUIREMENTS.md](02_REQUIREMENTS.md) — traceable functional and non-functional requirements.
3. [03_DOMAIN_WORKFLOWS.md](03_DOMAIN_WORKFLOWS.md) — states, workflows, decisions, failures and human responsibilities.
4. [04_ARCHITECTURE.md](04_ARCHITECTURE.md) — system structure, ownership boundaries, interfaces and deployment shape.
5. [05_DATA_AND_REPORTING.md](05_DATA_AND_REPORTING.md) — synthetic data, cleaning, reconciliation, metrics and commission risk.
6. [06_COMPLIANCE_AND_AI.md](06_COMPLIANCE_AND_AI.md) — language controls, privacy boundary, AI responsibilities and evaluation.
7. [07_DECISIONS.md](07_DECISIONS.md) — accepted decisions, alternatives and consequences.
8. [08_WORK_ITEMS.md](08_WORK_ITEMS.md) — ordered delivery units and future one-at-a-time OpenSpec inputs.

## Governance

- No new OpenSpec change is created until the Product Owner reviews, revises and explicitly approves this complete set.
- Approval of this set does not approve every future OpenSpec proposal automatically.
- Development starts with exactly one work item. That work item becomes one OpenSpec change.
- The agent pauses after generating each change for Product Owner review and explicit approval.
- The next change is not proposed until the current work item has been implemented, verified and closed, unless the Product Owner explicitly changes the sequence.
- Material changes to product scope or architecture update these planning documents and their decision history before they affect a work item.

## Current OpenSpec status

The premature monolithic `build-nueva-ruta-ops` change was deleted with explicit Product Owner authorization after its useful decisions were extracted into this approved package. WI-009 is the active approved change; its hosting constraints are recorded in ADR-025. See the current work item in [08_WORK_ITEMS.md](08_WORK_ITEMS.md).

## Release evidence

Current operational docs live under `docs/`: [architecture and operations](../07_ARCHITECTURE_OPERATIONS.md), [AI-use guide](../08_AI_USE.md), [temporary demo runbook](../09_TEMPORARY_DEMO.md), [partner-data cleaning](../10_PARTNER_DATA_CLEANING.md), and [scale report](../11_SCALE_REPORT.md).

## Review checklist

- [x] The product boundary represents Nueva Ruta, Consejería Clara and Influgain correctly.
- [x] The DMP and compliance language is appropriate for the fictional demonstration.
- [x] Automated versus human-approved actions are unambiguous.
- [x] Funnel stages, dispositions, escalation behavior and SLA defaults are correct.
- [x] Data ownership and reconciliation rules prevent false attribution.
- [x] Metrics answer the evaluator's business questions.
- [x] Architecture matches the priority order: visible automation, engineering quality, then visual polish.
- [x] Work items are independently reviewable and ordered correctly.
- [x] Non-goals prevent accidental expansion into real financial counseling or production infrastructure.
- [x] The total delivery remains feasible within 96 hours and USD 20.
