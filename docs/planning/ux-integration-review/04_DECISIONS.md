# Proposed decisions

1. **Label:** Use a stable sequence-backed `LEAD-<number>` display ID for every CRM state. Preserve UUIDs as internal keys and existing `LEAD-001…048` labels. Exact width can grow beyond three digits. Reason: readable and unique across seeded and newly ingested cases.
2. **Evidence:** Show approved intake and follow-up drafts in one case-specific picker, but require an additional delivery or manual-action record to claim `Info Sent`. Reason: the current approval explicitly says no message was sent, and the CRM spec requires delivery evidence.
3. **Navigation:** Deep link by immutable CRM UUID, display by business label. Reason: links survive label changes and avoid ambiguous case matching.
4. **Rollout:** Repair the case path and data contract before reshaping the home and long CRM page. Reason: navigation and UX must rest on a reliable case relationship.
5. **Verification:** Treat source tests as baseline only; require real browser E2E plus database assertions for completion. Reason: current tests cannot catch the reported picker omission.

Open for product-owner review: whether an approved draft should be used to create a distinct simulated delivery action in this prototype, or whether the only supported `Info Sent` route should be a documented manual action. Both preserve the approval/delivery separation. The recommended option is a distinct simulated delivery action so the demo visibly completes the workflow.
