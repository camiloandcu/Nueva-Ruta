# Escalation assignment UX verification

Status: locally verified and deployed from `feat/demo-ux-email-criteria`, 2026-10-05. Issue #24 tracks the correction on PR #20.

## Observed issue and resolution

- Priority `urgent` used the same card treatment as normal work. Urgent cases now have a red border and background, while normal and high priorities remain visually distinct.
- The assignment control previously fired on selection, and the nearby button closed the escalation. Supervisors now select an active operator or supervisor and press **Confirmar asignación**. The separate close action remains explicitly labeled. Operators do not see supervisor-only controls.
- The responsibility field previously said only “Caso asignado.” It now shows the responsible person's display name, and **Tomar caso para mí** states who receives an unassigned case. A case assigned to another person does not offer an unauthorized review action.
- Operators and supervisors can filter the queue to all cases, cases assigned to them, or unassigned cases. The application's `analyst` role is currently limited to reporting and reconciliation and cannot own an escalation under the database guard; this role boundary is preserved.
- Cards now align to their own top edge, so expanding or acting on one does not stretch its neighbor.

## Verification

- `pnpm quality`: formatting, lint, types, 12 web checks, 106 Python tests, and repository checks passed.
- `pnpm --dir apps/web test:e2e`: 10 authenticated Chromium tests passed; the optional recording test was skipped during the ordinary suite.
- `make verify`: web, API, n8n, simulator, UI-to-API, and authenticated SSR checks passed.
- The two new escalation browser tests checked the operator's own-case filter, priority distinction, role-gated controls, explicit supervisor assignment, and stable neighbor height.
- `RECORD_EVALUATOR_VIDEO=1 pnpm --dir apps/web exec playwright test e2e/evaluator-video.spec.ts` recorded the operator path from Intake approval through CRM delivery and disposition to escalation, reports, and reconciliation. The root `demo-flujo-completo.webm` is 22.24 seconds and ignored by Git.

Railway demo web and API both deployed commit `9cad640` successfully. The public web `/api/health` returned `{"service":"web","status":"alive"}`. Hosted authenticated UI remains unverified because its assigned test credentials are unavailable here. Local Docker remains running for review.
