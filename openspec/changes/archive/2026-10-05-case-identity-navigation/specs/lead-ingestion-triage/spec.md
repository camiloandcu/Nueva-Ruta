# Lead Ingestion Triage Specification

## ADDED Requirements

### Requirement: Intake case continuation

The authenticated intake experience SHALL expose the exact CRM state associated with a processed source event and provide a case-specific continuation link without revealing restricted evidence.

#### Scenario: Operator opens the linked CRM case

- **WHEN** an operator follows the CRM link from a processed intake event
- **THEN** the CRM selects the state created for that same event and displays its stable business label

#### Scenario: Linked case cannot be resolved

- **WHEN** the associated CRM state is unavailable to the operator
- **THEN** the UI shows a clear unavailable-case state and does not select a different case silently
