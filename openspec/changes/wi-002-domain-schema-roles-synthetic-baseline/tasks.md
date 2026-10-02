## 1. Schema and Migration Authority

- [ ] 1.1 Add the ordered Supabase migration for application users, creators, leads, messages, consent evidence, audit events, content sources and raw partner-import provenance.
- [ ] 1.2 Add allowed-value, uniqueness, relationship, timestamp and immutable-provenance constraints plus the indexes required by WI-002 verification.
- [ ] 1.3 Add database tests that prove valid relationships succeed and invalid references or values fail without partial writes.

## 2. Deterministic Synthetic Baseline

- [ ] 2.1 Add the five complete fictional creator profiles and ten fictional content sources with stable IDs and explicit synthetic provenance.
- [ ] 2.2 Add 48 lead/message/consent fixtures using documented `555-01xx` phones and a fixed reference instant.
- [ ] 2.3 Add one immutable raw import job with 30 partner rows covering every approved deliberate defect category.
- [ ] 2.4 Add machine-readable fixture expectations and tests for exact counts, coverage minima, uniqueness, synthetic labels and two-reset repeatability.

## 3. Identity and Role Authorization

- [ ] 3.1 Bootstrap local-only password-protected Supabase Auth identities for operator, supervisor and analyst from ignored environment credentials.
- [ ] 3.2 Implement FastAPI access-token verification and trusted application-role lookup with fail-closed configuration and identity handling.
- [ ] 3.3 Add protected operational and analyst fixture queries whose response models enforce analyst message minimization.
- [ ] 3.4 Add authentication and authorization tests for valid roles, invalid/unmapped identities, restricted message access and supervisor-only commands.

## 4. Protected Demo Reset

- [ ] 4.1 Implement the transactional baseline restore service with exact confirmation, known-table scope and stable result counts.
- [ ] 4.2 Expose the reset through a supervisor-only FastAPI command and preserve one safe audit event for every successful invocation.
- [ ] 4.3 Extend the local wrapper with documented seed/reset operations and actionable failure output that does not print credentials.
- [ ] 4.4 Test successful, unauthorized, incorrectly confirmed and repeated reset paths, including audit persistence and unchanged state on failure.

## 5. Verification and Documentation

- [ ] 5.1 Generate a fixture coverage report that maps every lead case and partner defect category to stable fixture IDs.
- [ ] 5.2 Document demo roles, local credential setup, synthetic-only labels, reserved phone conventions, schema ownership and reset safeguards.
- [ ] 5.3 Run formatting, lint, type, unit, integration, migration-reset and OpenSpec validation checks and record WI-002 verification evidence.
- [ ] 5.4 After implementation verification, archive the completed WI-002 OpenSpec change, sync its specifications and validate the resulting main specs before closing the work item.
