## 1. Case-scoped evidence

- [x] 1.1 Add a CRM case-evidence API read model for approved intake and follow-up drafts, their origin, and delivery status.
- [x] 1.2 Add API and SQL checks for case ownership, redacted/approved content, and role boundaries.

## 2. Distinct simulated delivery

- [x] 2.1 Add an ordered SQL migration for the audited idempotent simulated-delivery event and command.
- [x] 2.2 Update future `Info Sent` validation to require linked delivery or documented manual action, preserving legacy history.
- [x] 2.3 Add pgTAP/API tests for success, replay, cross-lead draft, pending draft, opt-out, and atomic rejection.

## 3. Operator workflow

- [x] 3.1 Show approved draft options for the selected case, with origin and undelivered state.
- [x] 3.2 Make CRM actions stage/disposition-aware, separate delivery from approval, and display the resulting timeline and actionable errors.
- [x] 3.3 Add authenticated E2E scenarios, inspect desktop/mobile UI, and run full quality/runtime checks.

## 4. Completion

- [x] 4.1 Update product documentation and archive the verified change to sync specs. The issue/PR update follows as the repository handoff.
