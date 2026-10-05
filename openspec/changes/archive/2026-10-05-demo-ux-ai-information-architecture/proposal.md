## Why

The hosted demonstration must let an evaluator understand and exercise each
required workflow without being trained on internal implementation details.
The current intake is preset-only, the CRM action area mixes incompatible
actions, and the content screen renders several dense catalogs at once. The
backend content endpoints are healthy in the hosted environment, but the page
does not communicate a primary task or a recoverable loading state.

## What Changes

- Replace preset-only intake with a free-text message composer, retaining
  compact cases only as optional quick-fill examples.
- Enable the existing redacted OpenAI assistance adapter with the user-provided
  `gpt-6-luna` credentials for the hosted demo. Deterministic policy remains
  authoritative for opt-out, sensitive/risk classification, escalation, and
  compliance; AI can only assist fields and a reviewable draft.
- Reorganize each operational screen around an explicit current case, current
  state, primary next action, and expandable evidence instead of dense parallel
  card grids.
- Make CRM escalation actions state-aware and visually separated from
  assignment, resolution, closure, retries, and delivery evidence.
- Rebuild creator content as a usable workspace with an overview, focused
  source queue, and script-review queue, independent loading states, and clear
  recovery when a request fails.
- Reset the temporary demo data after the rollout and reseed its approved
  baseline, then verify hosted role flows end to end.

## Capabilities

### Modified Capabilities

- `lead-ingestion-triage`: authenticated operators can submit arbitrary
  in-bounds messages and inspect the persisted outcome.
- `ai-assistance-observability`: the hosted demo can display successful,
  rejected, or failed redacted assistance attempts without granting model
  authority over safety decisions.
- `crm-dispositions`: the UI presents lifecycle-specific escalation actions and
  a legible audit trail.
- `creator-content-planning`: the UI provides task-oriented content views and
  partial-load/error recovery.

## Acceptance Criteria

- An authorized operator can type a message, submit it, and see timestamp,
  lead ID, decision, reason, draft or escalation, and assistance trace.
- The hosted OpenAI adapter uses the configured model with redacted input;
  failure or rejection falls back to deterministic behavior and remains visible.
- CRM shows only applicable escalation actions for a lifecycle state, visibly
  confirms each transition, and keeps delivery/retry operations separate.
- The creators page loads all healthy subsections even when one request fails,
  and exposes a clear retry control and empty-state explanation.
- All modified screens use responsive layout, semantic status feedback, and
  role-enforced API paths.
- After reset and deployment, health, login, intake, CRM, reports,
  reconciliation, content, rules, and AI trace routes are verified on the
  hosted demo.

## Out of Scope

- Changing deterministic policy or allowing AI to auto-send, publish, transfer,
  or decide consumer suitability.
- New real-data integrations, real outbound messaging, or broader hosting.
