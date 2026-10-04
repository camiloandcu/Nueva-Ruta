from datetime import UTC, datetime

from nueva_ruta_api.compliance import review_script_content
from nueva_ruta_api.creator_content import creator_profiles, script_library, source_ranking

AS_OF = datetime(2026, 9, 15, 17, tzinfo=UTC)


def _source(business_id: str, source_date: str, risk: str = "low") -> dict[str, str]:
    return {
        "business_id": business_id,
        "source_date": source_date,
        "compliance_risk": risk,
        "risk_reason": "Synthetic test risk evidence.",
    }


def test_source_ranking_exposes_equal_weight_factors_and_deterministic_ties() -> None:
    facts = {
        "sources": [
            _source("SRC-002", "2026-09-15"),
            _source("SRC-001", "2026-09-15"),
            _source("SRC-003", "2026-06-17", "medium"),
        ],
        "leads": [
            {"business_id": "LEAD-1", "source_business_id": "SRC-001", "commercial_stage": "new"},
            {
                "business_id": "LEAD-2",
                "source_business_id": "SRC-001",
                "commercial_stage": "enrolled",
            },
            {"business_id": "LEAD-3", "source_business_id": "SRC-002", "commercial_stage": "new"},
            {
                "business_id": "LEAD-4",
                "source_business_id": "SRC-002",
                "commercial_stage": "enrolled",
            },
            {
                "business_id": "LEAD-5",
                "source_business_id": "SRC-003",
                "commercial_stage": "prequalified",
            },
        ],
    }

    first = source_ranking(facts, as_of=AS_OF)
    second = source_ranking({**facts, "sources": list(reversed(facts["sources"]))}, as_of=AS_OF)

    assert [item["business_id"] for item in first["sources"]] == [
        "SRC-001",
        "SRC-002",
        "SRC-003",
    ]
    assert first["sources"] == second["sources"]
    assert first["factor_weights"] == {
        "frequency": 0.25,
        "funnel_proximity": 0.25,
        "freshness": 0.25,
        "compliance_safety": 0.25,
    }
    assert first["sources"][0]["factors"] == {
        "frequency": 1.0,
        "funnel_proximity": 0.5,
        "freshness": 1.0,
        "compliance_safety": 1.0,
    }
    assert first["sources"][0]["priority_score"] == 0.875
    assert first["sources"][2]["factors"]["freshness"] == 0.0


def test_ranking_labels_missing_or_future_evidence_without_inventing_a_score() -> None:
    result = source_ranking(
        {"sources": [_source("SRC-010", "2026-09-16", "high")], "leads": []},
        as_of=AS_OF,
    )
    source = result["sources"][0]
    assert source["priority_score"] is None
    assert source["factors"]["frequency"] is None
    assert source["factors"]["funnel_proximity"] is None
    assert source["factors"]["freshness"] is None
    assert source["script_selectable"] is False
    assert source["evidence"]["source_age_days"] is None


def test_creator_profile_links_safe_funnel_and_source_evidence() -> None:
    profiles = creator_profiles(
        {
            "creators": [{"business_id": "CR-001", "fictional_name": "Ana (ficticia)"}],
            "leads": [
                {
                    "business_id": "LEAD-001",
                    "creator_business_id": "CR-001",
                    "source_business_id": "SRC-001",
                    "commercial_stage": "prequalified",
                }
            ],
        }
    )
    assert profiles[0]["funnel_evidence"] == {
        "linked_leads": 1,
        "stage_counts": {"prequalified": 1},
        "source_ids": ["SRC-001"],
        "interpretation": "Asociaciones observadas; no implican causalidad.",
    }


def test_script_library_hides_freeform_review_reason_from_analyst() -> None:
    facts = {
        "scripts": [
            {
                "business_id": "SCRIPT-001",
                "versions": [
                    {"version": 1, "review": None},
                    {
                        "version": 2,
                        "review": {"decision": "approved", "reason": "private reviewer note"},
                    },
                ],
            }
        ]
    }
    analyst = script_library(facts, include_review_reason=False)
    supervisor = script_library(facts, include_review_reason=True)
    assert analyst[0]["versions"][0]["review_state"] == "pending_review"
    assert "reason" not in analyst[0]["versions"][1]["review"]
    assert supervisor[0]["versions"][1]["review"]["reason"] == "private reviewer note"


def test_script_compliance_blocks_unconditional_benefit_figures_and_false_testimonials() -> None:
    unconditional = review_script_content("Puedes ahorrar en tus pagos con esta opción.")
    conditional = review_script_content(
        "En algunos casos podrías ahorrar, dependiendo de tu situación y de los acreedores."
    )
    figures = review_script_content("Te garantizamos 40% menos en dos meses.")
    testimonial = review_script_content("Este testimonio real dice: a mí me funcionó.")
    fictional_story = review_script_content(
        "Ejemplo ficticio, no es un testimonio: una persona pregunta."
    )

    assert "BENEFIT_UNCONDITIONAL" in unconditional.codes
    assert conditional.valid
    assert {"CLAIM_GUARANTEE", "UNSUPPORTED_FIGURE", "UNSUPPORTED_TIMELINE"}.issubset(figures.codes)
    assert "TESTIMONIAL_MISREPRESENTED" in testimonial.codes
    assert fictional_story.valid
