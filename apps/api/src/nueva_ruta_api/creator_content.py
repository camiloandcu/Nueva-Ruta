from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, datetime
from statistics import fmean
from typing import Any

STAGE_PROXIMITY = {
    "new": 0.0,
    "under_review": 0.2,
    "prequalified": 0.4,
    "contact_attempted": 0.6,
    "info_sent": 0.6,
    "callback_scheduled": 0.6,
    "transferred": 0.8,
    "enrolled": 1.0,
    "closed_not_interested": 0.0,
}
RISK_SAFETY = {"low": 1.0, "medium": 0.5, "high": 0.0}
FACTOR_WEIGHT = 0.25
FRESHNESS_HORIZON_DAYS = 90
FACTOR_KEYS = ("frequency", "funnel_proximity", "freshness", "compliance_safety")


def creator_profiles(facts: dict[str, Any]) -> list[dict[str, Any]]:
    leads_by_creator: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for lead in facts.get("leads", []):
        if creator_id := lead.get("creator_business_id"):
            leads_by_creator[str(creator_id)].append(lead)

    profiles = []
    for creator in facts.get("creators", []):
        business_id = str(creator["business_id"])
        linked = leads_by_creator.get(business_id, [])
        stages = Counter(str(lead["commercial_stage"]) for lead in linked)
        sources = sorted(
            {str(lead["source_business_id"]) for lead in linked if lead.get("source_business_id")}
        )
        profiles.append(
            {
                **creator,
                "funnel_evidence": {
                    "linked_leads": len(linked),
                    "stage_counts": dict(sorted(stages.items())),
                    "source_ids": sources,
                    "interpretation": "Asociaciones observadas; no implican causalidad.",
                },
            }
        )
    return profiles


def source_ranking(facts: dict[str, Any], *, as_of: datetime) -> dict[str, Any]:
    leads_by_source: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
    for lead in facts.get("leads", []):
        source_id = lead.get("source_business_id")
        business_id = lead.get("business_id")
        if source_id and business_id:
            leads_by_source[str(source_id)][str(business_id)] = lead

    maximum_frequency = max(
        (len(leads_by_source.get(str(source["business_id"]), {})) for source in facts["sources"]),
        default=0,
    )
    ranked: list[dict[str, Any]] = []
    for source in facts["sources"]:
        source_id = str(source["business_id"])
        linked = list(leads_by_source.get(source_id, {}).values())
        count = len(linked)
        frequency = count / maximum_frequency if count and maximum_frequency else None
        stage_counts = Counter(str(lead["commercial_stage"]) for lead in linked)
        observed_stages = [STAGE_PROXIMITY.get(str(lead["commercial_stage"])) for lead in linked]
        funnel_values = [value for value in observed_stages if value is not None]
        funnel = fmean(funnel_values) if funnel_values and len(funnel_values) == count else None

        source_date = date.fromisoformat(str(source["source_date"]))
        age_days = (as_of.date() - source_date).days
        freshness = max(0.0, 1.0 - age_days / FRESHNESS_HORIZON_DAYS) if age_days >= 0 else None
        risk = RISK_SAFETY.get(str(source.get("compliance_risk")))
        factors = {
            "frequency": frequency,
            "funnel_proximity": funnel,
            "freshness": freshness,
            "compliance_safety": risk,
        }
        score = (
            fmean(value for value in factors.values() if value is not None)
            if all(value is not None for value in factors.values())
            else None
        )
        contributions = {
            key: round(value * FACTOR_WEIGHT, 4) if value is not None else None
            for key, value in factors.items()
        }
        ranked.append(
            {
                **source,
                "factors": {
                    key: round(value, 4) if value is not None else None
                    for key, value in factors.items()
                },
                "factor_contributions": contributions,
                "priority_score": round(score, 4) if score is not None else None,
                "evidence": {
                    "linked_lead_count": count,
                    "stage_counts": dict(sorted(stage_counts.items())),
                    "source_age_days": age_days if age_days >= 0 else None,
                    "freshness_horizon_days": FRESHNESS_HORIZON_DAYS,
                    "compliance_risk": source.get("compliance_risk"),
                    "risk_reason": source.get("risk_reason"),
                },
                "script_selectable": source.get("compliance_risk") != "high",
            }
        )

    ranked.sort(
        key=lambda item: (
            item["priority_score"] is None,
            -(item["priority_score"] or 0.0),
            -date.fromisoformat(str(item["source_date"])).toordinal(),
            str(item["business_id"]),
        )
    )
    for rank, source in enumerate(ranked, start=1):
        source["rank"] = rank
    return {
        "as_of": as_of.isoformat(),
        "factor_weights": {key: FACTOR_WEIGHT for key in FACTOR_KEYS},
        "sources": ranked,
        "interpretation": "Prioridad descriptiva; no mide lift causal ni garantiza resultados.",
    }


def script_library(facts: dict[str, Any], *, include_review_reason: bool) -> list[dict[str, Any]]:
    output = []
    for script in facts.get("scripts", []):
        versions = []
        for version in script.get("versions", []):
            review = version.get("review")
            safe_review = None
            if isinstance(review, dict):
                safe_review = {
                    "decision": review.get("decision"),
                    "reviewer_id": review.get("reviewer_id"),
                    "reviewed_at": review.get("reviewed_at"),
                }
                if include_review_reason:
                    safe_review["reason"] = review.get("reason")
            versions.append(
                {
                    **version,
                    "review_state": str(review["decision"])
                    if isinstance(review, dict)
                    else "pending_review",
                    "review": safe_review,
                }
            )
        output.append({**script, "versions": versions})
    return output
