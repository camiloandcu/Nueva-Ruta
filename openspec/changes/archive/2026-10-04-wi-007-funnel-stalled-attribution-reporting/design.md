## Context

WI-005 owns CRM dispositions, escalations and partner delivery. WI-006 owns immutable partner import, normalization, reconciliation and its non-monetary proxy. Existing approved definitions live in `docs/planning/05_DATA_AND_REPORTING.md`; stalled-work defaults live in `docs/planning/03_DOMAIN_WORKFLOWS.md`. FastAPI remains the only business API, SQL migrations remain schema authority, and Next.js is presentation only.

## Goals and non-goals

**Goals:** provide reproducible funnel and operational metrics, expose bottlenecks and attribution risk, show correctly configured stalled work, preserve useful analyst access without exposing unnecessary details, and support traceability to existing source evidence.

**Non-goals:** introduce a second source of truth, change operational states, repair missing attribution, calculate monetary commission, or infer creator causality.

## Proposed design

### Read-only metric layer

- Add narrowly scoped SQL reporting views/functions or a single transactional aggregate query boundary over existing authoritative tables. FastAPI owns filters, role checks and response contracts; the web app and n8n do not query business tables.
- Keep metrics reproducible: tests pass an explicit `as_of` instant, while interactive requests default to the current UTC instant. Date filters are inclusive calendar dates interpreted in the configured reporting timezone and converted to UTC boundaries.
- Use distinct lead IDs for lead funnel stages and distinct canonical enrollment IDs for partner volume. Exact duplicate raw rows never inflate enrollment counts. Preserve records whose lead association is missing or conflicted.
- Cohort the lead funnel by `received_at`; report partner enrollment, data-quality and delivery totals in adjacent independent cards/categories instead of dropping unlinked records through an inner join.
- Show a count beside every rate and name its denominator. For sequential conversion, each stage rate is stage count divided by the immediately preceding stage count; include the received-to-stage rate for context. A zero denominator produces an unavailable rate, not zero percent.
- Creator grouping uses the original lead creator attribution only. Null/organic values appear as “Sin atribución” and are never imputed from partner creator text. Comparisons are descriptive.

### Metric definitions

- Funnel membership follows the approved definitions: unique accepted receipt; current `prequalified` evidence; explicit approved transfer; accepted partner request; canonical partner enrollment reported; and conflict-resolved unique reconciliation. Each is evaluated for the received-lead cohort; partner-only totals are separately reported.
- First decision uses the first persisted WI-004 processing decision. First human action uses the earliest qualifying CRM disposition or escalation claim/resolution; report both elapsed measures and sample counts, excluding absent timestamps rather than treating them as zero.
- Backlog/SLA shows pending drafts, open escalations, CRM stages and current delivery retry/dead-letter state. Delivery reliability counts logical transfers once for outcome rates, attempts separately for retry volume, and measures recovery from first attempt to terminal success where both timestamps exist.
- Partner quality reports normalized issue categories and reconciliation statuses from WI-006. Proxy totals read the stored `potentially_commissionable` result and show false/blocker categories beside it; reporting does not reimplement eligibility.

### Stalled work and rule versions

- Add a `stalled_work` section to rule-document schema version 2, seeded from the approved defaults: new/unclassified 15 minutes; human review pending 4 business hours; prequalified without disposition 8 business hours; Info Sent without activity 24 hours; callback at scheduled time; transferred without partner confirmation 48 hours; reconciliation conflict unresolved 2 business days. Seed a new active immutable version derived from the existing version; do not rewrite schema/version-1 history.
- Business-hour calculations use the published operating schedule (`America/New_York`, configured weekdays/open/close) and must correctly skip closed periods and daylight-saving transitions. Calendar durations remain elapsed UTC durations.
- Preserve the exact policy version and threshold value in every stalled row. The rule editor validates positive thresholds and enum/key coverage; a new policy version is additive and prior published versions remain immutable.
- Stage age uses the authoritative stage-entry/last-meaningful-event time already stored by CRM, transfer, escalation, draft, outbox and reconciliation records. If a specific stage lacks a reliable timestamp, the report returns an explicit missing-evidence state rather than inventing one.
- Classify `approaching` at 80% of the configured duration; callback work is approaching during the 15 minutes before its scheduled time. `breached` begins at the configured threshold. Display the exact timestamp/threshold so this early-warning label is transparent.
- Seed examples relative to a stable fixture reference instant, covering within, approaching and breached work for representative lead, escalation, delivery and reconciliation rows. Do not depend on a machine's current date to assert fixtures.

### API, roles and UI

- Expose read-only FastAPI reporting contracts for overview/funnel, stalled work, operational reliability/quality and evidence detail. Validate date ranges, enum filters and pagination; avoid arbitrary SQL dimensions.
- Operators, supervisors and analysts may view aggregates. Analyst drill-through returns only the attribution, state, timing, category and stable evidence identifiers needed for analysis; no unredacted message body, full phone, or unnecessary raw partner values.
- The Spanish-first Next.js reporting area shares creator/channel/state/date filters and shows denominators, missing-data states, attribution blockers, age/threshold/rule version and links to existing lead/import/reconciliation review surfaces.
- The reporting screens are read-only. Existing commands remain the only way to change CRM, delivery or reconciliation state.

## Risks and mitigations

- **Join fan-out inflates counts:** aggregate each domain at its stable logical entity first, then compose; lock expected counts in fixtures.
- **Unmatched partner records disappear:** keep canonical partner totals and reconciliation categories independent of lead cohorts.
- **Elapsed work time is misleading:** retain the threshold/version beside age and test timezone/business-hours boundaries.
- **Null creator becomes organic credit:** group null attribution explicitly and test that partner creator values never fill it.
- **Analyst views expose excessive evidence:** use purpose-built reporting projections and role tests; never reuse unrestricted operational detail responses.
- **Reporting rewrites eligibility:** read the persisted WI-006 proxy and blocker evidence only.

## Review questions

1. Is the proposed received-time cohort and separate partner-total treatment correct?
2. Are the `approaching` boundaries (80% elapsed; callback within 15 minutes) acceptable?
3. Should the documented stalled-work policy be added to the existing versioned rule document as proposed?
