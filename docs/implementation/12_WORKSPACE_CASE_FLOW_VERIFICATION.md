# Workspace and case flow verification

Status: locally implemented and verified on `feat/demo-ux-email-criteria`, 2026-10-05. Hosted rollout is recorded below after deployment.

## Observed UX problems and changes

- The four home cards did not match the number of routes or the operator's sequence. The authenticated home now groups links by task: Bandeja, Casos, Operación, Resultados, and Administración. An analyst sees only permitted reporting, reconciliation, and content links.
- The CRM previously put one selected case beside several unrelated global queues. The selected case is now first; the queues follow under headings that explicitly say they cover the whole operation. Records with a CRM state show their own `LEAD-…` link; unlinked records say so.
- A selected case lacked enough context to decide its next step. It now shows its persistent label, translated stage, source channel, consent state, and next action. Approved messages, disposition controls, and case history stay together; audit UUIDs remain expandable.
- Raw English codes in stages, reasons, dispositions, queue states, and reporting made the Spanish UI harder to scan. Display labels now come from one shared mapping while API/database values remain unchanged.
- A failed CRM request could leave an empty section that looked like valid absence. Each list now has its own load result, empty state, failure message, and retry. A queue failure leaves the case usable. Case selection and form values survive successful refreshes.
- Reporting filters used hardcoded creators, channels, and states. An authenticated role-safe endpoint now derives supported choices from the reporting snapshot, and the UI retains applied choices across report actions.
- Enrollment tracing previously sent the operator to origin details at the end of a long report. Every enrollment now shows import date and source rows, quality, reconciliation, linked case, attribution, and proxy status in its own compact record. Checksums remain available in the same record for audit. The report initially shows eight enrollments and reveals more on request.
- Authenticated desktop inspection found a long global queue and unused space next to the case. The layout now places the case before a two-column queue grid at desktop width, then stacks content at 390 px. Links and action controls have visible focus styles; horizontal overflow is checked in browser tests.

## Local verification

- `make reset` applied the ordered migration and seeded synthetic accounts from a clean local database.
- `make test-db`: 258 pgTAP assertions passed, including the case-labeled queue views.
- `pnpm quality`: formatting, lint, types, 12 web checks, 105 Python tests, and repository checks passed.
- `pnpm --dir apps/web test:e2e`: eight authenticated Chromium cases passed. They cover exact Intake ↔ CRM navigation, approved-draft delivery evidence, a global queue's own case link, browser-back selection, one failed queue and local retry, data-backed report choices, inline enrollment origin and progressive disclosure, analyst navigation permissions, and mobile layout/overflow.
- `make verify`: web, API, n8n, simulator, UI-to-API, and authenticated SSR smoke paths passed.
- Rendered screenshots: `/tmp/influgain-workspace-desktop.png`, `/tmp/influgain-workspace-mobile.png`, `/tmp/influgain-reports-desktop.png`, and `/tmp/influgain-reports-mobile.png` (local artifacts, not committed).

## Hosted rollout

Pending final deployment verification. The hosted synthetic case was not mutated for these tests.
