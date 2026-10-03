# WI-004 verification

WI-004 accepts only synthetic CTWA or organic inbound events through the
FastAPI `/v1/ingestion/events` contract. Each event includes a source event
ID, channel, timestamp, source detail, fictional phone, consent context,
conversation-window evidence and correlation ID. n8n and the simulator only
orchestrate this boundary; they do not write business data or deliver messages.

## Safety boundary

The message is redacted before ordinary persistence views, structured logs or
assistance adapters. SSNs, account/card numbers and credential values become
typed markers. Restricted evidence is retained only for controlled server-side
processing. Analysts and the operations UI receive redacted content only.

Deterministic triage applies the active rule evidence and records exactly one
`respond`, `ignore` or `escalate_human` decision. Approved extraction is
limited to approximate debt, general debt type, state, preferred language,
preferred contact time and whether a `consejero` is requested. Detailed
financial fields are not part of the domain output.

## Fallback taxonomy

Every assistance attempt records its provider/model dimensions, status, failure
layer and normalized reason. The supported layers are `configuration`,
`transport`, `provider`, `output_validation` and `compliance`; deterministic
processing remains available when assistance is skipped, unavailable or
rejected. Logs and `/operations/ai` expose correlation and taxonomy fields,
never prompts, secrets, original message text or hidden reasoning.

## Quality gate

`scripts/evaluate_wi004.py` evaluates 48 deterministic fixtures and injected
adapter failures. Hosted output remains disabled unless one run records:

- 48/48 decisions and exact failure taxonomy records;
- complete sensitive-span recall and zero false-safe safety outcomes;
- at least 90% overall and 100% safety-critical decision agreement;
- at least 90% exact approved-field extraction;
- schema- and compliance-valid accepted output.

The current deterministic evaluation passes all thresholds. The optional
hosted adapter is not enabled by this result alone.

## Human gate and delivery scope

Substantive responses are pending editable drafts. Approval revalidates current
compliance rules and records actor, checksums and rule/template/model evidence.
Blocked content creates or updates an owned escalation. Only the three fixed
allowlisted automatic templates may create simulated effects, and WI-004 never
delivers a real message.
