## Context

The accepted planning package already defines five synthetic personas, ten fictional sources, four ranking factors, three source-backed Spanish scripts and compliance boundaries. The five profiles and ten source IDs are already seeded by WI-002; WI-007 added safe attribution/report facts. WI-008 should expose and connect those assets, not recreate their identity or bypass FastAPI.

Current source rows contain type, date, channel, theme and a synthetic provenance marker. They do not contain displayable question/objection text or explicit risk evidence. No creator/content API or UI exists. Existing deterministic compliance functions cover prohibited partner terminology, guarantees, conditional-benefit phrasing and unsupported figures in governed content; script-specific validation must reuse these concepts without applying the fixed automatic-message allowlist to scripts.

## Goals / Non-Goals

**Goals**

- Make existing synthetic profile/source data useful and traceable in a creator/content workflow.
- Rank sources with deterministic, visible factor values and evidence.
- Store versioned scripts and human review results without adding a publish/delivery path.
- Preserve analyst minimization and the FastAPI-only business boundary.

**Non-Goals**

- Create/edit creator personas or infer real creator performance.
- Generate copy with a hosted model, scrape trends, or contact social platforms.
- Publish, schedule, or deliver any content.
- Treat a rule/compliance pass as legal approval or an outcome guarantee.

## Decisions

### Reuse baseline identities and enrich source cards additively

Keep all five creator business IDs, handles and approved persona fields and all ten source business IDs stable. Extend source records with short synthetic display text and explicit curated risk notes/tags. Frequency and funnel evidence come from the linked synthetic lead/report facts, never a user-editable source counter. Source content and risk labels must be visibly fictional and remain safe for analyst display.

### Explain ranking with normalized, equal-weight factors (proposed for approval)

For a requested fixed `as_of` instant:

- **Frequency:** distinct leads linked to a source, normalized by the highest source count in the selected source set.
- **Funnel proximity:** mean normalized WI-007 lead-stage position of the source-linked leads, using a documented monotonic stage ordering and only observed stages.
- **Freshness:** `max(0, 1 - age_days / 90)` from the source date and the reporting date for `as_of`.
- **Compliance safety:** curated source-risk category mapped to a visible 0–1 safety value; high-risk sources remain visible with their reason but cannot be selected for an approvable script until reviewed.

The proposed total is the arithmetic mean of the four normalized factors. Sort descending by total, then source date, then stable source ID. Return the raw evidence counts/date/risk tag and each normalized contribution alongside the total. If a required factor cannot be computed, report it as missing and do not fabricate a score. High-risk source cards stay visible but are not eligible for script selection in this work item. Display comparisons as descriptive evidence, not causal lift. The Product Owner approved this weighting and risk treatment in the proposal review.

### Keep the first three scripts authored and human-reviewable

Seed three manually authored synthetic Spanish script drafts, each linked to one source and a creator with an explicit fit rationale. Store immutable script versions with body checksum, source/creator links, word count, estimated duration, compliance codes and review metadata. A text change creates a new version; it does not rewrite a reviewed version. Failed deterministic validation blocks submission/approval. The initial records remain pending review.

Do not call OpenAI or another provider in WI-008. AI-assisted copy is permitted elsewhere by the approved AI boundary but is optional; this work item can meet its goal without usage cost or provider-dependent results.

### Proposed role split (for approval)

- Operator, supervisor and analyst can read the approved persona/source/ranking fields and script versions through authenticated FastAPI routes.
- Operator may edit a draft version and submit it for review.
- Supervisor may approve/request changes/reject; each decision records actor, time, reason and compliance result. No role can publish or schedule content in this change.
- Analyst is read-only and receives no lead message body, raw phone or detailed operational record.

The role split is a proposal choice, not an existing platform capability; confirm or revise it before implementation.

### Extend reset as an atomic synthetic-fixture restore

The existing supervisor reset already rebuilds creators and content sources. It must clear dependent synthetic script-version/review rows before the sources, restore the ten enriched source rows and exactly three initial pending-review script versions, and retain general audit history. Reset is a demo fixture restore, not a production content-management delete operation.

### FastAPI remains the only business boundary

Use authenticated FastAPI read endpoints for profiles, ranking and script listing/details, and role-protected commands for version creation/review. Next.js calls the existing authenticated proxy only. Do not add direct Supabase business queries to the browser.

## Risks / Trade-offs

- Equal weights, the 90-day freshness horizon, stage normalization and risk mapping are not specified in the planning package. They are explicit proposal defaults requiring Product Owner review.
- The existing ten sources have only themes; authored display text and risk labels are additional synthetic fixture content requiring review for fidelity and compliance.
- Static authored scripts meet the requirement with lower risk and no provider cost, but do not demonstrate model-assisted script drafting.
- “Approved” means internally reviewed only. UI and API language must not imply publication, partner endorsement, expected savings or guaranteed lead outcomes.
- Reset ordering must respect foreign keys and must not erase global audit evidence.

## Migration Plan

Add an ordered SQL migration for source-card fields, script/version/review persistence, access-control RPCs or functions and deterministic fixtures/reset behavior. Apply through Supabase migrations only. Extend API, UI and pgTAP/unit tests; no live reset or external service is needed. Archive and sync OpenSpec only after implementation is approved and verified.

## Open Questions for Product Owner

- Equal weights and exact factor normalizations, 90-day freshness horizon and high-risk exclusion need approval or replacement.
- Confirm operator-authoring/supervisor-review/analyst-read-only permissions.
- Confirm static authored scripts rather than runtime AI generation for this work item.
