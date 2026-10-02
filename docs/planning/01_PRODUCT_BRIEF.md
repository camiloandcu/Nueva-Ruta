# Product Brief — Nueva Ruta Ops

Status: approved by human (2/10/2026 12:56 p.m. COL)
Product Owner: user
Primary stakeholder: Influgain
Agency: Nueva Ruta, fictional
DMP partner: Consejería Clara, fictional

## Product idea

Nueva Ruta Ops is a compliance-first operating console for Spanish-language DMP creator marketing in the United States. It turns creator and organic chat leads into traceable operational work: ingestion, triage, minimal pre-qualification, human review, controlled partner handoff, dirty-data reconciliation, creator reporting and source-backed content planning.

The product is not evaluated as a chatbot. It is evaluated on whether the operation continues without the Product Owner while retaining business judgment, human control and evidence of every decision.

## Problem

A creator campaign can generate leads faster than a small team can consistently classify, qualify, transfer and reconcile them. The operation becomes dependent on undocumented human judgment and fragile spreadsheets:

- risky or ambiguous language can receive inconsistent treatment;
- a failed webhook can silently lose a transfer;
- duplicate messages can repeat actions;
- partner exports can disagree with internal attribution;
- missing creator IDs or mismatched phones can distort commissions;
- content planning can become disconnected from actual lead objections;
- the Product Owner can become the person who remembers every exception.

## Product promise

Every inbound lead becomes one of four visible outcomes:

1. a safe transactional acknowledgement plus a human-reviewable substantive draft;
2. a documented ignored event for spam, non-actionable duplicate or clear opt-out;
3. an owned human escalation with reason, priority and due time;
4. a reasoned commercial closure.

No legitimate ambiguous lead disappears, no substantive message or partner transfer bypasses a person, and no ambiguous enrollment is silently assigned to a creator.

## Users and responsibilities

### Nueva Ruta operator

- Reviews and edits drafts.
- Applies CRM dispositions.
- Claims ordinary escalations.
- Approves partner transfers.
- Schedules callbacks and resolves missing information.

### Nueva Ruta compliance supervisor

- Reviews risky or sensitive cases.
- Publishes immutable rule versions.
- Audits blocked language and automatic templates.
- Manages SLA policy and demo reset.

### Influgain analyst

- Reviews creator/channel funnel performance.
- Investigates missing or conflicting attribution.
- Resolves reconciliation cases with evidence.
- Sees aggregate business data without unnecessary access to sensitive chat text.

### Consejería Clara consejero

- External simulated actor.
- Conducts the real financial intake outside Nueva Ruta.
- Determines whether a DMP could be appropriate.
- Owns income, expense, creditor, account and other detailed counseling information.

### Product Owner

- Approves policies, planning documents and work items.
- Is not required for routine lead handling or failure recovery.

## Target audience

- Spanish-speaking or Spanish-preferring consumers in the United States.
- Leads may arrive from Click-to-WhatsApp advertising or natural inbound traffic.
- The demo accepts nationwide intake but uses fictional configured partner coverage for California, Texas and Florida.
- Unsupported or unknown coverage creates human review; it does not silently reject the lead.

## Channels and attribution

- `CTWA`: lead entered through a tracked creator advertising link.
- `organic`: natural inbound chat from Google, direct navigation, referral, an unpaid creator link or unknown source.
- Organic traffic never receives an invented creator ID.
- Channel describes the entry mechanism; `source_detail` preserves Google, direct, referral, creator-unpaid or unknown.

## Product outcomes

1. Visible automation from lead receipt through reporting.
2. Consistent application of editable business and compliance rules.
3. Human review concentrated on judgment rather than repetitive routing.
4. Recoverable failures with idempotent retries and a dead-letter queue.
5. Credible attribution that distinguishes enrollment volume from commission-safe records.
6. A repeatable local demonstration that starts in less than fifteen minutes.
7. A code and documentation portfolio artifact showing business judgment, not a technology showcase.

## Success measures

- 100% of accepted inbound events are decided, escalated or explicitly rejected.
- Zero duplicate acknowledgements, messages or transfers for the same idempotency key.
- Zero substantive messages or transfers without authorized human approval.
- Every decision references a published rule version.
- Every ambiguous attribution remains excluded from the commission proxy until reviewed.
- Dashboard exposes funnel, stalled work, SLA, failures and data-quality risk.
- A reproducible test processes at least 200 events and reports actual results.
- The required video demonstrates the core story in six minutes or less.
- Local setup does not require a paid external service.

## Demonstration story

The six-minute demo will show:

1. A CTWA lead arrives and receives the safe fixed acknowledgement.
2. The system extracts minimal fields and creates a substantive draft for a person.
3. A risky message is redacted and escalated with reason and SLA.
4. A supervisor changes and publishes a rule without changing code.
5. An operator applies a disposition and the stage/audit trail update together.
6. A simulated partner webhook fails and recovers or reaches the dead-letter queue.
7. A dirty partner CSV produces one exact match, one conflict and one unmatched enrollment.
8. Influgain sees funnel, stalled leads and attribution risk.
9. Three content scripts retain links to the lead question, objection or invented trend that motivated them.

## Scope summary

### Included

- Simulated webhook/poll/queue ingestion.
- Deterministic rules plus optional hosted AI assistance.
- Human draft and escalation queues.
- Three fixed automatic transactional messages.
- Five CRM dispositions and stage movement.
- Simulated partner handoff, retry and dead-letter handling.
- Partner CSV cleaning and conservative reconciliation.
- Funnel, SLA, stalled lead, error and attribution reporting.
- Five complete fictional creator profiles.
- Ten fictional content sources and three vertical-video scripts.
- Seeded role accounts, protected reset, local Compose and optional temporary deployment.

### Deliberately excluded

- Real WhatsApp, Meta or partner accounts.
- Real DMP eligibility or financial counseling.
- Real consumer data or sensitive financial intake.
- Autonomous substantive communication or transfer.
- Monetary commission calculation or payment.
- Enterprise CRM, SSO, multitenancy or production legal certification.
- Social scraping, content publication or a full editorial platform.
- A mobile application or visually elaborate SPA.

## Constraints

- Delivery budget: 96 hours.
- External spend: maximum USD 20, used only for optional AI and temporary hosting.
- Local demo remains authoritative if hosting is not approved or feasible.
- UI and visible content use Spanish for the United States.
- Source code, schemas, API names and technical file conventions use English.
- Use `consejero`, never `asesor`, for partner personnel.
- Savings language is always conditional.
- Do not invent rates, credit scores, fees or outcome guarantees.
- Ambiguous or risky lead content is escalated to a person.

## Product risks

- Fictional coverage may be mistaken for real legal availability.
- DMP may be confused with settlement, consolidation or credit repair.
- AI output may appear authoritative despite being a draft.
- Dirty partner data may inflate or misassign creator performance.
- A demo-only automatic acknowledgement may be read as permission for broader automation.

The UI and documentation must label fictional policies and synthetic data clearly, keep categories separate and show the human control points.
