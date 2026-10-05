# Ordered work items for review

1. **Case identity and navigation.** Migration for stable display IDs, backfill, read-model/API contract, deep links, selected-case state, Spanish labels. Acceptance: the reported case appears under one `LEAD-…` label in intake and CRM, and a link opens exactly that case. Add migration and API integration tests.
2. **Draft and action evidence.** Case-specific draft read model, combined picker, simulated delivery or manual-action evidence, SQL guard, actionable errors, stage-specific form. Acceptance: the approved reported draft is visible after qualification, cannot be used for another lead, and approval alone cannot mark `Info Sent`. Add database, API, and browser tests.
3. **Workspace reform.** Task-oriented home, case header/timeline, scoped queues, record links, relevant fields, loading/error/empty states, responsive and keyboard UX. Acceptance: every main action is findable from the case and the global queues are unambiguous. Capture authenticated desktop/mobile screenshots for review.
4. **Cross-module E2E and closure.** Exercise all role and workflow paths, verify resulting records, fix confirmed failures, run quality gates and reproducible Playwright suite. Update product docs and OpenSpec specs after each implemented change is verified; archive completed changes and sync specs. Follow the repository's issue/PR workflow using the authorized external-service access method.

Each item becomes a separately reviewable OpenSpec proposal after the full planning set is approved. Do not interpret this map as permission to deploy or mutate hosted demo data.

Progress: item 1 is implemented and locally verified; see [verification](../../implementation/10_CASE_IDENTITY_NAVIGATION_VERIFICATION.md). Hosted rollout and the issue/PR workflow are pending.
