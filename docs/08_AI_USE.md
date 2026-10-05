# AI Use and Operator Guardrails

## Purpose and mode

AI is optional assistance for redacted structured extraction, summaries and substantive response drafts. Deterministic rules remain authoritative, including obvious classification, opt-out, compliance validation and human gates. Use `AI_PROVIDER=deterministic` for repeatable local/hosted demos and WI-009 load runs; this mode makes no model request and has no model usage charge.

An optional provider adapter exists for development evaluation. A configured provider/model does not change the product boundary: all outputs are schema-checked, checked against prohibited claims, and remain drafts. The system must continue to ingest when assistance is unavailable and record whether the path was intentionally skipped, succeeded, failed, or rejected.

## Data and decision boundary

- Redact likely SSNs, account/card numbers and credential text before any provider request.
- Send only minimum redacted message context. Do not send real consumer data in this prototype.
- Do not use AI to decide eligibility, provide individualized financial/legal/tax advice, set policy, publish a message, approve a transfer, or resolve an attribution conflict.
- A person reviews substantive drafts. A supervisor controls rule publication, protected reset and sensitive recovery actions.
- Fixed allowlisted receipt, after-hours and opt-out confirmations are not AI-authored.

## Failure visibility

Use `correlation_id`, `decision_source`, `ai_attempt_status`, `failure_layer` and `normalized_reason` to distinguish deterministic behavior from provider configuration/connectivity, provider, schema and compliance failures. Review the supervisor-only AI operations page for detailed safe attempt metadata. Do not copy raw prompts, secrets, or original sensitive text into tickets or logs.

## Demo checklist

1. Confirm `AI_PROVIDER=deterministic` in the runtime configuration without printing API keys.
2. Use only fictional fixture text and synthetic identities.
3. Show a reviewed draft and a deterministic escalation, not an autonomous decision claim.
4. If demonstrating optional provider failure, use the simulator's deterministic failure mode; do not require a live model call.
5. Before recording, scan terminal/browser output for credentials and close provider dashboards.

This is an engineering usage boundary, not legal advice or production authorization. See [compliance and AI policy](planning/06_COMPLIANCE_AND_AI.md).
