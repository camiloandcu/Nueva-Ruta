## ADDED Requirements

### Requirement: Role-scoped creator and content planning
Authenticated creator/content APIs SHALL enforce the approved read, author and reviewer roles through FastAPI; Next.js SHALL NOT access business tables directly.

#### Scenario: Analyst browses creator/content evidence
- **WHEN** an authenticated analyst reads profiles, ranked source evidence or script versions
- **THEN** only approved synthetic persona, source, aggregate and script fields are returned without raw phone values or unredacted lead messages

#### Scenario: Analyst attempts a content mutation
- **WHEN** an analyst attempts to author, submit or review a script version
- **THEN** FastAPI denies the command and leaves version and review state unchanged

#### Scenario: A reviewer records a content decision
- **WHEN** a user without the approved reviewer role attempts final script review
- **THEN** the command is denied without changing the script version or its review evidence
