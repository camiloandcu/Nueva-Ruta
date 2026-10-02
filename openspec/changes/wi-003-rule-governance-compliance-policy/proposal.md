## Why

Nueva Ruta cannot safely embed fictional eligibility, routing and communication policy in application code. WI-003 creates a reviewable rule lifecycle so later lead decisions can reference immutable policy versions and deterministic compliance controls.

## What Changes

- Add a versioned rule schema covering classification triggers, debt thresholds and types, state coverage, operating hours, escalation SLA, retry policy, stage transitions, automatic templates and feature flags.
- Seed the approved fictional defaults through YAML: USD 5,000–100,000, California/Texas/Florida, supported unsecured debt types and Monday–Friday 09:00–18:00 `America/New_York`.
- Import valid YAML as a database draft without rebuilding the application and export normalized rule versions back to YAML.
- Validate schemas, references, conflicting ranges, transitions and automatic-template restrictions before publication.
- Present a human-readable normalized diff in the Next.js interface before publication.
- Restrict immutable publication to supervisors and preserve content hashes, actor, timestamp, source/parent lineage and audit evidence.
- Implement rollback by publishing a new version derived from an earlier version rather than mutating history.
- Add deterministic compliance checks for the required term `consejero`, conditional savings language, prohibited figures/promises and the three allowed fixed automatic template purposes.
- Exclude real lead processing, AI integration, message delivery, CRM disposition execution and partner transfer.

## Capabilities

### New Capabilities

- `rule-governance`: YAML seed/import/export, database drafts, validation, normalized diff, supervisor publication, immutable history and derived rollback.
- `deterministic-compliance-policy`: Versioned deterministic validation for approved terminology, conditional claims, prohibited content and automatic-template restrictions.

### Modified Capabilities

None.

## Impact

- Affected areas: Supabase migrations and seed assets, FastAPI rule modules and protected endpoints, Next.js rule review interface, tests and operator documentation.
- Persistence: adds draft and immutable published rule-version tables under the existing Supabase migration authority.
- Authorization: reuses WI-002 identities and FastAPI role enforcement; operators may inspect and validate but only supervisors may publish.
- Dependencies: adds a pinned YAML parser if needed; no hosted service, AI provider or external account is introduced.

