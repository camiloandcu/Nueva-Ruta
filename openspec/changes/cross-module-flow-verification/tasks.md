## 1. Coverage inventory

- [ ] 1.1 Map existing UI, API, SQL, and browser tests to each journey in the approved matrix and identify only unproven boundaries.
- [ ] 1.2 Prepare reusable synthetic fixtures and separate authenticated contexts for operator, supervisor, and analyst without changing hosted data.

## 2. Cross-module journeys

- [ ] 2.1 Verify case identity, draft approval, delivery evidence, disposition history, and wrong-case denial across Intake and CRM.
- [ ] 2.2 Verify escalation ownership, assignment, claim/review, resolution, and follow-up draft evidence with authorized and denied actors.
- [ ] 2.3 Verify transfer attempts and recovery, partner import quality, reconciliation outcomes, and enrollment origin in reporting.
- [ ] 2.4 Verify role-based navigation, direct URL/API denials, retries, and responsive states at affected boundaries.

## 3. Confirmed defect correction

- [ ] 3.1 Fix each reproduced functional or UX defect in its owning module, with an assertion that fails before the correction and passes after it.
- [ ] 3.2 Inspect affected desktop/mobile views and confirm that any new feedback, labels, or error states remain understandable and keyboard reachable.

## 4. Completion

- [ ] 4.1 Run relevant pgTAP, API/web quality, full authenticated E2E, and local runtime checks; record counts and remaining limits.
- [ ] 4.2 Update product and verification docs, archive this completed change, sync specifications, and link the verified work to an issue/PR on the authorized feature branch.
