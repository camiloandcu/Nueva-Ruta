## ADDED Requirements

### Requirement: Human-reviewed content script validation
The system SHALL validate every script version using deterministic checks for approved partner terminology, conditional savings/payment language, guarantees, unsupported figures, prohibited instructions, individualized legal/financial advice and testimonial misrepresentation. Script validation SHALL remain distinct from the automatic-message allowlist.

#### Scenario: Compliant source-backed script passes
- **WHEN** a Spanish script refers to a consejero, uses conditional benefit language where needed, contains no unsupported figures or prohibited claims, and identifies fictional material honestly
- **THEN** validation returns no blocking violation and preserves stable policy codes/checksum for reviewer evidence

#### Scenario: Unconditional savings claim is blocked
- **WHEN** a script asserts a certain savings or payment reduction without an approved conditional phrase
- **THEN** validation returns a blocking conditional-benefit violation and the version cannot be approved

#### Scenario: Unsupported outcome or false testimonial is blocked
- **WHEN** a script introduces an unauthorized rate, amount, result, timeline or presents a fictional story as a real testimonial
- **THEN** validation returns a stable blocking violation and records no approval

#### Scenario: Script is not an automatic message
- **WHEN** a script passes content validation
- **THEN** it remains a human-reviewed content asset and does not gain any automatic messaging, publishing or delivery permission
