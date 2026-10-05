## Data ownership

The database owns display-label allocation. Add a sequence-backed business label to `crm_lead_states` with a uniqueness constraint. Backfill dynamic states in deterministic creation order after the existing fixture range. Keep `crm_lead_states.id` and all foreign keys unchanged. The operational view returns the new label rather than falling back to `source_events.id`.

The allocation must be safe when concurrent inbound events create CRM states. Migration order must account for seed/reset fixtures and existing trigger behavior; the sequence is advanced beyond all existing labels before accepting new events.

## Case navigation

Expose the CRM state ID associated with each redacted intake event through an authenticated read model or a dedicated case lookup. Intake uses this immutable ID in a `?lead=` CRM link. CRM validates the requested ID against its loaded accessible records, keeps it selected across refresh/filter changes, and does not silently fall back to another case. The reciprocal link uses `source_event_id` to select the source event in Intake.

Show `LEAD-…` and stage in the case header. Keep UUID and correlation data in a labeled audit-details section. Preserve URL selection after mutations. Do not derive case identity by matching displayed text or phone.

## Failure and verification

If a deep-linked ID is absent or inaccessible, show an explicit message and a safe path to the case list. Section/API failures must not appear as an empty case. Test both existing backfilled records and new ingestion, including concurrent creation and replay, in a local integration database. Browser tests must assert that the selected case and displayed label match the original intake event after navigation and refresh.
