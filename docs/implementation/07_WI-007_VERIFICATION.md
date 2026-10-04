# WI-007 Verification

Date: 2026-10-04
Branch: `feat/wi-007-funnel-stalled-attribution`

## Delivered

- Added schema-version-2 stalled-work thresholds as a new immutable active rule version; version 1 remains unchanged and inactive.
- Persisted original creator attribution on source events and kept organic attribution null unless supplied by source evidence.
- Added a role-checked, read-only reporting fact RPC and minimized enrollment evidence RPC, exposed through authenticated FastAPI endpoints.
- Added the Spanish operations report for received-to-reconciled funnels, timing, backlog, delivery, stalled work, quality and attribution blockers.
- Added bounded stalled-work pagination with validated API limit/offset and previous/next UI controls.
- Extended deterministic reset cases with three callback and three `Info Sent` timing examples. Reset does not pre-create partner transfers or outbox delivery work.
- Added metric, filter, empty-denominator, privacy, role, provenance and UI contract coverage.

## Verification results

- `npx supabase test db` — passed, 168 pgTAP assertions across 7 files.
- `uv --cache-dir /tmp/influgain-uv-cache run pytest` — passed, 77 tests (4 existing Starlette deprecation warnings).
- `pnpm --filter @nueva-ruta/web test` — passed, 10 UI architecture/contract tests.
- `pnpm --filter @nueva-ruta/web build` — passed; `/operations/reports` is included in the production route output.
- `pnpm --filter @nueva-ruta/web typecheck` and `uv --cache-dir /tmp/influgain-uv-cache run mypy apps/api/src apps/simulator/src` — passed.
- `pnpm --filter @nueva-ruta/web lint` and `uv --cache-dir /tmp/influgain-uv-cache run ruff check .` — passed.
- `pnpm --filter @nueva-ruta/web format` — passed.
- `openspec validate wi-007-funnel-stalled-attribution-reporting --strict --no-interactive` — passed before archive; `openspec validate --all --strict --no-interactive` — passed, 13 specs.
- `uv --cache-dir /tmp/influgain-uv-cache run python scripts/verify_repository.py` — passed after correcting the verifier to scan Git-tracked and non-ignored files, avoiding false positives from ignored local credentials while still checking staged/untracked deliverables.

## Metric and data checks

- Lead cohort filters use received time; partner enrollment/import and quality totals remain independently counted.
- The reporting unit test reconciles the fixture's full partner total to its distinct reconciled, ambiguous, conflicting and unmatched categories (2 = 1 + 1 + 0 + 0), while the proxy includes only the single explicitly eligible case.
- Empty lead/enrollment cohorts return zero counts and unavailable conversion percentages rather than fabricated zero-percent rates.
- Database tests verify all 28 canonical partner cases remain represented, historical rule v1 remains immutable, safe reporting excludes raw phone/source values and message content, and source-event creator attribution persists.
- Evidence API tests verify raw phone values and raw partner values are removed while source row numbers and safe provenance references remain.

## Notes

- Existing local migrations `20261002090000` and `20261002090100` were applied and tested against the local Supabase database; no destructive database reset was run for this verification.
- The local `.env` remains ignored, unchanged, and excluded from the PR. Force-added/tracked secrets remain covered by the repository scan.
