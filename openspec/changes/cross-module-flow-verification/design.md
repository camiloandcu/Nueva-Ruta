## Test boundary

Use the local Compose/Supabase stack and Playwright authenticated sessions. Keep hosted checks read-only unless a later approved release step explicitly calls for mutation. The existing API and SQL guards remain authoritative; browser assertions confirm that their outcomes are visible and linked to the right case.

## Journey matrix

| Journey | Actor | Observable result | Authoritative check |
| --- | --- | --- | --- |
| Intake → approval → CRM | Operator | Same `LEAD-…`, approved and undelivered draft | Case-linked draft read model |
| Qualification → delivery → disposition | Operator | Separate delivery evidence before `Info Sent` | Delivery event and disposition history |
| Escalation assignment → review → resolution | Supervisor and assigned operator | Named owner and correct available action | Escalation state and audit event |
| Follow-up draft | Operator | Case-specific approved draft and delivery status | Draft ownership and approval record |
| Transfer → retry/recovery | Operator and supervisor as authorized | Attempt and recovery state remain traceable | Outbox attempts and transfer state |
| Partner import → reconciliation → report | Operator/analyst by permission | Row quality and match outcome beside enrollment | Source rows, reconciliation, and report snapshot |
| Role and wrong-case boundaries | All three roles | Denied command and clear UI state | No unauthorized mutation |

## Implementation sequence

1. Inventory current API/UI operations and fixtures against the matrix. Reuse existing tests where they already prove a boundary; add only missing journeys.
2. Make test data deterministic and isolate synthetic mutations using unique correlation/idempotency values. Avoid resetting a shared local database after the user has asked to keep the service running; use a disposable test fixture or scoped records when practical.
3. Run each new journey locally, fix any reproduced defect in the smallest owning module, and add a targeted regression assertion for the failure.
4. Re-run the full quality and browser suite, inspect desktop/mobile results for affected UI, verify service health, and record exact coverage and limits in `docs/implementation/`.

## Risks and decisions

- The partner simulator and local n8n path may require seeded policy or timing. Tests should wait on domain state with bounded polling instead of fixed sleeps.
- Cross-role sessions must use separate browser contexts so authorization and visible state cannot leak between users.
- API assertions should use authenticated public contracts or scoped read-only database checks; tests must never infer success solely from a toast.
- The `analyst` role is a reporting/reconciliation role and is not an escalation assignee under the current database guard. A role change would require a separate product decision.
