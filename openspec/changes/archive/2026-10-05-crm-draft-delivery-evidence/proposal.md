## Why

The reported intake event `783cd6ac-caf4-5a85-bc57-65163db8a1b6` has an approved response draft, but the CRM form only lists approved CRM follow-up drafts. The database accepts the intake draft as a reference, yet the UI cannot select it. More seriously, draft approval explicitly records **no delivery** while the current `Info Sent` disposition can accept approval alone. The approved product design requires a distinct simulated-delivery action or a documented manual action before claiming information was sent.

## What Changes

- Provide a case-specific CRM evidence read model containing approved intake response drafts, approved CRM follow-up drafts, and their delivery state. Show origin, safe content preview, approval time, and an explicit undelivered label.
- Add an idempotent, audited **record simulated delivery** command for an approved draft belonging to the selected CRM lead. It records evidence only; no network message is sent.
- Require linked simulated-delivery evidence or a documented manual action for future `Info Sent` dispositions. Approval alone is insufficient. Reject cross-lead, pending, opted-out, or duplicate/invalid references without changing stage.
- Make the CRM action form stage-aware: guide qualification first for `under_review`, reveal only fields relevant to the selected disposition, and show actionable error and success states.
- Preserve historical disposition/audit records without inventing delivery evidence for legacy `approved_draft` entries.

## Capabilities

### Modified Capabilities

- `human-draft-review`: an approved draft remains undelivered until a separate authorized simulated-delivery event is recorded.
- `crm-dispositions`: case-specific draft selection, explicit delivery evidence, and correct `Info Sent` eligibility.

## Acceptance Criteria

- Once the first migration is deployed, the reported event's approved response draft appears in CRM for its own `LEAD-…` case, labelled as an intake draft and undelivered. It never appears for another lead.
- An operator can qualify the case, record a simulated delivery for that draft, then record `Info Sent` referencing the delivery; the timeline shows all three distinct steps.
- Approval alone, a pending draft, another lead's draft, or an unmatched delivery cannot produce an `Info Sent` disposition or stage change. A documented manual action remains a separate valid path.
- Duplicate delivery commands replay idempotently. No real outbound network call occurs. The action records actor, time, draft checksum, case, and correlation ID.
- Database, API, and authenticated E2E tests cover the successful path, wrong-lead and invalid-state rejection, reload, and historical evidence display.

## Out of Scope

- Real WhatsApp/email sending, partner transfer delivery, or retroactive rewriting of existing disposition history.
- The broader home/navigation and queue redesign in work item 3.

## Review Notes

This is work item 2 of the [approved integration review](../../../docs/planning/ux-integration-review/00_INDEX.md). The simulated-delivery option was selected in that review. This OpenSpec change must be reviewed before implementation under the project's proposal workflow.
