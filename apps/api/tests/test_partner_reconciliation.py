from datetime import UTC, datetime

import pytest
from nueva_ruta_api.partner_reconciliation import (
    CsvImportError,
    build_analysis,
    normalize_phone,
    parse_date,
    parse_partner_csv,
)


def test_csv_parser_preserves_original_headers_values_and_is_idempotent() -> None:
    content = b"enrollment_id, phone ,creator_id\nENR-1, +1 555-0100 ,cr-001\n"
    rows, checksum = parse_partner_csv(content)
    assert rows == [{"enrollment_id": "ENR-1", " phone ": " +1 555-0100 ", "creator_id": "cr-001"}]
    assert len(checksum) == 64
    assert parse_partner_csv(content) == (rows, checksum)


@pytest.mark.parametrize(
    ("content", "message"),
    [
        (b"enrollment_id\n", "at least one data row"),
        (b"phone,creator_id\nx,y\n", "requires partner_enrollment_id"),
        (b"enrollment_id,enrollment_id\na,b\n", "duplicate column headers"),
        (b"\xff", "UTF-8"),
    ],
)
def test_csv_parser_rejects_invalid_inputs(content: bytes, message: str) -> None:
    with pytest.raises(CsvImportError, match=message):
        parse_partner_csv(content)


def test_phone_and_date_cleaning_never_guesses_missing_digits_or_ambiguous_dates() -> None:
    assert normalize_phone("+1 (555) 0100") == "+15550100"
    assert normalize_phone("555-0107") == "+15550107"  # reserved synthetic fixture form
    assert normalize_phone("555-010") is None
    assert normalize_phone("+44 555 0100") is None
    assert parse_date("2026-09-01") == (datetime(2026, 9, 1).date(), False)
    assert parse_date("03/04/2026") == (None, True)
    assert parse_date("02/30/2026") == (None, False)


def test_analysis_groups_duplicates_and_never_auto_matches_conflicting_creator() -> None:
    rows = [
        {
            "row_number": 1,
            "row_checksum": "same",
            "source_values": {
                "partner_enrollment_id": "ENR-1",
                "partner_case_id": "CASE-1",
                "enrollment_date_raw": "2026-09-20",
                "phone_raw": "+1 555-0100",
                "creator_id_raw": "CR-001",
                "status_raw": "enrolled",
            },
        },
        {
            "row_number": 2,
            "row_checksum": "same",
            "source_values": {
                "partner_enrollment_id": "ENR-1",
                "partner_case_id": "CASE-1",
                "enrollment_date_raw": "2026-09-20",
                "phone_raw": "+1 555-0100",
                "creator_id_raw": "CR-001",
                "status_raw": "enrolled",
            },
        },
        {
            "row_number": 3,
            "row_checksum": "third",
            "source_values": {
                "partner_enrollment_id": "ENR-2",
                "partner_case_id": "",
                "enrollment_date_raw": "2026-09-20",
                "phone_raw": "+1 555-0101",
                "creator_id_raw": "CR-005",
                "status_raw": "enrolled",
            },
        },
        {
            "row_number": 4,
            "row_checksum": "fourth",
            "source_values": {
                "partner_enrollment_id": "ENR-3",
                "partner_case_id": "",
                "enrollment_date_raw": "03/04/2026",
                "phone_raw": "555-0199",
                "creator_id_raw": "CR-002",
                "status_raw": "enrolled",
            },
        },
        {
            "row_number": 5,
            "row_checksum": "fifth",
            "source_values": {
                "partner_enrollment_id": "ENR-4",
                "partner_case_id": "",
                "enrollment_date_raw": "2026-09-20",
                "phone_raw": "555-0177",
                "creator_id_raw": "CR-001",
                "status_raw": "enrolled",
            },
        },
    ]
    leads = [
        {
            "id": "lead-1",
            "business_id": "LEAD-001",
            "creator_business_id": "CR-001",
            "fictional_phone": "+15550100",
            "received_at": "2026-09-10T00:00:00+00:00",
        },
        {
            "id": "lead-2",
            "business_id": "LEAD-002",
            "creator_business_id": "CR-001",
            "fictional_phone": "+15550101",
            "received_at": "2026-09-10T00:00:00+00:00",
        },
    ]
    analysis = build_analysis(
        rows,
        leads,
        [{"partner_request_id": "CASE-1", "baseline_lead_id": "lead-1", "status": "accepted"}],
        datetime(2026, 10, 1, tzinfo=UTC),
    )
    assert analysis["duplicate_groups"] == [
        {"group_type": "exact_duplicate", "group_key": "same", "row_numbers": [1, 2]}
    ]
    by_source = {
        tuple(case["evidence"]["source_row_numbers"]): case
        for case in analysis["reconciliation_cases"]
    }
    assert by_source[(1, 2)]["status"] == "matched"
    assert by_source[(1, 2)]["potentially_commissionable"] is True
    assert by_source[(3,)]["conflict_flags"] == ["creator_contradiction"]
    assert by_source[(3,)]["potentially_commissionable"] is False
    assert "ambiguous_date" in by_source[(4,)]["conflict_flags"]
    assert by_source[(5,)]["status"] == "unmatched"


def test_conflicting_external_id_takes_priority_over_exact_duplicate_subgroup() -> None:
    rows = [
        {
            "row_number": 1,
            "row_checksum": "same",
            "source_values": {
                "partner_enrollment_id": "ENR-1",
                "phone_raw": "+1 555-0100",
                "enrollment_date_raw": "2026-09-20",
            },
        },
        {
            "row_number": 2,
            "row_checksum": "same",
            "source_values": {
                "partner_enrollment_id": "ENR-1",
                "phone_raw": "+1 555-0100",
                "enrollment_date_raw": "2026-09-20",
            },
        },
        {
            "row_number": 3,
            "row_checksum": "different",
            "source_values": {
                "partner_enrollment_id": "ENR-1",
                "phone_raw": "+1 555-0101",
                "enrollment_date_raw": "2026-09-21",
            },
        },
    ]
    analysis = build_analysis(rows, [], [], datetime(2026, 10, 1, tzinfo=UTC))
    canonical = analysis["canonical_rows"]
    assert len(canonical) == 1
    assert canonical[0]["source_row_numbers"] == [1, 2, 3]
    assert canonical[0]["conflicted"] is True
    assert canonical[0]["canonical_values"] == {}


def test_multiple_shared_external_id_candidates_are_sent_to_review() -> None:
    rows = [
        {
            "row_number": 1,
            "row_checksum": "one",
            "source_values": {
                "partner_enrollment_id": "ENR-1",
                "partner_case_id": "CASE-SHARED",
                "phone_raw": "+1 555-0100",
                "creator_id_raw": "CR-001",
                "enrollment_date_raw": "2026-09-20",
                "status_raw": "enrolled",
            },
        }
    ]
    leads = [
        {"id": "lead-1", "creator_business_id": "CR-001", "fictional_phone": "+15550100"},
        {"id": "lead-2", "creator_business_id": "CR-001", "fictional_phone": "+15550101"},
    ]
    result = build_analysis(
        rows,
        leads,
        [
            {
                "partner_request_id": "CASE-SHARED",
                "baseline_lead_id": "lead-1",
                "status": "accepted",
            },
            {
                "partner_request_id": "CASE-SHARED",
                "baseline_lead_id": "lead-2",
                "status": "accepted",
            },
        ],
        datetime(2026, 10, 1, tzinfo=UTC),
    )
    case = result["reconciliation_cases"][0]
    assert case["status"] == "review_required"
    assert case["match_method"] is None
    assert case["candidate_method"] == "exact_external_id"
    assert case["conflict_flags"] == ["ambiguous_candidates"]
