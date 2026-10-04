# operational-reporting Specification

## Purpose
TBD - created by archiving change wi-007-funnel-stalled-attribution-reporting. Update Purpose after archive.
## Requirements
### Requirement: Governed funnel counts and denominators
The system SHALL report unique received, prequalified, transfer-approved, partner-accepted, enrollment-reported and enrollment-reconciled entities using the approved definitions, with visible denominators and without counting raw duplicate occurrences as distinct enrollments.

#### Scenario: Funnel is filtered by lead cohort
- **WHEN** a viewer selects a received-date range and supported creator/channel/state filters
- **THEN** FastAPI returns each funnel stage count, its immediately preceding-stage denominator, and the received-cohort denominator without dropping unresolved partner volume from separate partner totals

#### Scenario: A conversion denominator is empty
- **WHEN** the preceding funnel stage contains no entities
- **THEN** the corresponding rate is unavailable and is not represented as zero percent

#### Scenario: Creator comparison includes organic leads
- **WHEN** a viewer groups the lead funnel by creator or channel
- **THEN** original null creator attribution is shown as unattributed/organic and is never inferred from partner-reported creator data

### Requirement: Operational decision, backlog and delivery metrics
The system SHALL provide time-to-first-system-decision and human-action measures, decision/escalation distributions, draft and escalation backlog/SLA states, and logical partner-delivery outcomes, attempts and recovery timing.

#### Scenario: Decision and human-action times are calculated
- **WHEN** a report cohort contains leads with persisted decision or human-action timestamps
- **THEN** elapsed measures include only observed timestamps and expose the sample count; missing events are not treated as zero-duration work

#### Scenario: Delivery outcomes include failures and retries
- **WHEN** a viewer filters partner delivery metrics
- **THEN** outcome rates count logical transfer requests once, retries are reported as attempts, and pending/retry/dead-letter recovery remains visible

### Requirement: Versioned and explainable stalled-work classification
The system SHALL identify stalled lead, escalation, draft, partner-delivery and reconciliation work using the approved threshold for the entity and retain the exact threshold and immutable rule version used.

#### Scenario: Work is within, approaching or beyond threshold
- **WHEN** a viewer queries stalled work at a specified `as_of` instant
- **THEN** each item exposes entity/link, reason or stage, age, threshold, rule version, owner, last meaningful activity and next action with a deterministic status classification

#### Scenario: Business-time thresholds cross closed periods
- **WHEN** a work item's threshold is expressed in business hours or business days
- **THEN** its age calculation follows the configured published schedule and timezone rather than counting closed periods as business time

#### Scenario: A required timestamp is absent
- **WHEN** authoritative data lacks a timestamp needed to calculate an item's age
- **THEN** the item is identified as missing evidence and no age or breach is fabricated

### Requirement: Complete partner volume and safe attribution proxy reporting
The system SHALL report canonical enrollment counts by exact, ambiguous, conflicting, unmatched and reconciled categories, and SHALL include only the existing conflict-free `potentially_commissionable` records in the non-monetary proxy count.

#### Scenario: Unlinked partner volume is shown
- **WHEN** a partner enrollment has no linked lead or has unresolved conflict
- **THEN** it remains in partner-reported totals and its blocker category is visible, while it is excluded from lead conversion and the commission proxy

#### Scenario: Reconciliation is drilled through
- **WHEN** a viewer follows a dashboard enrollment evidence link
- **THEN** the read-only detail traces to the reconciliation case, canonical enrollment and raw source-row references without changing any source or review state

### Requirement: Read-only filters and analyst-minimized detail
Reporting SHALL be served through authenticated FastAPI queries with validated date, creator, channel, state and pagination filters; analyst responses SHALL include only necessary aggregate/attribution evidence and SHALL exclude unredacted message details and raw phone values.

#### Scenario: Analyst views reports and evidence references
- **WHEN** an authorized analyst requests an aggregate or supported drill-through
- **THEN** the response includes safe identifiers, original lead attribution, status/time/category fields and provenance references while omitting unredacted messages and raw phone values

#### Scenario: Reporting cannot mutate business state
- **WHEN** a viewer uses any dashboard or reporting endpoint
- **THEN** only read operations occur and changes require the existing authorized domain commands

### Requirement: Spanish reporting interface with explicit interpretation
The Next.js reporting area SHALL use FastAPI contracts only and SHALL show filter state, counts with denominators, unavailable/empty states, non-causal creator-comparison language and explicit proxy blockers.

#### Scenario: Viewer changes shared filters
- **WHEN** a viewer changes a supported report filter
- **THEN** all applicable report cards and drill-through links reflect the same filter context and preserve unattributed/unmatched categories
