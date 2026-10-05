# Case identity and navigation verification

Status: implemented locally on `feat/demo-ux-email-criteria`, 2026-10-05. Hosted rollout remains separate.

## Change

- `crm_lead_states.business_id` persists a unique human-readable `LEAD-<number>` label. Existing fixture labels are preserved, existing dynamic records are backfilled by creation order, and new records use a sequence-backed trigger. UUID relationships remain unchanged.
- The intake read model now exposes the linked CRM state ID and business label. Entry cards, case details, and bidirectional links use those identities. Invalid CRM deep links do not silently select a seed case.
- A clean-start seed-order defect was corrected: demo examples are inserted after baseline creators exist. The intake panel's intended dark background was restored after rendered inspection found low-contrast text.

## Verification

- `make reset`: all migrations and seed data applied from a clean local database.
- `make test-db`: 217 pgTAP assertions passed, including persistent labels and case mapping.
- `pnpm quality`: formatting, lint, typecheck, 12 web tests, 101 Python tests, and repository verification passed.
- `pnpm --filter @nueva-ruta/web test:e2e`: three authenticated Chromium scenarios passed for existing-case navigation, new event and draft approval, exact CRM selection, refresh, filtering, reverse link, invalid URL, and mobile layout.
- `make verify`: web, API, n8n, simulator, UI-to-API, and authenticated SSR checks passed.
- Desktop and mobile screenshots were inspected locally. The contrast defect in Intake was fixed. The remaining dense CRM mobile layout is scoped to the approved workspace-reform work item.

## Limits

No hosted migration or Railway deployment is claimed here. The hosted reported case still needs the migration and web release before its displayed UUID changes. The next work item handles the approved draft picker and distinct simulated delivery evidence.
