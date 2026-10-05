# Recommended design

## Information architecture

Use a task-oriented home: **Bandeja** (new work), **Casos** (one selected lead and its timeline), **Operación** (escalation and recovery queues), **Resultados** (reports and reconciliation), and **Administración** (rules, execution evidence, content planning by role). Keep existing routes initially and add case-aware links so the transition is incremental.

The case workspace has a compact header with `LEAD-…`, current stage, consent, source, and next valid action. Tabs or anchored sections show **Resumen**, **Mensaje y aprobación**, **Actividad comercial**, and **Historial**. A global queue names its scope and displays a lead link on each item. Audit UUIDs and correlations live in expandable evidence details.

## Data and behavior

- Add a stable business label to `crm_lead_states`, backfill dynamic rows, and expose it through `operational_crm_leads`. Keep fixture labels and UUID identity unchanged. Use a database sequence/constraint or equivalent transaction-safe allocator; never derive the next number in browser code.
- Expose an API case-evidence read model joining the selected CRM state to its source event, processing decision, approved response draft, follow-up drafts, and delivery evidence. Return only redacted/approved content appropriate to the role. Reject cross-lead IDs on every write.
- Carry a CRM state ID in the intake-to-CRM URL, validate it server-side, and retain selection across refresh and filters. Render links from CRM back to the matching intake event and relevant report evidence.
- Model messaging as separate events: draft prepared → approved → simulated delivery or documented manual action → `Info Sent`. Keep this visible in the UI and enforce it in the disposition RPC. An approved draft can be selected as a candidate, but cannot by itself complete `Info Sent`.
- Centralize Spanish display labels and action eligibility in a shared UI module backed by API state. Treat client eligibility as guidance; the SQL/API checks remain the source of truth.
- Scope queues by selected lead or clearly identify global queues. Use section-level loading, errors, retry, and action feedback.

## Verification environment

Run the authenticated UI in a reproducible local Compose/Supabase stack, add Playwright browser tests with role-specific synthetic accounts, and collect desktop/mobile screenshots plus trace artifacts on failures. The current WSL environment has no Docker executable or browser, so this requires an enabled Docker Desktop WSL integration or another authorized test runner before E2E completion can be claimed. The hosted demo is subject to WI-009's USD 7 cap and 2026-10-09 shutdown; it should not become the destructive test environment.
