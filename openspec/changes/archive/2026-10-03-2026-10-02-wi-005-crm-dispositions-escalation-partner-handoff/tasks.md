## 1. Persistence and State Contracts

- [x] 1.1 Define strict API/domain schemas for the five dispositions, escalation actions, transfer approval, delivery status and actionable error codes.
- [x] 1.2 Add the Supabase migration for disposition audit, escalation lifecycle evidence, transfer approval/records, transactional outbox and append-only attempts with idempotency/uniqueness constraints.
- [ ] 1.3 Extend deterministic reset and synthetic fixtures for disposition prerequisites, missing phone, callback validation, escalation SLA and delivery outcome modes.
- [x] 1.4 Add database transition/constraint tests proving invalid commands leave state unchanged and commercial/escalation/delivery states remain independent.

## 2. Escalation Lifecycle

- [x] 2.1 Implement assignment, claim, reassignment, SLA due/breach and authorized resolution/closure services with audit evidence.
- [x] 2.2 Add FastAPI escalation queue/detail and lifecycle command contracts with role enforcement and safe redacted response models.
- [x] 2.3 Add API tests for ownership, supervisor authority, idempotent resolution and independent commercial stage.

## 3. CRM Dispositions and Transfer Gate

- [x] 3.1 Implement explicit operator qualification plus the five disposition mappings, follow-up draft generation and atomic audit/outbox behavior.
- [x] 3.2 Implement explicit authorized transfer approval, transactional transfer/outbox creation and duplicate-command protection.
- [x] 3.3 Add FastAPI disposition and transfer approval contracts; test missing phone, invalid disposition, callback time, opt-out evidence and role failures.
- [x] 3.4 Prove disposition text, pre-qualification and escalation resolution cannot independently authorize transfer.

## 4. Outbox, Simulator and n8n

- [x] 4.1 Implement bounded outbox claiming, append-only attempt records, configurable bounded retry/backoff and terminal dead-letter handling.
- [x] 4.2 Implement authorized audited manual replay that preserves one logical transfer and refuses replay of successful effects.
- [x] 4.3 Extend the simulator contract with deterministic success, retryable and permanent failure modes plus partner idempotency behavior.
- [ ] 4.4 Export n8n disposition and partner-transfer workflows with correlated success/retry/failure/replay branches calling FastAPI only.
- [x] 4.5 Add API/simulator contract and database integration tests for successful handoff, retry, DLQ and replay.

## 5. Operational UI and Verification

- [x] 5.1 Add the lead disposition UI and escalation queue/detail with assignment, ownership, SLA and documented resolution actions.
- [x] 5.2 Add delivery history and safe recovery controls for missing phone, invalid disposition, webhook failure, exhausted retry and manual replay.
- [ ] 5.3 Add UI/API tests for role boundaries, state independence, error recovery and no duplicate partner effect.
- [x] 5.4 Document WI-005 semantics, retry/replay policy and synthetic-only delivery boundary in the workflow README and verification report.
- [x] 5.5 Run focused verification; record evidence in `docs/implementation/05_WI-005_VERIFICATION.md`.
- [x] 5.6 Archive WI-005 and sync its specifications, then validate the resulting main specs.
