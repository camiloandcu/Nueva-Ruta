# WI-002 Verification Evidence

Date: 2026-10-02 (America/Bogota)

## Completed checks

- `UV_CACHE_DIR=/tmp/influgain-uv-cache pnpm quality`: passed.
  - Prettier and ESLint passed.
  - Ruff and strict mypy passed.
  - Two web architecture tests and 14 Python tests passed.
  - Repository boundary and tracked-secret checks passed.
- `pnpm exec openspec validate wi-002-domain-schema-roles-synthetic-baseline --strict`: passed.
- `git diff --check`: passed before the implementation commits.
- `make reset`: passed against Supabase local after explicit authorization; both migrations and `supabase/seed.sql` applied and three local demo identities were mapped to application roles.
- `make test-db`: passed through the Supabase pgTAP runner (`1` live database test file, `1` planned test, `0` failures).

The automated tests cover stable fixture identifiers and coverage minima, the reserved phone convention, raw provenance immutability declarations, valid/invalid/unmapped authentication outcomes, role denial, analyst message minimization, exact reset confirmation and stable reset result counts. `supabase/tests/domain_baseline_test.sql` verified live-database counts, invalid relationship rejection, immutable raw provenance, denied reset safety, two identical reset hashes and two retained audit events.

## Runtime verification result

The Product Owner explicitly authorized rebuilding the disposable local Supabase database/Auth state. The reset completed from the two ordered migrations and deterministic seed, after which the bootstrap created or updated the operator, supervisor and analyst identities. The database test ran both successful reset invocations inside a rolled-back test transaction, proving identical baseline hashes and retained audit evidence without leaving test audit rows in the working database.

OpenSpec archive, specification sync and post-archive validation are recorded separately in the closing commit.
