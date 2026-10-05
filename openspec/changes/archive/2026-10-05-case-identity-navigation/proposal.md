## Why

An operator approving an intake draft cannot reliably continue with the same case in CRM. Intake links to the CRM without a case ID, the CRM defaults to `LEAD-017`, and newly ingested cases display an internal UUID while the 48 seed cases display `LEAD-001…048`. This creates a realistic wrong-case action risk and obscures the demo workflow.

## What Changes

- Give every CRM lead one stable, unique `LEAD-<number>` display label while retaining immutable UUIDs as internal keys and existing seed labels.
- Backfill existing dynamically ingested cases and allocate future labels transactionally; preserve labels across refresh and synthetic reset.
- Return the label and immutable CRM case ID in the operational API read model.
- Deep link from an intake event to its exact CRM state and back, including after draft approval. Remove the hardcoded `LEAD-017` default.
- Display the business label as the primary case name, with internal identifiers in expandable audit details and clear missing-case feedback.

## Capabilities

### Modified Capabilities

- `domain-data-baseline`: all operational leads have a consistent, stable business label.
- `lead-ingestion-triage`: processed intake results can be continued in the related CRM case.
- `crm-dispositions`: case selection resolves an exact linked lead and keeps context across refresh and filtering.

## Acceptance Criteria

- The existing hosted synthetic event `783cd6ac-caf4-5a85-bc57-65163db8a1b6` is associated with one `LEAD-<number>` label after migration and its approved draft remains linked to the same source event and CRM state.
- Seed `LEAD-001…048` labels remain unchanged. New labels are unique under concurrent ingestion and are not client-generated.
- Clicking through from an intake event opens that same CRM state, even when other leads are present; invalid or inaccessible case IDs show a clear state.
- CRM-to-intake navigation selects the originating event when one exists. UUIDs remain available for audit.
- Migration, API, and browser tests verify mapping, idempotency, deep links, refresh, filtering, and wrong-case prevention.

## Out of Scope

- Changing draft approval, message delivery, or `Info Sent` semantics. Those belong to the next work item.
- Sending real messages, changing partner integration, or changing the existing role model.

## Review Notes

This is work item 1 of the approved [UX and workflow integration review](../../../docs/planning/ux-integration-review/00_INDEX.md). The approved planning set does not itself authorize coding this OpenSpec change; review of this proposal, design, tasks, and spec deltas is required before implementation.
