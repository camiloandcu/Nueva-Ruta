## Route and layout approach

Retain the existing route URLs and API boundaries. Rework the home cards into task groups with role-aware destinations. In CRM, keep `?lead=<crm-state-uuid>` as the case selection key and `LEAD-…` as its displayed name. Make the case workspace the first section. Place global operational queues in a clearly separate section or route; every row carries its own case label and link when one exists. This avoids treating the selected lead as an implicit filter on unrelated records.

## Case context and presentation

Use a shared display map for stages and statuses. Derive the next action from current stage, consent, draft and delivery evidence already returned by authenticated APIs, but continue to rely on API/SQL guards on submission. Keep UUIDs and correlations in expandable audit details. Preserve the current controlled disposition reason across case refreshes. If the case changes, clear case-specific command inputs and load only the new case's evidence.

## Data contracts

The current CRM list and case-scoped message-evidence endpoints remain the source for case content. Where global escalation, recovery, follow-up or partner items lack a displayed case label, extend the relevant read model/API response with a safe CRM state ID and `business_id` using joins; avoid client-side matching of unrelated records. Reporting filter choices should come from an authenticated, role-minimized read model rather than fixed UI constants. No new business mutation endpoint is expected.

## Async and accessible states

Fetch independent workspace sections independently. Each section reports loading, empty, error and retry. Keep a single action's feedback next to that action and announce it in a polite live region. Make links, tabs or anchors keyboard reachable with visible focus and a stable heading order. Verify horizontal overflow and primary-action visibility at 390 px and desktop widths using authenticated screenshots.

## Verification

Use local synthetic data and existing role identities. Add focused API/SQL checks only for changed read-model relationships and filter options. Playwright checks home navigation, exact case header, global-queue links, section failure/retry, role visibility, keyboard focus and mobile layout. Run the full quality/runtime gates after implementation. The hosted demo is temporary; local E2E is the destructive test environment.
