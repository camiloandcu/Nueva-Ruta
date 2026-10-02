import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def test_fixture_expectations_cover_every_stable_lead_and_partner_row() -> None:
    expectations = json.loads(
        (ROOT / "supabase/fixtures/expectations.json").read_text(encoding="utf-8")
    )
    lead_ids = [item for case in expectations["lead_cases"].values() for item in case["ids"]]
    partner_rows = [item for rows in expectations["partner_defects"].values() for item in rows]

    assert lead_ids == [f"LEAD-{number:03d}" for number in range(1, 49)]
    assert partner_rows == list(range(1, 31))
    assert all(len(case["ids"]) >= case["minimum"] for case in expectations["lead_cases"].values())


def test_seed_contract_declares_stable_counts_and_reserved_phones() -> None:
    migration = (ROOT / "supabase/migrations/20261002010000_domain_baseline.sql").read_text(
        encoding="utf-8"
    )
    assert "generate_series(1,48)" in migration
    assert "generate_series(1,30)" in migration
    assert "generate_series(1,10)" in migration
    assert "^\\+155501[0-9]{2}$" in migration
    assert not re.search(r"(?<!5)55[2-9][0-9]{7}", migration)


def test_raw_partner_provenance_has_immutability_guard() -> None:
    migration = (ROOT / "supabase/migrations/20261002010000_domain_baseline.sql").read_text(
        encoding="utf-8"
    )
    assert "raw_partner_rows_immutable" in migration
    assert "partner_import_jobs_immutable" in migration
    assert "before update or delete" in migration
