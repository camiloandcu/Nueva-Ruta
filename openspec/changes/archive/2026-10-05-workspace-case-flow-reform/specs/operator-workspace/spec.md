# operator-workspace Specification

## ADDED Requirements

### Requirement: Task-oriented and role-aware entry

The authenticated home SHALL present Bandeja, Casos, Operación, Resultados and Administración as task destinations available to the signed-in role, preserving existing route URLs.

#### Scenario: Operator opens a case from the task path

- **WHEN** an operator opens Bandeja, selects an intake event and follows its CRM link
- **THEN** the exact `LEAD-…` case opens with its stage and next eligible action visible

#### Scenario: Analyst opens the workspace

- **WHEN** an analyst signs in
- **THEN** only permitted reporting, reconciliation and content destinations are offered, without links to restricted business commands

### Requirement: Case context and global queue scope

The case workspace SHALL identify the selected case by its persistent business label and show case-specific message, activity and history separately from global operational queues. Every global record linked to a CRM state SHALL identify and link to its own case; an unlinked record SHALL state that relationship is unavailable.

#### Scenario: A global item belongs to another case

- **WHEN** the selected case differs from a global escalation or recovery item's linked case
- **THEN** the item displays its own `LEAD-…` label and link and is not presented as selected-case history

#### Scenario: Case selection changes

- **WHEN** an operator selects another case or follows a deep link
- **THEN** case-specific evidence and action inputs update to that case while its UUID remains in the URL

### Requirement: Understandable and recoverable interface states

Known stages and statuses SHALL have consistent Spanish display labels. Independent sections SHALL expose loading, empty, failure and retry states. A failed section SHALL NOT clear successful sections or discard entered action values, and controls SHALL remain keyboard usable at desktop and narrow widths.

#### Scenario: One queue request fails

- **WHEN** a global queue request fails while the selected case loads
- **THEN** the case remains usable and that queue shows a local error and retry control

#### Scenario: Operator navigates by keyboard on mobile

- **WHEN** an operator uses keyboard focus at a 390 px viewport
- **THEN** the primary case action, queue links and section controls remain reachable, visible and meaningfully labeled
