## 1. Persistent case identity

- [x] 1.1 Add an ordered migration for a unique business label on every CRM state, preserve seed labels, backfill new-event cases, and allocate future labels atomically.
- [x] 1.2 Update operational views/read models and reset behavior without altering UUID references.
- [x] 1.3 Add database integration checks for existing labels, concurrent ingestion, replay, and reset.

## 2. Exact case navigation

- [x] 2.1 Expose the intake event's related CRM state and display label through an authenticated API contract.
- [x] 2.2 Link Intake → CRM and CRM → Intake by immutable IDs, remove the hardcoded default, and handle missing IDs clearly.
- [x] 2.3 Show a shared human-readable case header and place UUID/correlation details in audit evidence.

## 3. Verification and completion

- [x] 3.1 Add focused API and browser tests for the reported event relationship, URL selection, refresh, filtering, and wrong-case prevention.
- [x] 3.2 Run relevant lint, typecheck, migration, API, UI, and browser checks; inspect desktop and mobile renderings.
- [ ] 3.3 Update product documentation, archive the verified change to sync specifications, and follow the authorized issue/PR workflow.
