## 1. Task-oriented navigation

- [x] 1.1 Replace the four numbered home cards with the five approved task groups and role-appropriate destinations, while retaining existing route URLs.
- [x] 1.2 Add shared Spanish display labels for case stages, dispositions, queue states and reasons without changing stored values.

## 2. Case and queue clarity

- [x] 2.1 Build a compact case header with stable `LEAD-…` label, stage, source/consent context and next eligible action; group message, activity and history.
- [x] 2.2 Separate or clearly label global escalation, recovery, follow-up and partner queues. Add safe case labels/links in API read models where missing.
- [x] 2.3 Make section loading, empty, error, retry and action feedback independent; preserve valid user input and selection on refresh.

## 3. Reporting and accessibility

- [x] 3.1 Replace hardcoded report filter choices with role-safe valid options and preserve applied context through pagination and evidence drill-through.
- [x] 3.2 Inspect authenticated desktop/mobile layouts and keyboard focus; correct overflow, contrast and inaccessible controls found in that review.

## 4. Verification and completion

- [x] 4.1 Add focused read-model/API and Playwright checks for case links, queue scope, role visibility, loading/failure recovery and report filters.
- [x] 4.2 Run clean local migration when needed, SQL/API/UI quality gates, full authenticated E2E and runtime smoke checks.
- [x] 4.3 Update product docs, archive the verified OpenSpec change and sync specifications; link the implementation to an issue/PR on the same branch using the authorized GitHub method.
