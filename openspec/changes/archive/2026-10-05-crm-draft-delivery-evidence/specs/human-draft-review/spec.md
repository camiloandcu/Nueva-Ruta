# human-draft-review Specification

## ADDED Requirements

### Requirement: Draft approval and simulated delivery remain distinct

An approved intake response or CRM follow-up draft SHALL remain undelivered until an authorized operator records a separate, idempotent simulated-delivery event for the same CRM case. The event SHALL preserve actor, time, approved content checksum, draft reference, and correlation evidence without sending a real message.

#### Scenario: Operator records a simulated delivery

- **WHEN** an authorized operator selects an approved draft belonging to the CRM case and records simulated delivery
- **THEN** one auditable delivery event is stored and no outbound provider call is made

#### Scenario: Draft is pending or belongs to another case

- **WHEN** an operator attempts simulated delivery for a pending draft or a draft linked to a different CRM case
- **THEN** the command rejects atomically with no delivery event or case-stage change

#### Scenario: Delivery request is replayed

- **WHEN** an accepted delivery request is repeated with its idempotency key
- **THEN** the original event is returned without a duplicate delivery
