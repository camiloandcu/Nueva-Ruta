from copy import deepcopy
from pathlib import Path

import pytest
from nueva_ruta_api.rules import (
    AUTOMATIC_PURPOSES,
    RuleDocument,
    compliance_violations,
    content_hash,
    export_yaml,
    normalized_diff,
    parse_yaml,
)
from pydantic import ValidationError

SEED = Path("config/rules/fictional-defaults.yaml").read_text()


def test_fictional_defaults_round_trip_and_hash_are_stable() -> None:
    document = parse_yaml(SEED)
    exported = export_yaml(document)

    assert parse_yaml(exported) == document
    assert content_hash(parse_yaml(exported)) == content_hash(document)
    assert document.debt_policy.minimum == 5_000
    assert document.debt_policy.maximum == 100_000
    assert set(document.state_coverage.included) == {"CA", "TX", "FL"}
    assert set(template.purpose for template in document.automatic_templates) == AUTOMATIC_PURPOSES
    assert document.schema_version == 2
    assert document.stalled_work is not None
    assert document.stalled_work.new_unclassified_minutes == 15
    assert document.stalled_work.reconciliation_conflict_unresolved_business_days == 2
    assert compliance_violations(document) == []


def test_schema_v1_history_remains_valid_and_stalled_thresholds_are_strict() -> None:
    value = parse_yaml(SEED).model_dump(mode="json")
    value["schema_version"] = 1
    value.pop("stalled_work")
    assert RuleDocument.model_validate(value).schema_version == 1
    value["schema_version"] = 2
    with pytest.raises(ValidationError, match="requires stalled_work"):
        RuleDocument.model_validate(value)
    value = parse_yaml(SEED).model_dump(mode="json")
    value["stalled_work"]["approaching_ratio"] = 1
    with pytest.raises(ValidationError):
        RuleDocument.model_validate(value)


def test_unknown_fields_and_conflicting_ranges_are_rejected() -> None:
    value = parse_yaml(SEED).model_dump(mode="json")
    value["unknown_policy"] = True
    value["debt_policy"]["minimum"] = 200_000

    with pytest.raises(ValidationError) as invalid:
        RuleDocument.model_validate(value)

    error_types = {error["type"] for error in invalid.value.errors()}
    assert "extra_forbidden" in error_types
    assert "value_error" in error_types


def test_dangling_stage_and_bad_timezone_are_rejected() -> None:
    value = parse_yaml(SEED).model_dump(mode="json")
    value["classification"]["triggers"][0]["target_stage"] = "missing"

    with pytest.raises(ValidationError) as invalid:
        RuleDocument.model_validate(value)
    assert "unknown stage" in str(invalid.value)

    value = parse_yaml(SEED).model_dump(mode="json")
    value["operating_schedule"]["timezone"] = "Mars/Olympus"
    with pytest.raises(ValidationError) as invalid_timezone:
        RuleDocument.model_validate(value)
    assert "unknown IANA timezone" in str(invalid_timezone.value)


@pytest.mark.parametrize(
    ("body", "expected"),
    [
        (
            "Nuestro asesor garantiza que ahorrarás 50%.",
            {
                "TERM_DISALLOWED_PARTNER",
                "CLAIM_PROHIBITED",
                "BENEFIT_UNCONDITIONAL",
                "FIGURE_UNSUPPORTED",
            },
        ),
        ("Deja de pagar y usa {{nombre}}.", {"CLAIM_PROHIBITED", "AUTO_PERSONALIZATION"}),
    ],
)
def test_compliance_returns_stable_blocking_codes(body: str, expected: set[str]) -> None:
    value = deepcopy(parse_yaml(SEED))
    value.automatic_templates[0].body = body

    first = compliance_violations(value)
    second = compliance_violations(value)

    assert first == second
    assert {item.code for item in first} == expected
    assert all(item.severity == "blocking" for item in first)


def test_normalized_diff_is_path_ordered_and_detects_no_change() -> None:
    active = parse_yaml(SEED)
    draft = active.model_copy(deep=True)
    draft.escalation.sla_minutes = 45
    draft.feature_flags.automatic_messages_enabled = True

    assert normalized_diff(active, active) == []
    assert normalized_diff(active, draft) == [
        {"operation": "changed", "path": "escalation.sla_minutes", "old": 30, "new": 45},
        {
            "operation": "changed",
            "path": "feature_flags.automatic_messages_enabled",
            "old": False,
            "new": True,
        },
    ]
