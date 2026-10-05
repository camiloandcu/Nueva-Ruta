# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is a commercial operator who reviews incoming fictional debt-management inquiries, approves draft responses, qualifies cases, records contact actions, and prepares a controlled partner handoff. Supervisors govern rules and exceptions; analysts review attribution, reconciliation, and reporting.

## Product Purpose

Nueva Ruta Ops is a Spanish-first operations prototype. It connects the path from an incoming lead to a traceable decision, human-reviewed communication, CRM activity, partner transfer, reconciliation, and operational reporting. Success means an authorized user can identify the next action on a specific case and verify the evidence behind it.

## Positioning

The product demonstrates a single evidence-linked operational workflow across Intake, CRM, partner reconciliation, and reports, using stable `LEAD-…` labels for people and immutable identifiers for audit.

## Operating Context

Users work in an authenticated browser workspace. The local stack uses synthetic fixtures and three roles (operator, supervisor, analyst). Operators navigate Bandeja, Casos, Operación, Resultados, and Administración according to role. A temporary hosted demo exists for evaluation; its account credentials differ from local development credentials.

## Capabilities and Constraints

- A draft's approval and its delivery are distinct events. Future `Info Sent` actions require same-case simulated delivery evidence or a documented manual action.
- Global queues must identify their scope and link each record to its own case when a CRM link exists.
- Sensitive message content is redacted before operational display; business commands pass through the authenticated API and database guards.
- Partner activity and data are fictional. The prototype does not perform real outbound messages, financial advice, or production partner transfers.
- Reporting is a proxy over synthetic operational evidence. It does not calculate payable commissions.
- The temporary hosted demo is subject to the approved USD 7 cap and scheduled shutdown on 2026-10-09 at 23:59 America/Bogota.

## Brand Commitments

The existing name is Nueva Ruta Ops. The product interface is Spanish-first and uses plain task language. No visual redesign or new brand identity has been approved through this product record.

## Evidence on Hand

The repository contains seeded synthetic lead and partner fixtures, reproducible Supabase migrations, Playwright E2E tests, and verification reports in `docs/implementation/`. The current UX review and its work items are in `docs/planning/ux-integration-review/`.

## Product Principles

1. Keep the selected case and its next permitted action clear.
2. Show evidence at the record it explains; keep audit identifiers accessible without making them primary labels.
3. Distinguish approval, delivery, and business outcomes explicitly.
4. Make global work and role permissions visible in navigation and record context.
5. Preserve traceability while protecting redacted content and synthetic-only boundaries.

## Accessibility & Inclusion

The operational interface is used in Spanish on desktop and mobile web. Primary actions, status, failures, horizontal data regions, and record links should remain understandable and keyboard reachable at narrow widths.
