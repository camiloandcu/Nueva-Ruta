# WI-003 Rule Governance and Compliance Verification

Checked: 2026-10-02

## Delivered lifecycle

The repository contains one explicitly fictional policy seed at
`config/rules/fictional-defaults.yaml`. FastAPI parses the YAML into strict Pydantic models,
normalizes it to canonical JSON, computes a SHA-256 hash and applies deterministic compliance
checks. Runtime policy authority remains in PostgreSQL:

1. An operator or supervisor imports valid YAML through FastAPI as an editable draft.
2. FastAPI exposes structured validation evidence and a normalized path diff against the active
   version.
3. A supervisor confirms the exact current hash and supplies a reason and correlation ID.
4. PostgreSQL atomically deactivates the prior version, allocates the next monotonic version and
   records actor, source draft, parent/derivation lineage and an audit event.
5. Published content cannot be updated or deleted. Rollback copies historical content into a new
   derived draft and follows the same review and publication path.

Next.js uses the authenticated `/api/rules/*` proxy and never writes Supabase rule tables directly.
The `/rules` interface presents immutable history, deterministic YAML export, validation evidence,
normalized diffs and explicit hash confirmation. FastAPI remains authoritative for role checks and
validation.

## Fictional defaults

- Continuation range: USD 5,000–100,000.
- Supported unsecured debt: credit card, medical and personal loan.
- Covered states: California, Florida and Texas.
- Hours: Monday–Friday, 09:00–18:00, `America/New_York`.
- Automatic purposes: receipt/privacy, after-hours acknowledgement and opt-out confirmation.
- Automatic messaging is globally disabled in the initial version.
- Seed content hash: `b229bf8f6e7c8e55deed9975b5d5ca2a88bf664783aefa5586906dc74aae71e4`.

These settings are test policy, not customer eligibility or legal/financial advice.

## Stable validation and compliance evidence

Structural errors use a `RULE_*` code derived from the stable Pydantic error category and include a
normalized field path. Malformed YAML uses `RULE_YAML_PARSE`. Deterministic template controls emit:

| Code | Meaning |
| --- | --- |
| `AUTO_PURPOSE_ALLOWLIST` | Configured automatic purposes differ from the approved three. |
| `AUTO_TEMPLATE_SET` | The document does not define exactly one template per approved purpose. |
| `AUTO_PURPOSE_NOT_ALLOWED` | A template has a purpose outside the allowlist. |
| `TERM_DISALLOWED_PARTNER` | A governed body uses a disallowed substitute for `consejero`. |
| `CLAIM_PROHIBITED` | A body contains a guarantee or prohibited instruction. |
| `BENEFIT_UNCONDITIONAL` | A savings/payment claim lacks approved conditional language. |
| `FIGURE_UNSUPPORTED` | An automatic body contains a percentage, money amount or outcome timeline. |
| `AUTO_PERSONALIZATION` | A fixed automatic body contains a placeholder. |

All compliance findings are ordered by policy path and code. They use no AI provider or external
service.

## Safe rollback

1. A supervisor selects an earlier immutable version and creates a rollback draft through
   `POST /v1/rules/rollback-drafts` with the historical version ID and a reason.
2. The supervisor reviews the normalized diff against the currently active version.
3. The supervisor publishes using the draft's exact hash, reason and a unique correlation ID.
4. The new version becomes active with a higher version number. `parent_version_id` identifies the
   version it replaced and `derived_from_version_id` identifies the historical source.

Never update an old version or move the active marker manually to represent rollback.

## Verification evidence

- Repository reset applied all three migrations and restored the deterministic seed.
- `./scripts/local.sh test-db`: passed; 2 files and 23 assertions covering the WI-002 baseline plus
  seed hash/defaults, immutable history, stale/duplicate rejection, monotonic publication, audit
  evidence and rollback lineage.
- `pytest`: focused rule/compliance/API tests passed (12 tests).
- Web Node tests passed (4 tests).
- Ruff, mypy, ESLint, TypeScript and Prettier passed.
- `openspec validate wi-003-rule-governance-compliance-policy --strict`: passed before closure.

The reset helper could not bootstrap demo identities from the user's `.env` because its optional
`DEMO_*` variables are absent. Verification used temporary local fictional credentials passed only
to the existing bootstrap script; `.env` was not changed and no credentials were committed.
