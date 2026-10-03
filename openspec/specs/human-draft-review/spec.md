# human-draft-review Specification

## Purpose
TBD - created by archiving change wi-004-lead-ingestion-triage-human-drafts. Update Purpose after archive.
## Requirements
### Requirement: Substantive output remains a human draft
Any response containing debt guidance, program detail, eligibility, savings, personal recommendation or follow-up SHALL remain an editable draft until an authorized operator approves it.

#### Scenario: Respond decision creates a draft
- **WHEN** triage produces a substantive response
- **THEN** the system stores a pending draft with rule/template/model provenance and creates no external delivery

### Requirement: Approval-time compliance validation
Every draft approval attempt SHALL re-run deterministic compliance checks against the submitted content and record safe before/after checksums plus actor, rule/template/model metadata.

#### Scenario: Compliant draft is approved
- **WHEN** an authorized operator approves content that passes current compliance validation
- **THEN** the draft becomes approved with audit evidence but remains undelivered in WI-004

#### Scenario: Blocked content is submitted
- **WHEN** approval content contains prohibited terminology, promise, figure or instruction
- **THEN** approval fails without side effects and creates or updates a supervisor escalation with stable violation codes

### Requirement: Owned escalations
Sensitivity, ambiguity, unsupported policy, legal/risk language, low confidence and configured handoff triggers SHALL create an idempotent owned escalation containing reason, priority, redacted summary, due time and suggested role.

#### Scenario: Reprocessing preserves one escalation
- **WHEN** the same event or failure reason is processed again
- **THEN** the system returns or updates the existing open escalation rather than creating duplicate human work

### Requirement: Governed fixed automatic effects
Only the active rule version's receipt/privacy, after-hours acknowledgement and opt-out confirmation templates SHALL create automatic simulated effects, subject to the global feature flag, consent/opt-out rules and an idempotency key; AI SHALL NOT generate or personalize them.

#### Scenario: Automatic messaging is disabled
- **WHEN** the global feature flag is false
- **THEN** no automatic effect is created and the decision records the intentional policy reason

#### Scenario: Allowlisted automatic effect is created
- **WHEN** an eligible event matches one governed fixed purpose while the feature is enabled
- **THEN** exactly one simulated effect references the event, template version and rule version without real delivery

#### Scenario: Non-allowlisted automatic content is attempted
- **WHEN** processing requests an automatic purpose or personalized body outside the published allowlist
- **THEN** the system rejects it, records a compliance failure and creates no effect

### Requirement: No Answer follow-up remains an editable human draft
Recording `No Answer` with a usable phone SHALL create one editable follow-up draft linked to the disposition idempotency key. The draft SHALL remain pending until authorized approval, and approval SHALL run deterministic compliance validation without delivering the message.

#### Scenario: Operator approves a compliant follow-up
- **WHEN** an authorized operator submits edited follow-up content that passes current deterministic compliance checks
- **THEN** the system records the content checksum and approval actor/time while leaving delivery pending for a separate action

#### Scenario: Operator submits prohibited follow-up content
- **WHEN** edited follow-up content fails deterministic compliance checks
- **THEN** approval is rejected and no approval or delivery state is written

### Requirement: Escalations have an auditable lifecycle independent of lead stage
Authorized users SHALL be able to assign, claim, resolve and close an escalation with actor, timestamp and reason evidence. Escalation assignment and resolution SHALL NOT implicitly change the commercial lead stage or approve a partner transfer.

#### Scenario: Operator claims assigned work
- **WHEN** an authorized operator claims an open escalation
- **THEN** the escalation records its owner and claim time while the commercial lead stage remains unchanged

#### Scenario: Supervisor closes work with a reason
- **WHEN** a supervisor closes an escalation with a reason
- **THEN** the escalation records closure evidence and retains the lead's independent commercial stage

#### Scenario: Escalation SLA is breached
- **WHEN** an escalation remains unresolved past its due time
- **THEN** the operational view identifies it as breached using its persisted due time and shows owner and next action

