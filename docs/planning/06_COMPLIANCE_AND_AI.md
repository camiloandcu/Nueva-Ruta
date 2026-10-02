# Compliance and AI Boundary — Nueva Ruta Ops

Status: approved by human (2/10/2026 12:56 p.m. COL)

Scope: fictional prototype guidance, not legal advice or production approval.

## Product boundary

Nueva Ruta performs marketing intake, routing and minimum pre-qualification. Consejería Clara's consejero performs the detailed financial review and determines whether a DMP could be appropriate.

The system must not blur DMP with debt settlement, consolidation, credit repair or a loan. A DMP generally involves a credit counseling organization and a payment plan for applicable debts; it does not erase debt. Real suitability depends on individual review.

## Required language

- Partner personnel: `consejero`, never `asesor`.
- Savings and payment effects: conditional phrases such as `podria`, `en algunos casos` or `dependiendo de la situacion y de los acreedores`.
- Nueva Ruta may explain that a consejero can review options.
- Nueva Ruta must not state that a lead qualifies or that a DMP is their best/only option.

## Prohibited or controlled claims

The system SHALL block or escalate:

- guaranteed savings or payment reduction;
- guaranteed approval, enrollment or creditor acceptance;
- guaranteed improvement to credit score;
- invented rates, fees, percentages, scores or timelines;
- instructions to stop paying or contacting creditors;
- claims that debt will disappear;
- legal, tax or individualized financial advice;
- urgency or scarcity invented to pressure the lead;
- claims that fictional stories are real testimonials;
- claims of nationwide partner coverage not supported by an approved rule.

Questions about credit impact, lawsuits, garnishment, bankruptcy, taxes, identity theft, threats or self-harm require human escalation appropriate to the configured reason.

## Automatic-message allowlist

Only three message purposes are automatic:

### Receipt plus privacy warning

Purpose: confirm receipt and set safe expectations. It may state that the team will review the message and that the lead should not share SSN, passwords or full account numbers in chat.

### After-hours acknowledgement

Purpose: confirm receipt outside Monday–Friday, 09:00–18:00 America/New_York. It may state the fictional operating hours without promising an exact outcome.

### Opt-out confirmation

Purpose: confirm that ordinary messaging will stop after clear words such as `STOP`, `PARAR`, `BAJA` or `NO ME ESCRIBAN`.

All three are fixed, versioned and approved. AI cannot write or personalize them. A feature flag can disable all automatic messaging.

## Human review matrix

| Content/action | Automatic | Draft + human | Escalate |
|---|---:|---:|---:|
| fixed receipt/privacy acknowledgement | yes | no | only on delivery/security error |
| fixed after-hours acknowledgement | yes | no | only on delivery/security error |
| fixed opt-out confirmation | yes | no | ambiguity may escalate |
| request for missing approximate amount/type/state | no | yes | if contradictory/risky |
| program details or possible benefit | no | yes | if claim cannot be safely answered |
| credit impact, legal or tax question | no | no | yes |
| SSN/account/credential in message | no | no | yes, with redaction |
| partner transfer | no | explicit approval | yes when coverage/eligibility policy is unclear |

## Data minimization

Nueva Ruta stores only what it needs for acquisition, routing and attribution:

- fictional phone;
- channel/source/creator;
- state;
- language and contact preference;
- approximate amount or range;
- general debt type;
- desire to speak with a consejero;
- consent and opt-out evidence;
- partner case/enrollment references and minimum reconciliation fields.

Consejería Clara, not Nueva Ruta, would own detailed intake such as income, expenses, creditors, account details and authorized credit information in a real secure process.

## Sensitive-data handling

1. Detect likely SSN, full account/card numbers and credential language at ingestion.
2. Persist only what the synthetic fixture and test design require.
3. Replace sensitive spans with typed markers for ordinary UI and logs.
4. Send only redacted text to AI.
5. Create a high-priority supervisor escalation.
6. Restrict any raw test representation to the minimum role and retention needed.

The demo uses no real PII.

## AI responsibilities

AI may:

- extract the approved minimal fields into a validated schema;
- summarize a message for a person;
- propose a classification reason;
- draft substantive text for review;
- propose content scripts linked to sources.

AI may not:

- be the authoritative decision engine;
- determine real DMP eligibility;
- override a deterministic rule;
- publish or transfer;
- invent missing financial facts;
- choose a creator attribution during conflict;
- change rules;
- receive unredacted sensitive content.

## AI processing sequence

```text
inbound text
  → deterministic triggers and opt-out
  → sensitive-data redaction
  → provider-neutral structured request
  → schema validation
  → confidence/completeness policy
  → deterministic language post-filter
  → draft, deterministic outcome or human escalation
```

The hosted provider is optional. The first candidate is OpenAI Responses API. Model configuration remains replaceable; availability and pricing are checked at implementation time. A deterministic fallback keeps ingestion and obvious rule decisions working with no key.

## AI outcome and fallback observability

A developer must be able to distinguish an intentional deterministic path, a provider/connectivity problem and a model-output/instruction-contract problem without reading raw prompts or guessing from the final decision.

Every decision records:

- `decision_source`: `deterministic_only`, `ai_assisted` or `deterministic_fallback`;
- `ai_attempt_status`: `not_requested`, `skipped_configuration`, `succeeded` or `failed`;
- `failure_layer`: `none`, `configuration`, `transport`, `provider`, `output_validation` or `compliance`;
- one normalized reason code;
- the resulting draft, escalation or deterministic decision.

Normalized reason codes include:

| Category | Reasons |
|---|---|
| Intentional | `deterministic_rule_decisive`, `automatic_template`, `ai_disabled_by_policy` |
| Configuration | `missing_api_key`, `budget_guard` |
| Connectivity/provider | `dns_or_connection`, `timeout`, `authentication`, `rate_limit`, `provider_5xx` |
| Output/instructions | `invalid_json`, `schema_invalid`, `required_field_missing`, `low_confidence`, `prompt_contract_violation`, `prohibited_language` |

`prompt_contract_violation` means the output violated the versioned contract; it flags the model/schema/instructions for investigation but does not falsely assert that the prompt alone caused the problem.

The developer experience SHALL include:

- an append-only `ai_attempts` table linked by correlation ID;
- safe HTTP/provider code, latency and attempt timestamps;
- provider, model and logical prompt version;
- schema and compliance validation result;
- token/cost metadata when available;
- a Next.js timeline badge and filterable `/operations/ai` view;
- distinct n8n branches for success, technical failure, output-quality failure and intentional deterministic processing;
- structured logs and counters using the same categories.

No view or log stores secrets, unredacted sensitive text or hidden reasoning.

## AI evaluation

Before enabling hosted output in the main demo:

- run all 48 lead fixtures;
- verify structured-field accuracy against expected labels;
- calculate decision agreement separately for safe, ignore and escalation cases;
- record false-safe errors as the highest-severity failure;
- verify all sensitive spans are redacted before the request;
- verify forbidden language after the response;
- compare difficult Spanish drafts when more than one model is available;
- choose the lightest model that meets the defined quality gate;
- record latency and estimated spend;
- test timeout, invalid JSON/schema, provider error and budget-disable fallback.
- assert the exact execution state, failure layer and normalized reason for every fallback fixture.
- verify the operations view distinguishes connectivity/provider faults from rejected model output and intentional no-AI paths.

The exact pass threshold is set in WI-004 before implementation of the live adapter and must be reviewed in that OpenSpec proposal.

## Audit evidence

For each AI-assisted result, store:

- provider and model identifier;
- logical prompt/template version, not hidden reasoning;
- request/response timestamps and latency;
- token/cost metadata when available;
- redaction applied flag;
- schema validation result;
- post-filter result;
- decision source, attempt status, failure layer and normalized reason;
- final human or deterministic disposition.

Do not store chain-of-thought or secrets.

## Production validation gaps

The following remain unknown and must not be inferred from the prototype:

- real partner state coverage and licensing;
- exact DMP debt type/amount policies;
- approved disclosures and retention periods;
- real consent evidence and follow-up permissions by channel;
- partner transfer/enrollment/commission contract;
- provider data-processing terms appropriate to production data.

## Evidence consulted

Checked 2026-10-02:

- CFPB, “What is credit counseling?”: https://www.consumerfinance.gov/ask-cfpb/what-is-credit-counseling-en-1451/
- CFPB, distinction between counseling, settlement, consolidation and repair: https://www.consumerfinance.gov/ask-cfpb/what-is-the-difference-between-credit-counseling-and-debt-settlement-debt-consolidation-or-credit-repair-en-1449/
- FTC, “How To Get Out of Debt”: https://consumer.ftc.gov/articles/how-get-out-debt
- FTC, debt relief services and Telemarketing Sales Rule guide: https://www.ftc.gov/business-guidance/resources/debt-relief-services-telemarketing-sales-rule-guide-business
- FTC, protecting personal information: https://www.ftc.gov/business-guidance/resources/protecting-personal-information-guide-business
- WhatsApp behavior documented by Twilio, including the 24-hour customer-service window: https://www.twilio.com/docs/whatsapp/api
- OpenAI model selection: https://developers.openai.com/api/docs/guides/model-selection
- OpenAI production practices: https://developers.openai.com/api/docs/guides/production-best-practices
