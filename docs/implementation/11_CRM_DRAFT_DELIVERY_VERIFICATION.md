# CRM draft and delivery evidence verification

Status: implemented locally on `feat/demo-ux-email-criteria`, 2026-10-05. Hosted rollout remains separate.

## Change

- The CRM fetches approved intake and follow-up drafts through a read model filtered by the selected CRM case. It shows approved content, origin, approval time, and whether a simulated delivery has been recorded.
- A separate audited delivery command checks case ownership, approval state, stage, active consent, and opt-out. One approved draft can have one simulated delivery; a matching idempotency key replays the same result. The command makes no outbound network call.
- Future `Info Sent` dispositions require a linked delivery event or documented manual reference. The database rechecks the draft and checksum. Existing `approved_draft` history remains intact and the UI labels it as approval without delivery proof.
- The CRM guides qualification before delivery, shows disposition-specific fields, keeps the entered reason during refresh, and reports case-specific errors.

## Verification

- A clean local migration and seed applied with `make reset`.
- `make test-db`: 247 pgTAP assertions passed, including approved-only case readout, case isolation, stage and consent guards, pending/cross-case rejection, idempotency, authorization, manual evidence, and atomic disposition rejection.
- `pnpm quality`: formatting, lint, types, 12 web tests, 103 Python tests, and repository verification passed. API tests cover role protection, case-scoped query, and delivery command payload.
- `pnpm --dir apps/web test:e2e`: four authenticated Chromium scenarios passed. They include intake approval through CRM qualification, delivery, and `Info Sent`, plus a check that another case cannot list the draft. Desktop and mobile screenshots were inspected.
- `make verify`: web, API, n8n, simulator, UI-to-API, and authenticated SSR checks passed.

## Hosted rollout

The reported hosted event `783cd6ac-caf4-5a85-bc57-65163db8a1b6` still requires the database migration and deployed API/web versions. The local E2E used synthetic new events; it did not mutate hosted data.
