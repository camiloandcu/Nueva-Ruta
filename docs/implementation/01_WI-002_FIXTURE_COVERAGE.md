# WI-002 Fixture Coverage

All records described here are synthetic, non-contactable and unsuitable for production use. The fixed reference instant is `2026-09-15T17:00:00Z`. Lead phones use only the fictional NANP `+1 555-01xx` convention.

The machine-readable source is `supabase/fixtures/expectations.json`. It maps every lead and raw partner row to a stable fixture identifier.

## Lead matrix

| Case | Stable fixtures | Count |
|---|---|---:|
| Safe/complete | `LEAD-001`–`LEAD-008` | 8 |
| Incomplete amount/type/state/intent | `LEAD-009`–`LEAD-016` | 8 |
| Ambiguous | `LEAD-017`–`LEAD-020` | 4 |
| Risky promise/credit/rate/fee | `LEAD-021`–`LEAD-025` | 5 |
| Unsupported debt coverage | `LEAD-026`–`LEAD-030` | 5 |
| Sensitive pattern (already redacted placeholder) | `LEAD-031`–`LEAD-033` | 3 |
| Explicit opt-out | `LEAD-034`–`LEAD-036` | 3 |
| Spam/non-actionable | `LEAD-037`–`LEAD-039` | 3 |
| Replay | `LEAD-040`–`LEAD-042` | 3 |
| Organic/unattributed | `LEAD-043`–`LEAD-046` | 4 |
| Stale/after-hours | `LEAD-047`–`LEAD-048` | 2 |

## Partner defect matrix

Rows 1–30 of `IMPORT-001` cover, in order: exact duplicate, conflicting enrollment ID, phone-format variation, missing country code, phone mismatch, unmatched phone, missing/contradictory/unknown creator, date-format and date-quality problems, repeated enrollment and ambiguous link. Original source strings and checksums are immutable.
