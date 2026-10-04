from datetime import UTC, date, datetime
from pathlib import Path

from nueva_ruta_api.reporting import build_operational_report, business_seconds_between
from nueva_ruta_api.rules import canonical_content, parse_yaml

RULE = canonical_content(parse_yaml(Path("config/rules/fictional-defaults.yaml").read_text()))
AS_OF = datetime(2026, 9, 15, 17, tzinfo=UTC)


def test_business_time_skips_weekend_and_accounts_for_dst_change() -> None:
    start = datetime(2026, 3, 6, 20, tzinfo=UTC)  # Friday 15:00 EST
    end = datetime(2026, 3, 9, 14, tzinfo=UTC)  # Monday 10:00 EDT
    schedule = {
        "timezone": "America/New_York",
        "weekdays": ["monday", "tuesday", "wednesday", "thursday", "friday"],
        "opens_at": "09:00:00",
        "closes_at": "18:00:00",
    }
    assert business_seconds_between(start, end, schedule) == 4 * 3600


def test_report_keeps_partner_denominator_and_unmatched_records_under_lead_filters() -> None:
    facts = {
        "active_rule": {"id": "rule-v2", "version": 2, "content": RULE},
        "leads": [
            {
                "crm_lead_id": "lead-a",
                "business_id": "LEAD-A",
                "received_at": "2026-09-10T12:00:00Z",
                "creator_business_id": "CR-001",
                "channel": "ctwa",
                "state": "TX",
                "commercial_stage": "transferred",
                "qualified_at": "2026-09-10T12:01:00Z",
                "stage_updated_at": "2026-09-10T12:02:00Z",
                "last_disposition_at": "2026-09-10T12:02:00Z",
            },
            {
                "crm_lead_id": "lead-b",
                "business_id": "LEAD-B",
                "received_at": "2026-09-11T12:00:00Z",
                "creator_business_id": None,
                "channel": "organic",
                "state": None,
                "commercial_stage": "new",
                "qualified_at": None,
                "stage_updated_at": "2026-09-11T12:00:00Z",
            },
            {
                "crm_lead_id": "lead-c",
                "business_id": "LEAD-C",
                "received_at": "2026-09-12T12:00:00Z",
                "creator_business_id": None,
                "channel": "organic",
                "state": None,
                "commercial_stage": "new",
                "qualified_at": None,
                "stage_updated_at": "2026-09-12T12:00:00Z",
            },
        ],
        "transfers": [{"id": "transfer-a", "lead_id": "lead-a", "status": "accepted"}],
        "imports": [{"id": "import-a", "imported_at": "2026-09-12T12:00:00Z"}],
        "enrollments": [
            {
                "id": "canonical-a",
                "import_job_id": "import-a",
                "quality_issues": [],
                "conflicted": False,
            },
            {
                "id": "canonical-b",
                "import_job_id": "import-a",
                "quality_issues": ["unknown_creator"],
                "conflicted": True,
            },
        ],
        "reconciliations": [
            {
                "id": "case-a",
                "canonical_enrollment_id": "canonical-a",
                "status": "matched",
                "match_method": "exact_phone",
                "lead_id": "lead-a",
                "conflict_flags": [],
                "potentially_commissionable": True,
            },
            {
                "id": "case-b",
                "canonical_enrollment_id": "canonical-b",
                "status": "review_required",
                "match_method": None,
                "lead_id": None,
                "conflict_flags": ["ambiguous_candidates"],
                "potentially_commissionable": False,
            },
        ],
        "normalized_quality": [
            {"import_job_id": "import-a", "quality_issues": ["unknown_creator"]}
        ],
        "decisions": [],
        "drafts": [],
        "follow_up_drafts": [],
        "escalations": [],
        "dispositions": [],
        "outbox": [],
        "delivery_attempts": [],
    }

    result = build_operational_report(
        facts,
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 30),
        creator="CR-001",
        channel="ctwa",
        state="TX",
        as_of=AS_OF,
    )
    assert result["funnel"]["lead_stages"][0]["count"] == 1
    assert result["funnel"]["lead_stages"][1]["denominator"] == 1
    assert result["funnel"]["lead_stages"][1]["conversion_percent"] == 100.0
    assert result["funnel"]["enrollment_stages"][0]["count"] == 2
    assert result["funnel"]["enrollment_stages"][1]["denominator"] == 2
    assert result["partner"]["reconciled"] == 1
    assert result["partner"]["ambiguous"] == 1
    assert (
        result["partner"]["reconciled"]
        + result["partner"]["ambiguous"]
        + result["partner"]["conflicting"]
        + result["partner"]["unmatched"]
        == result["partner"]["reported"]
    )
    assert result["partner"]["potentially_commissionable"] == 1
    assert result["partner"]["quality_issues"] == {"unknown_creator": 1}
    assert "fictional_phone" not in str(result)

    first_page = build_operational_report(
        facts,
        start_date=None,
        end_date=None,
        creator=None,
        channel=None,
        state=None,
        as_of=AS_OF,
        stalled_limit=1,
    )
    second_page = build_operational_report(
        facts,
        start_date=None,
        end_date=None,
        creator=None,
        channel=None,
        state=None,
        as_of=AS_OF,
        stalled_limit=1,
        stalled_offset=1,
    )
    assert first_page["stalled_pagination"]["total"] == 3
    assert first_page["stalled_pagination"]["next_offset"] == 1
    assert first_page["stalled"][0]["entity_id"] != second_page["stalled"][0]["entity_id"]


def test_empty_report_keeps_zero_counts_and_unavailable_conversion_rates() -> None:
    facts = {
        "active_rule": {"id": "rule-v2", "version": 2, "content": RULE},
        "leads": [],
        "transfers": [],
        "imports": [],
        "enrollments": [],
        "reconciliations": [],
        "normalized_quality": [],
        "decisions": [],
        "drafts": [],
        "follow_up_drafts": [],
        "escalations": [],
        "dispositions": [],
        "outbox": [],
        "delivery_attempts": [],
    }

    result = build_operational_report(
        facts,
        start_date=None,
        end_date=None,
        creator=None,
        channel=None,
        state=None,
        as_of=AS_OF,
    )

    assert result["funnel"]["lead_stages"][0]["count"] == 0
    assert result["funnel"]["lead_stages"][1]["conversion_percent"] is None
    assert result["funnel"]["enrollment_stages"][0]["count"] == 0
    assert result["funnel"]["enrollment_stages"][1]["conversion_percent"] is None
    assert result["stalled"] == []
    assert result["stalled_pagination"] == {
        "limit": 25,
        "offset": 0,
        "total": 0,
        "next_offset": None,
        "previous_offset": None,
    }
