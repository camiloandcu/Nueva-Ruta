## ADDED Requirements

### Requirement: Required partner terminology
The deterministic compliance policy SHALL require the Spanish term `consejero` for partner personnel and SHALL flag configured disallowed substitutes in governed templates.

#### Scenario: Approved terminology passes
- **WHEN** governed Spanish content refers to partner personnel only as `consejero`
- **THEN** the terminology check returns no violation

#### Scenario: Disallowed substitute is detected
- **WHEN** governed content uses a configured prohibited substitute for partner personnel
- **THEN** the check returns a stable terminology violation with the matched safe location

### Requirement: Conditional benefit language
The deterministic compliance policy SHALL reject unconditional savings or payment-reduction claims and SHALL recognize approved conditional phrases such as `podría`, `en algunos casos` and `dependiendo de la situación y de los acreedores`.

#### Scenario: Conditional explanation passes
- **WHEN** a governed template describes a possible benefit using an approved conditional phrase without a guarantee
- **THEN** the conditional-language check returns no blocking violation

#### Scenario: Guaranteed savings is blocked
- **WHEN** a governed template promises savings or payment reduction as certain
- **THEN** validation returns a blocking unconditional-benefit violation and prevents publication

### Requirement: Prohibited claims and invented figures
The deterministic compliance policy SHALL block guarantees, invented rates, fees, percentages, scores or timelines, instructions to stop payment or creditor contact, disappearing-debt claims and individualized legal, tax or financial advice in governed automatic templates.

#### Scenario: Prohibited promise is detected
- **WHEN** an automatic template contains a configured guarantee or prohibited instruction
- **THEN** validation returns a stable blocking violation identifying the policy category

#### Scenario: Unsupported figure is detected
- **WHEN** an automatic template contains a numeric outcome not explicitly authorized by its policy section
- **THEN** validation returns a blocking invented-figure violation

### Requirement: Automatic template allowlist
The system SHALL allow automatic messaging only for fixed versioned receipt/privacy, after-hours acknowledgement and opt-out confirmation purposes, all controlled by a global feature flag and written without AI or substantive personalization.

#### Scenario: Safe allowlisted templates validate
- **WHEN** the rule document defines exactly the three approved fixed purposes with compliant content and versions
- **THEN** automatic-template validation succeeds while preserving the global disable flag

#### Scenario: Additional automatic purpose is rejected
- **WHEN** a rule document defines any other automatic-message purpose
- **THEN** validation returns a blocking allowlist violation and prevents publication

#### Scenario: Unsafe allowlisted body is rejected
- **WHEN** an allowlisted template contains prohibited content or substantive personalization placeholders
- **THEN** validation returns blocking compliance violations and prevents publication

### Requirement: Stable compliance evidence
Every deterministic compliance evaluation SHALL return stable violation codes, severity, policy path and a safe human-readable explanation without relying on an AI provider.

#### Scenario: Same input produces same evidence
- **WHEN** the same normalized rule document is evaluated repeatedly under the same schema version
- **THEN** the ordered compliance result is identical and requires no external service or AI key

