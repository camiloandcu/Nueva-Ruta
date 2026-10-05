# CRM Dispositions Specification

## ADDED Requirements

### Requirement: Exact CRM case selection

The CRM interface SHALL honor an authorized deep-linked immutable CRM state ID, retain it across refresh and filters, and display the business label as the primary identifier. For source-event cases, it SHALL link back to the matching intake evidence.

#### Scenario: Deep-linked case is present

- **WHEN** the CRM opens with a valid case ID while other leads exist
- **THEN** only that case is selected, its label and stage are visible, and subsequent actions target that immutable ID

#### Scenario: Deep-linked case is missing

- **WHEN** the CRM opens with an invalid or inaccessible case ID
- **THEN** the interface explains that the requested case is unavailable and does not silently select a seed case
