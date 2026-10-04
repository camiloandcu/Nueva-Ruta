## MODIFIED Requirements

### Requirement: Complete fictional creator and content baseline
The seeded baseline SHALL contain exactly five complete fictional creator profiles and exactly ten fictional content sources with the approved descriptive and provenance fields. Content sources used for planning SHALL also contain short synthetic display text and explicit curated compliance-risk evidence; ranking counts and funnel indicators SHALL be derived from linked leads and reporting facts rather than mutable source counters.

#### Scenario: Creator profile coverage is verified
- **WHEN** fixture integrity tests inspect the baseline
- **THEN** each creator has a stable ID, fictional name and handle, platforms, audience archetype, voice, content pillars, CTA style, attribution parameters and compliance notes

#### Scenario: Content source coverage is verified
- **WHEN** fixture integrity tests inspect the content sources
- **THEN** each source has a stable ID, type, date, channel, theme, explicit fictional provenance, display text and reviewable risk evidence

#### Scenario: Source metric evidence is derived
- **WHEN** a source frequency or funnel-proximity value is requested
- **THEN** it is computed from linked lead/report facts for the requested reference instant and is not read from an editable counter
