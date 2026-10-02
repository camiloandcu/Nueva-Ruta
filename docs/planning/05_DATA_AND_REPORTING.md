# Data and Reporting — Nueva Ruta Ops

Status: approved by human (2/10/2026 12:56 p.m. COL)

## Data principles

1. All bundled data is synthetic and visibly labeled.
2. Raw source values are immutable.
3. Normalization never erases provenance.
4. Reconciliation expresses evidence and uncertainty.
5. Reporting derives from governed facts rather than repairing them silently.
6. Attribution and enrollment are separate dimensions.
7. Potential commission eligibility is a proxy, not a payment decision.

## Synthetic lead dataset

Target: 48 chat rows, exceeding the required minimum of 40.

Required columns:

- `lead_id`
- `timestamp`
- `creator_id`, nullable for organic
- `channel`: `CTWA` or `organic`
- `source_detail`
- `lead_message`
- fictional `phone`
- `initial_status`
- consent/conversation evidence fields needed by the simulator

Phones use reserved-looking fictional NANP values in the `555-01xx` pattern. Documentation must state that fixtures are not contactable consumers.

Coverage matrix:

| Case | Minimum examples |
|---|---:|
| safe/complete pre-qualification | 8 |
| missing amount/type/state or intent | 8 |
| ambiguous request | 4 |
| promise/credit/rate/fee question | 5 |
| secured, tax, business, legal or student debt | 5 |
| sensitive data pattern | 3 |
| explicit opt-out | 3 |
| spam/non-actionable content | 3 |
| duplicate/replayed event | 3 |
| organic unattributed | 4 |
| seeded stale/after-hours states | overlap allowed |

The dataset should exercise all classification decisions and demonstrate both supported and coverage-review states.

## Fictional creator profiles

All identities and handles below are synthetic working definitions. Final fixture copy may be refined without changing their intended segments.

### CR-001 — Ana Rivera / `@CuentasConAna`

- Platforms: Instagram Reels, TikTok.
- Audience: bilingual young families organizing household finances.
- Voice: calm, practical, nonjudgmental.
- Pillars: budgeting habits, organizing bills, questions to ask before seeking help.
- CTA: invite a private information request, never promise acceptance.
- Attribution: `creator_id=CR-001`, campaign/link tags.
- Risk note: avoid implying that organization alone changes debt terms.

### CR-002 — Miguel Soto / `@DineroSinVueltas`

- Platform: TikTok.
- Audience: Spanish-dominant working adults seeking plain-language explanations.
- Voice: direct, energetic and simple.
- Pillars: debt vocabulary, myths, preparing for a conversation with a consejero.
- CTA: “conoce tus opciones” with conditional language.
- Risk note: direct tone must not become certainty or urgency pressure.

### CR-003 — Sofia Torres / `@HogarConRumbo`

- Platform: Instagram.
- Audience: parents balancing medical and credit-card obligations.
- Voice: empathetic storytelling.
- Pillars: family conversations, document organization, common questions.
- CTA: request information privately.
- Risk note: stories are fictional composites, not testimonials or representative outcomes.

### CR-004 — Diego Mendoza / `@FinanzasDeBarrio`

- Platform: YouTube Shorts.
- Audience: adults preferring educational, step-by-step explanations.
- Voice: measured and explanatory.
- Pillars: DMP versus settlement/consolidation, what a consejero does, process expectations.
- CTA: learn and speak with a consejero.
- Risk note: category comparisons must avoid legal/financial recommendations.

### CR-005 — Valeria Cruz / `@PasoAPasoConVale`

- Platforms: Instagram Reels, TikTok.
- Audience: women managing household finances and seeking low-pressure guidance.
- Voice: warm, encouraging and concise.
- Pillars: reducing shame, preparing questions, recognizing risky promises.
- CTA: start an informational chat.
- Risk note: emotional reassurance cannot imply guaranteed financial relief.

## Partner enrollment dataset

Target: 30 rows, exceeding the required minimum of 25.

Suggested fields:

- `partner_enrollment_id`
- `partner_case_id`, sometimes missing
- `enrollment_date_raw`
- `phone_raw`
- `creator_id_raw`
- `status_raw`
- limited fictional attributes needed for reconciliation

Deliberate defects:

- exact duplicate row;
- duplicated enrollment ID with changed fields;
- same phone in several formats;
- missing country code;
- one-digit phone error;
- phone that maps to no lead;
- blank creator ID;
- creator contradicting original lead attribution;
- unknown creator ID;
- ISO, US-formatted and ambiguous dates;
- impossible date;
- future date;
- blank date;
- repeated enrollment for one lead;
- enrollment with multiple possible leads.

## Data layers

### Raw

Stores import job, filename, file checksum, row number, row checksum and source strings. Never edited.

### Normalized

Adds parsed timestamp candidates, normalized phone, normalized creator ID and structured quality flags. Preserves the raw link.

### Canonical

Groups duplicate source occurrences into a business candidate without deleting any occurrence. Selection policy and evidence are recorded.

### Reconciliation

Stores candidate lead links, match method, evidence, conflict flags, confidence category, review status, reviewer and reason.

### Reporting

Uses reconciled/canonical facts and explicitly includes unmatched/conflicted categories.

## Phone normalization policy

- Preserve raw text.
- Remove presentation punctuation only in normalized copy.
- Recognize explicit US `+1` and ten-digit forms.
- Do not invent missing digits.
- Do not fuzzy-match phone numbers automatically.
- A one-digit mismatch may be surfaced as a review hint, never an automatic match.

## Date policy

- Store parsed timestamps in UTC when a timezone/format is unambiguous.
- Preserve original date string.
- Configured known formats may be parsed deterministically.
- Ambiguous month/day values remain unresolved unless independent evidence makes them deterministic.
- Impossible or future enrollment dates generate quality issues.

## Duplicate policy

- Exact duplicates: retain all occurrences, link to one canonical candidate and report frequency.
- Same business ID with conflicting content: create conflict, not last-write-wins.
- Same phone/date but distinct partner IDs: preserve both and require business review when needed.

## Reconciliation evidence levels

| Level | Evidence | Automatic outcome |
|---|---|---|
| exact ID | unique shared partner/transfer ID | match if no contradiction |
| exact phone | unique normalized phone plus compatible evidence | match if no contradiction |
| ambiguous | multiple candidates or incomplete evidence | review required |
| conflict | creator/ID/phone evidence disagrees | review required |
| unmatched | no viable candidate | remain unmatched |

`creator_id_raw` from the partner never overrides original lead attribution by itself.

## Funnel definitions

| Metric | Definition |
|---|---|
| received | unique accepted lead events after idempotency |
| prequalified | minimal fields present and no unresolved blocking rule |
| transfer approved | authorized operator approved handoff |
| partner accepted | simulated webhook returned accepted case ID |
| enrollment reported | canonical partner record indicates enrollment |
| enrollment reconciled | reported enrollment linked to one lead with resolved evidence |

Conversion denominators must be visible. Creator comparisons should not imply causation.

## Operational metrics

- Leads by creator, channel, source detail, state and time.
- Decision distribution and escalation reasons.
- Time to first decision and human review.
- Draft backlog and approval time.
- Leads stalled by current stage.
- Open/breached escalations and percent resolved within configured SLA.
- Webhook success, retries, dead letters and recovery time.
- Partner import quality issues by type.
- Exact, ambiguous, conflicting and unmatched reconciliation counts.
- Missing creator IDs and phone mismatch counts.

## Commission proxy

`potentially_commissionable = enrollment_reported AND reconciliation_matched AND creator_attribution_resolved AND no_open_conflict`

The proxy:

- does not calculate dollars;
- does not authorize payment;
- does not claim contractual eligibility;
- remains false while attribution is ambiguous;
- reports the blocking reason.

## What breaks commissions

- Null creator ID can prevent direct campaign attribution.
- Contradictory creator ID can pay the wrong source if trusted blindly.
- Phone mismatch can separate the enrollment from its originating lead.
- Duplicates can count one enrollment multiple times.
- Ambiguous or future dates can assign performance to the wrong period.
- Organic traffic may be incorrectly credited to a creator.
- Missing shared transfer IDs forces weaker matching.
- Silent normalization can conceal data-quality defects.

The reporting layer must show both business volume and the subset safe enough for the proxy.

## Stalled reporting

Each row shows:

- entity and link;
- current stage/reason;
- current age;
- configured threshold and rule version;
- owner;
- last meaningful activity;
- next action.

Seed data must contain within-SLA, approaching-SLA and breached examples.

## Report validation

- Metric tests use fixed fixture expectations.
- Reconciliation cases have known expected outcomes.
- Aggregate counts reconcile to source categories.
- Filters do not remove unmatched or organic data silently.
- Each dashboard enrollment links to reconciliation and raw provenance.
- Cleaning documentation is generated from implemented policy, not reverse-engineered after the demo.
