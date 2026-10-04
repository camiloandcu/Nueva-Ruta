"""Deterministic read-only operational reporting over one database fact snapshot."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import UTC, date, datetime, time, timedelta
from statistics import median
from typing import Any
from zoneinfo import ZoneInfo

REPORTING_TIMEZONE = "America/New_York"
LEAD_PROGRESS_STAGES = {
    "prequalified",
    "contact_attempted",
    "info_sent",
    "callback_scheduled",
    "transferred",
    "enrolled",
}


def _instant(value: Any) -> datetime | None:
    if not value:
        return None
    result = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return result.replace(tzinfo=UTC) if result.tzinfo is None else result.astimezone(UTC)


def _in_date_range(value: Any, start: date | None, end: date | None) -> bool:
    instant = _instant(value)
    if instant is None:
        return False
    local_date = instant.astimezone(ZoneInfo(REPORTING_TIMEZONE)).date()
    return (start is None or local_date >= start) and (end is None or local_date <= end)


def business_seconds_between(start: datetime, end: datetime, schedule: dict[str, Any]) -> float:
    """Count scheduled business seconds, including correct local DST boundaries."""
    if end <= start:
        return 0.0
    zone = ZoneInfo(str(schedule["timezone"]))
    weekdays = {str(day).casefold() for day in schedule["weekdays"]}
    opens = time.fromisoformat(str(schedule["opens_at"]))
    closes = time.fromisoformat(str(schedule["closes_at"]))
    local_first = start.astimezone(zone).date()
    local_last = end.astimezone(zone).date()
    total = 0.0
    day = local_first
    while day <= local_last:
        if day.strftime("%A").casefold() in weekdays:
            window_start = datetime.combine(day, opens, zone).astimezone(UTC)
            window_end = datetime.combine(day, closes, zone).astimezone(UTC)
            overlap_start = max(start, window_start)
            overlap_end = min(end, window_end)
            total += max(0.0, (overlap_end - overlap_start).total_seconds())
        day += timedelta(days=1)
    return total


def _elapsed(
    start: datetime | None, as_of: datetime, unit: str, rule: dict[str, Any]
) -> float | None:
    if start is None:
        return None
    seconds = max(0.0, (as_of - start).total_seconds())
    if unit == "minutes":
        return seconds / 60
    if unit == "hours":
        return seconds / 3600
    schedule = rule["operating_schedule"]
    business_seconds = business_seconds_between(start, as_of, schedule)
    if unit == "business_hours":
        return business_seconds / 3600
    if unit == "business_days":
        opens = time.fromisoformat(str(schedule["opens_at"]))
        closes = time.fromisoformat(str(schedule["closes_at"]))
        daily_seconds = (
            datetime.combine(date.min, closes) - datetime.combine(date.min, opens)
        ).total_seconds()
        return business_seconds / daily_seconds
    raise ValueError(f"unsupported stalled-work unit: {unit}")


def _stalled_item(
    *,
    kind: str,
    entity_id: str,
    started_at: Any,
    as_of: datetime,
    threshold: float,
    unit: str,
    rule: dict[str, Any],
    owner_role: str,
    next_action: str,
    lead_id: str | None = None,
    business_id: str | None = None,
    reason: str | None = None,
    owner_id: str | None = None,
    last_activity_at: Any = None,
    due_at: Any = None,
    source_rule_version_id: str | None = None,
) -> dict[str, Any]:
    start = _instant(started_at)
    last_activity = _instant(last_activity_at)
    due = _instant(due_at)
    common = {
        "kind": kind,
        "entity_id": entity_id,
        "lead_id": lead_id,
        "business_id": business_id,
        "reason": reason or kind,
        "started_at": start.isoformat() if start else None,
        "last_activity_at": last_activity.isoformat() if last_activity else None,
        "threshold": threshold,
        "threshold_unit": unit,
        "rule_version": int(rule["version"]),
        "source_rule_version_id": source_rule_version_id,
        "owner_role": owner_role,
        "owner_id": owner_id,
        "next_action": next_action,
        "due_at": due.isoformat() if due else None,
    }
    if start is None:
        return {**common, "age": None, "age_unit": unit, "status": "missing_evidence"}
    elapsed = _elapsed(start, as_of, unit, rule["content"])
    assert elapsed is not None
    callback = unit == "scheduled_time"
    if callback:
        scheduled = _instant(due_at)
        if scheduled is None:
            return {**common, "age": None, "age_unit": unit, "status": "missing_evidence"}
        remaining = (scheduled - as_of).total_seconds() / 60
        common["age"] = max(0.0, -remaining)
        common["age_unit"] = "minutes_after_due"
        common["threshold"] = 0
        common["threshold_unit"] = "scheduled_time"
        if remaining <= 0:
            status_value = "breached"
        elif remaining <= float(rule["content"]["stalled_work"]["callback_approaching_minutes"]):
            status_value = "approaching"
        else:
            status_value = "within"
    else:
        common["age"] = round(elapsed, 2)
        common["age_unit"] = unit
        if elapsed >= threshold:
            status_value = "breached"
        elif elapsed >= threshold * float(rule["content"]["stalled_work"]["approaching_ratio"]):
            status_value = "approaching"
        else:
            status_value = "within"
    return {**common, "status": status_value}


def build_operational_report(
    facts: dict[str, Any],
    *,
    start_date: date | None,
    end_date: date | None,
    creator: str | None,
    channel: str | None,
    state: str | None,
    as_of: datetime,
    stalled_limit: int = 25,
    stalled_offset: int = 0,
) -> dict[str, Any]:
    """Compose counts and drill-through-safe items from a transactionally consistent snapshot."""
    if as_of.tzinfo is None:
        raise ValueError("as_of must include a timezone")
    as_of = as_of.astimezone(UTC)
    rule = facts["active_rule"]
    stalled_policy = rule["content"]["stalled_work"]
    lead_by_id = {str(item["crm_lead_id"]): item for item in facts["leads"]}
    filtered_leads = [
        lead
        for lead in facts["leads"]
        if _in_date_range(lead.get("received_at"), start_date, end_date)
        and (creator is None or lead.get("creator_business_id") == creator)
        and (channel is None or lead.get("channel") == channel)
        and (state is None or lead.get("state") == state)
    ]
    lead_ids = {str(lead["crm_lead_id"]) for lead in filtered_leads}
    transitions = facts["transfers"]
    approved_ids = {
        str(item["lead_id"]) for item in transitions if str(item["lead_id"]) in lead_ids
    }
    accepted_ids = {
        str(item["lead_id"])
        for item in transitions
        if item["status"] == "accepted" and str(item["lead_id"]) in lead_ids
    }
    stage_sets = [
        ("received", lead_ids),
        (
            "prequalified",
            {
                str(lead["crm_lead_id"])
                for lead in filtered_leads
                if lead.get("qualified_at") or lead.get("commercial_stage") in LEAD_PROGRESS_STAGES
            },
        ),
        ("transfer_approved", approved_ids),
        ("partner_accepted", accepted_ids),
    ]
    lead_funnel: list[dict[str, Any]] = []
    previous_count: int | None = None
    received_count = len(lead_ids)
    for key, entity_set in stage_sets:
        count = len(entity_set)
        lead_funnel.append(
            {
                "stage": key,
                "count": count,
                "denominator": previous_count,
                "conversion_percent": round(count / previous_count * 100, 1)
                if previous_count
                else None,
                "received_cohort_percent": round(count / received_count * 100, 1)
                if received_count
                else None,
            }
        )
        previous_count = count

    imported_job_ids = {
        str(item["id"])
        for item in facts["imports"]
        if _in_date_range(item["imported_at"], start_date, end_date)
    }
    canonical = {
        str(item["id"]): item
        for item in facts["enrollments"]
        if str(item["import_job_id"]) in imported_job_ids
    }
    cases = [
        item
        for item in facts["reconciliations"]
        if str(item["canonical_enrollment_id"]) in canonical
    ]
    exact_cases = [item for item in cases if item.get("status") == "matched"]
    reconciled_count = len(exact_cases)
    partner_reported = len(canonical)
    enrollment_funnel = [
        {
            "stage": "enrollment_reported",
            "count": partner_reported,
            "denominator": partner_reported,
            "conversion_percent": 100.0 if partner_reported else None,
        },
        {
            "stage": "enrollment_reconciled",
            "count": reconciled_count,
            "denominator": partner_reported,
            "conversion_percent": round(reconciled_count / partner_reported * 100, 1)
            if partner_reported
            else None,
        },
    ]
    categories: Counter[str] = Counter()
    blockers: Counter[str] = Counter()
    proxy_count = 0
    for case in cases:
        canonical_row = canonical[str(case["canonical_enrollment_id"])]
        flags = set(case.get("conflict_flags") or []) | set(
            canonical_row.get("quality_issues") or []
        )
        if case.get("potentially_commissionable"):
            proxy_count += 1
        elif flags:
            blockers.update(flags)
        if case.get("status") == "matched":
            categories["reconciled"] += 1
        elif any("ambiguous" in flag for flag in flags):
            categories["ambiguous"] += 1
        elif canonical_row.get("conflicted") or any(
            "conflict" in flag or "contradiction" in flag for flag in flags
        ):
            categories["conflicting"] += 1
        else:
            categories["unmatched"] += 1

    case_by_id = {str(case["canonical_enrollment_id"]): case for case in cases}
    evidence_links = []
    for canonical_id, canonical_row in canonical.items():
        case = case_by_id.get(canonical_id, {})
        evidence_links.append(
            {
                "canonical_enrollment_id": canonical_id,
                "partner_enrollment_id": canonical_row.get("partner_enrollment_id"),
                "case_id": str(case.get("id") or ""),
                "status": case.get("status") or "missing_case",
                "conflict_flags": case.get("conflict_flags") or [],
                "source_row_numbers": canonical_row.get("source_row_numbers") or [],
                "potentially_commissionable": bool(case.get("potentially_commissionable")),
            }
        )

    filtered_decisions = [item for item in facts["decisions"] if str(item["lead_id"]) in lead_ids]
    decision_counts = Counter(item["decision"] for item in filtered_decisions)
    decision_times: dict[str, list[float]] = defaultdict(list)
    human_times: list[float] = []
    for decision in filtered_decisions:
        lead = lead_by_id[str(decision["lead_id"])]
        started = _instant(lead.get("received_at"))
        occurred = _instant(decision.get("created_at"))
        if started and occurred:
            decision_times[str(lead["crm_lead_id"])].append(
                max(0.0, (occurred - started).total_seconds())
            )
    human_events: dict[str, list[datetime]] = defaultdict(list)
    for lead in filtered_leads:
        if value := _instant(lead.get("qualified_at")):
            human_events[str(lead["crm_lead_id"])].append(value)
        if value := _instant(lead.get("last_disposition_at")):
            human_events[str(lead["crm_lead_id"])].append(value)
    for event in facts["escalations"]:
        if str(event.get("lead_id")) not in lead_ids:
            continue
        for key in ("claimed_at", "resolved_at"):
            if value := _instant(event.get(key)):
                human_events[str(event["lead_id"])].append(value)
    for lead_id, events in human_events.items():
        start = _instant(lead_by_id[lead_id].get("received_at"))
        if start and events:
            human_times.append(max(0.0, (min(events) - start).total_seconds()))

    pending_response_drafts = [
        item
        for item in facts["drafts"]
        if item["status"] == "pending" and str(item.get("lead_id")) in lead_ids
    ]
    pending_follow_up_drafts = [
        item
        for item in facts["follow_up_drafts"]
        if item["status"] == "pending_review" and str(item.get("lead_id")) in lead_ids
    ]
    relevant_escalations = [
        item for item in facts["escalations"] if str(item.get("lead_id")) in lead_ids
    ]
    open_escalations = [
        item
        for item in relevant_escalations
        if item.get("lifecycle_state") not in {"resolved", "closed_with_reason"}
    ]
    relevant_transfers = [item for item in transitions if str(item["lead_id"]) in lead_ids]
    transfer_ids = {str(item["id"]) for item in relevant_transfers}
    relevant_outbox = [item for item in facts["outbox"] if str(item["transfer_id"]) in transfer_ids]
    relevant_attempts = [
        item
        for item in facts["delivery_attempts"]
        if any(str(row["id"]) == str(item["outbox_event_id"]) for row in relevant_outbox)
    ]
    recovered: list[float] = []
    for event in relevant_attempts:
        started = _instant(event.get("started_at"))
        completed = _instant(event.get("completed_at"))
        if event.get("outcome") == "delivered" and started and completed:
            recovered.append(max(0.0, (completed - started).total_seconds()))

    stalled: list[dict[str, Any]] = []
    lead_thresholds = {
        "new": (
            stalled_policy["new_unclassified_minutes"],
            "minutes",
            "operator",
            "Revisar y clasificar el lead.",
            "received_at",
        ),
        "under_review": (
            stalled_policy["human_review_pending_business_hours"],
            "business_hours",
            "operator",
            "Completar la revisión humana.",
            "stage_updated_at",
        ),
        "prequalified": (
            stalled_policy["prequalified_without_disposition_business_hours"],
            "business_hours",
            "operator",
            "Registrar la siguiente disposición.",
            "qualified_at",
        ),
        "info_sent": (
            stalled_policy["info_sent_without_activity_hours"],
            "hours",
            "operator",
            "Verificar respuesta y siguiente acción.",
            "stage_updated_at",
        ),
        "callback_scheduled": (
            0,
            "scheduled_time",
            "operator",
            "Contactar al lead en el horario acordado.",
            "stage_updated_at",
        ),
    }
    for lead in filtered_leads:
        stage = str(lead["commercial_stage"])
        if stage in lead_thresholds:
            threshold, unit, owner_role, next_action, start_key = lead_thresholds[stage]
            if stage == "prequalified" and lead.get("last_disposition_at"):
                continue
            stalled.append(
                _stalled_item(
                    kind="lead",
                    entity_id=str(lead["crm_lead_id"]),
                    lead_id=str(lead["crm_lead_id"]),
                    business_id=str(lead["business_id"]),
                    reason=stage,
                    started_at=lead.get(start_key),
                    last_activity_at=lead.get("stage_updated_at"),
                    due_at=lead.get("callback_at") if stage == "callback_scheduled" else None,
                    as_of=as_of,
                    threshold=float(threshold),
                    unit=unit,
                    rule=rule,
                    owner_role=owner_role,
                    next_action=next_action,
                    source_rule_version_id=str(rule["id"]),
                )
            )
    for item in pending_response_drafts + pending_follow_up_drafts:
        if item.get("created_at"):
            stalled.append(
                _stalled_item(
                    kind="draft",
                    entity_id=str(item["id"]),
                    lead_id=str(item.get("lead_id")),
                    started_at=item["created_at"],
                    last_activity_at=item["created_at"],
                    as_of=as_of,
                    threshold=float(stalled_policy["human_review_pending_business_hours"]),
                    unit="business_hours",
                    rule=rule,
                    owner_role="operator",
                    next_action="Revisar y resolver el borrador.",
                    source_rule_version_id=str(item.get("rule_version_id") or ""),
                )
            )
    for item in open_escalations:
        start = _instant(item.get("created_at"))
        due = _instant(item.get("due_at"))
        duration = (
            (due - start).total_seconds() / 60
            if start and due
            else float(stalled_policy["human_review_pending_business_hours"] * 60)
        )
        stalled.append(
            _stalled_item(
                kind="escalation",
                entity_id=str(item["id"]),
                lead_id=str(item.get("lead_id")),
                started_at=item.get("created_at"),
                due_at=item.get("due_at"),
                last_activity_at=item.get("claimed_at") or item.get("created_at"),
                as_of=as_of,
                threshold=max(duration, 1),
                unit="minutes",
                rule=rule,
                owner_role=str(item.get("owner_role") or "operator"),
                owner_id=str(item["owner_id"]) if item.get("owner_id") else None,
                next_action="Revisar o resolver la escalación.",
                reason=str(item.get("reason_code") or "escalation"),
                source_rule_version_id=str(item.get("rule_version_id") or ""),
            )
        )
    transfer_by_id = {str(item["id"]): item for item in relevant_transfers}
    for event in relevant_outbox:
        transfer = transfer_by_id.get(str(event["transfer_id"]))
        if transfer and transfer.get("status") != "accepted":
            stalled.append(
                _stalled_item(
                    kind="partner_delivery",
                    entity_id=str(event["id"]),
                    lead_id=str(transfer["lead_id"]),
                    started_at=transfer.get("approved_at"),
                    last_activity_at=event.get("updated_at"),
                    as_of=as_of,
                    threshold=float(
                        stalled_policy["transferred_without_partner_confirmation_hours"]
                    ),
                    unit="hours",
                    rule=rule,
                    owner_role="operator",
                    next_action="Verificar entrega, reintentar o escalar el DLQ.",
                    reason=str(event["status"]),
                    source_rule_version_id=None,
                )
            )
    for case in cases:
        if case["status"] == "review_required":
            stalled.append(
                _stalled_item(
                    kind="reconciliation",
                    entity_id=str(case["id"]),
                    lead_id=str(case.get("lead_id") or "") or None,
                    started_at=case.get("updated_at"),
                    last_activity_at=case.get("updated_at"),
                    as_of=as_of,
                    threshold=float(
                        stalled_policy["reconciliation_conflict_unresolved_business_days"]
                    ),
                    unit="business_days",
                    rule=rule,
                    owner_role="analyst",
                    next_action="Revisar evidencia y registrar una decisión con motivo.",
                    reason=", ".join(case.get("conflict_flags") or ["review_required"]),
                    source_rule_version_id=str(rule["id"]),
                )
            )

    quality: Counter[str] = Counter()
    for item in facts["normalized_quality"]:
        if str(item["import_job_id"]) not in imported_job_ids:
            continue
        quality.update(set(item.get("quality_issues") or []))
    ordered_stalled = sorted(
        stalled,
        key=lambda item: (
            item["status"] != "breached",
            item["age"] is None,
            -float(item["age"] or 0),
        ),
    )
    return {
        "as_of": as_of.isoformat(),
        "filters": {
            "from": start_date.isoformat() if start_date else None,
            "to": end_date.isoformat() if end_date else None,
            "creator": creator,
            "channel": channel,
            "state": state,
            "reporting_timezone": REPORTING_TIMEZONE,
        },
        "funnel": {
            "lead_stages": lead_funnel,
            "enrollment_stages": enrollment_funnel,
            "cohort_basis": "received_at",
            "partner_totals_basis": "imported_at",
        },
        "decisions": {
            "distribution": dict(sorted(decision_counts.items())),
            "first_system_decision": {
                "samples": len(decision_times),
                "median_seconds": round(
                    median([values[0] for values in decision_times.values()]), 1
                )
                if decision_times
                else None,
            },
            "first_human_action": {
                "samples": len(human_times),
                "median_seconds": round(median(human_times), 1) if human_times else None,
            },
        },
        "backlog": {
            "pending_drafts": len(pending_response_drafts) + len(pending_follow_up_drafts),
            "open_escalations": len(open_escalations),
            "breached_escalations": sum(
                1 for item in open_escalations if (_instant(item.get("due_at")) or as_of) <= as_of
            ),
        },
        "delivery": {
            "logical_transfers": len(relevant_transfers),
            "accepted": sum(item["status"] == "accepted" for item in relevant_transfers),
            "pending": sum(item["status"] == "pending" for item in relevant_transfers),
            "dead_letter": sum(item["status"] == "dead_letter" for item in relevant_transfers),
            "outbox_attempts": len(relevant_attempts),
            "median_recovery_seconds": round(median(recovered), 1) if recovered else None,
        },
        "partner": {
            "reported": partner_reported,
            "reconciled": categories["reconciled"],
            "exact": sum(bool(item.get("match_method")) for item in exact_cases),
            "ambiguous": categories["ambiguous"],
            "conflicting": categories["conflicting"],
            "unmatched": categories["unmatched"],
            "potentially_commissionable": proxy_count,
            "proxy_blockers": dict(sorted(blockers.items())),
            "quality_issues": dict(sorted(quality.items())),
            "evidence_links": evidence_links,
            "scope_note": (
                "Partner totals use import date and are not narrowed by lead creator, channel, "
                "or state filters."
            ),
        },
        "stalled": ordered_stalled[stalled_offset : stalled_offset + stalled_limit],
        "stalled_pagination": {
            "limit": stalled_limit,
            "offset": stalled_offset,
            "total": len(ordered_stalled),
            "next_offset": stalled_offset + stalled_limit
            if stalled_offset + stalled_limit < len(ordered_stalled)
            else None,
            "previous_offset": max(0, stalled_offset - stalled_limit)
            if stalled_offset > 0
            else None,
        },
    }
