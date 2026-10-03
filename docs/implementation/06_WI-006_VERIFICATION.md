# WI-006 Verification

## Delivered

- Added synthetic-only CSV import through FastAPI with structural limits, SHA-256 file/row checksums, immutable raw values, idempotent import identity, status and quality endpoints.
- Added versioned deterministic phone/date/creator normalization, explicit data-quality issues, duplicate and conflicting-identifier groups, canonical enrollment candidates, and conservative reconciliation using accepted shared transfer evidence or unique exact normalized phone evidence.
- Added append-only analyst/supervisor review decisions with a required reason, actor, timestamp, automatic evidence and source-row provenance. Only conflict-free reconciled enrollments contribute to the non-monetary `potentially_commissionable` proxy.
- Extended the local synthetic reset and fixtures with deterministic normalized rows, duplicate groups and reconciliation cases. Added a local n8n workflow that calls FastAPI only and a Next.js import/status/quality/review screen through the authenticated API proxy.
- Kept the scope local and synthetic: no partner service, real consumer records, monetary commission, or hosted service was added.

## Verification

- Python: `uv --cache-dir /tmp/influgain-uv-cache run pytest` — 69 passed; Ruff passed; mypy passed for 22 source files.
- Web: `pnpm --filter @nueva-ruta/web test` — 9 passed; ESLint passed; TypeScript `tsc --noEmit` passed; Prettier check passed.
- Database: `npx supabase test db` — 6 files, 145 pgTAP tests passed; `npx supabase db lint --local --level error` passed with no findings.
- OpenSpec: `openspec validate wi-006-partner-import-cleaning-reconciliation --strict --no-interactive` passed before archive.

## Scope and operational notes

The local Supabase database received the additive WI-006 migrations and was tested without running a full destructive database reset. The pgTAP suite exercises deterministic reset behavior transactionally. The synthetic-only upload declaration is enforced server-side; partner files containing real data are not accepted by this local demo flow. The Python suite emitted four existing Starlette/httpx deprecation warnings; all tests passed.
