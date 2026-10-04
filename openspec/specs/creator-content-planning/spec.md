# creator-content-planning Specification

## Purpose
TBD - created by archiving change wi-008-creator-content-planning. Update Purpose after archive.
## Requirements
### Requirement: Safe complete creator profiles and funnel evidence
The system SHALL expose the five approved fictional creator profiles with all approved persona and attribution fields and safe linked WI-007 funnel evidence through authenticated FastAPI contracts.

#### Scenario: Viewer opens a creator profile
- **WHEN** an authorized viewer opens one of the five creator profiles
- **THEN** the profile contains its stable ID, fictional name/handle, platforms, audience archetype, voice, content pillars, CTA style, attribution parameters and compliance notes

#### Scenario: Profile links to funnel evidence
- **WHEN** a viewer follows a creator's funnel-evidence link
- **THEN** the system shows source-linked aggregate counts and filters using WI-007 definitions, labels comparisons as descriptive and exposes no raw phone or unredacted message content

### Requirement: Fictional source cards with transparent deterministic ranking
The system SHALL present exactly ten fictional source cards and rank them deterministically using visible frequency, funnel-proximity, freshness and compliance-safety contributions for a fixed `as_of` instant.

#### Scenario: Viewer inspects a ranked source
- **WHEN** a viewer requests the source ranking
- **THEN** every source shows fictional provenance, source text/type/date/channel/theme, evidence behind each available factor, its rank and the documented factor contributions

#### Scenario: Ranking is repeated at the same instant
- **WHEN** the same source/lead facts and `as_of` instant are evaluated again
- **THEN** the component values, score and stable tie-broken order are identical

#### Scenario: A ranking factor lacks evidence
- **WHEN** a source lacks data needed for one or more ranking factors
- **THEN** the missing factor is labeled unavailable and no evidence or score contribution is fabricated

#### Scenario: High-risk source is viewed
- **WHEN** a source has an unresolved high-risk compliance label
- **THEN** it remains visible with its reason but is ineligible for selection in an approvable script

#### Scenario: Creator/source comparison is interpreted
- **WHEN** a viewer compares sources or creator-linked funnel evidence
- **THEN** the UI describes observed synthetic associations only and makes no causal, ROI or guaranteed-performance claim

### Requirement: Traceable versioned human-reviewed scripts
The system SHALL maintain three initial Spanish script drafts, each linked to a valid fictional source and creator-fit rationale, with immutable versions, compliance evidence, duration estimate and review status.

#### Scenario: Viewer traces a script
- **WHEN** a viewer opens a script
- **THEN** the viewer can trace its version to source provenance, selected creator fit, body checksum, estimated duration and current review state

#### Scenario: Script content changes
- **WHEN** an authorized author changes a script body or its source/creator fit
- **THEN** the system creates a new version and leaves the prior version and review evidence unchanged

#### Scenario: Script is reviewed
- **WHEN** an authorized reviewer approves, requests changes or rejects a submitted version
- **THEN** the system records actor, time, outcome and reason without publishing, scheduling or delivering the content

#### Scenario: Script fails compliance
- **WHEN** deterministic validation finds a prohibited claim or missing required conditional language
- **THEN** the version is blocked from approval and returns stable violation codes with safe explanations

### Requirement: No publication or external content collection
The creator-content system SHALL operate only on clearly synthetic bundled records and SHALL NOT publish/schedule content, scrape real trends, or expose raw operational lead data.

#### Scenario: Viewer uses creator/content screens
- **WHEN** a viewer browses a profile, source or script
- **THEN** the system makes no external social request and displays fictional labels; no publish or schedule action is available

