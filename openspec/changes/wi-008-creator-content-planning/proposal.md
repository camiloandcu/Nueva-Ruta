## Why

WI-007 now connects lead and enrollment outcomes to original creator attribution, and the repository already seeds five complete fictional creator profiles plus ten fictional source placeholders. Operators and analysts still lack a safe way to review those profiles, compare source evidence transparently, and turn selected evidence into compliant, human-reviewable Spanish scripts.

## What Changes

- Add read-only creator profile and funnel-evidence views backed by FastAPI, reusing the existing synthetic personas and WI-007 reporting facts without exposing message bodies or phone values.
- Enrich the ten existing fictional source records with explicit display text and reviewable compliance-risk evidence; derive frequency and funnel proximity from linked lead/report facts rather than storing mutable aggregate counts.
- Add a deterministic, explainable source ranking with visible frequency, funnel-proximity, freshness and compliance-risk contributions, fixed `as_of` support, and descriptive—not causal—interpretation.
- Add three source-linked, creator-fit Spanish script drafts with immutable versions, deterministic compliance results, estimated 30–45 second duration, and a human-review lifecycle.
- Add Spanish-first Next.js creator, source-ranking and script-review screens using FastAPI contracts only.
- Extend synthetic reset and tests to restore source metadata and the three script fixtures repeatably.

## Capabilities

### New Capabilities

- `creator-content-planning`: safe creator profiles, source evidence/ranking, and traceable human-reviewed scripts.

### Modified Capabilities

- `domain-data-baseline`: specify the descriptive, fictional and compliance provenance needed by source cards.
- `deterministic-compliance-policy`: apply existing prohibited-claim controls to content scripts without treating scripts as automatic messages.
- `application-role-access`: define read, draft and review permissions for creator/content surfaces.
- `synthetic-demo-reset`: restore exactly ten enriched source records and three versioned reviewable script fixtures.

## Impact

- Affected areas: additive Supabase migration and reset path; FastAPI creator/source/ranking/script contracts; Spanish Next.js pages; API/database/UI/compliance tests; WI-008 verification documentation.
- Existing five creator profiles and ten source IDs remain stable. No real creator, social post, testimonial or consumer content is introduced.
- The source ranking is a deterministic descriptive aid, not a causal creator-performance claim or an AI score.
- The three initial scripts are authored synthetic drafts. Runtime AI script generation, social publishing/scheduling and real trend scraping are not included.
- Script versions and review decisions remain separate from lead-response drafts and partner-transfer state. No content is published or delivered.

## Acceptance Criteria

- All five profile screens expose every approved profile field and link to safe WI-007 funnel evidence.
- All ten source cards identify their fictional provenance and expose the four ranking factors, factor evidence and deterministic rank.
- Repeating a ranking request with the same source facts and `as_of` returns the same ordered result; unavailable evidence is labeled rather than invented.
- Three Spanish script fixtures each link to a valid source and creator, expose version and review state, and have a verified 30–45 second read-through estimate.
- Compliance validation rejects or blocks unsupported figures, guarantees, unconditional savings/payment claims, prohibited terminology, legal/individualized advice and fictitious testimonials; failed versions cannot be approved.
- Analysts receive only approved profile/source/script and aggregate evidence; no unredacted messages or phone values are exposed. Analysts cannot edit or review scripts.
- Reset restores the same ten sources and three pending-review scripts without publishing content or erasing general audit history.
- Creator/content UI uses FastAPI only and clearly labels all personas, sources and story examples as fictional.

## Verification

- Strict fixture completeness and repeatable-reset database tests.
- Ranking golden tests for each factor, ties, missing evidence, fixed instants and deterministic order.
- API authorization, minimized evidence, immutable versioning and script review lifecycle tests.
- Deterministic compliance tests for both accepted and rejected script text, including conditional benefit wording and forbidden claims.
- UI contract tests for all profile fields, rankings, source/script links, fictional labels, review actions and analyst read-only boundaries.
- Manual Spanish read-through of all three scripts to verify their 30–45 second target.
- Strict OpenSpec validation and recorded results in `docs/implementation/08_WI-008_VERIFICATION.md`.

## Out of Scope

- Real creator profiles, scraping, external social APIs, real testimonials or production consumer content.
- Causal/ROI claims, monetized creator ranking or payments.
- Runtime AI generation, external API calls, publishing or social scheduling.
- Changes to lead attribution, operational outcomes or approved compliance policy.

## Review Questions

1. Approve the proposed equal-weight ranking (25% each for normalized frequency, funnel proximity, freshness and compliance safety), with high-risk sources withheld from script approval; alternatively specify different weights or risk treatment.
2. Approve the proposed human workflow: operator may edit and submit a version, supervisor alone records final review approval, and analyst is read-only; approval does not publish or schedule content.
3. Confirm that the three initial scripts should be authored synthetic drafts with no runtime AI generation in WI-008.
