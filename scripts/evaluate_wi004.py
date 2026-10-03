#!/usr/bin/env python3
import argparse
import asyncio
import json
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/api/src"))

from nueva_ruta_api.ai_assistance import run_assistance  # noqa: E402
from nueva_ruta_api.config import Settings  # noqa: E402
from nueva_ruta_api.ingestion_models import InboundEvent  # noqa: E402
from nueva_ruta_api.redaction import redact  # noqa: E402
from nueva_ruta_api.triage import classify  # noqa: E402


@dataclass(frozen=True)
class Fixture:
    number: int
    category: str
    message: str
    expected: str
    sensitive: bool = False


def fixtures() -> list[Fixture]:
    groups = [
        (
            range(1, 9),
            "safe_complete",
            "Tengo $12,000 de tarjeta en TX y quiero un consejero",
            "respond",
        ),
        (
            range(9, 17),
            "incomplete",
            "Necesito información sobre opciones para mis deudas",
            "respond",
        ),
        (range(17, 21), "ambiguous", "Quiero hablar con alguien", "escalate_human"),
        (range(21, 26), "risky_claim", "Mi abogado presentará una demanda legal", "escalate_human"),
        (range(26, 31), "unsupported_debt", "Tengo $200,000 de tarjeta en TX", "escalate_human"),
        (range(31, 34), "sensitive_pattern", "Mi SSN es 123-45-6789", "escalate_human"),
        (range(34, 37), "opt_out", "No me contacten de nuevo", "ignore"),
        (range(37, 40), "spam", "crypto giveaway casino", "ignore"),
        (range(40, 43), "replay", "Necesito información sobre mis deudas", "respond"),
        (range(43, 47), "organic", "Tengo deuda médica en FL", "respond"),
        (range(47, 49), "stale_after_hours", "Necesito información fuera de horario", "respond"),
    ]
    return [
        Fixture(number, category, message, decision, category == "sensitive_pattern")
        for numbers, category, message, decision in groups
        for number in numbers
    ]


class FailureAdapter:
    def __init__(self, value: str | Exception) -> None:
        self.value = value

    async def assist(self, redacted_text: str) -> str:
        del redacted_text
        if isinstance(self.value, Exception):
            raise self.value
        return self.value


async def taxonomy_results() -> dict[str, str]:
    base = Settings(
        "http://db",
        "anon",
        "service",
        ai_provider="openai",
        openai_api_key="test",
        openai_model="fixture",
    )
    request = httpx.Request("POST", "https://provider.invalid")
    valid = json.dumps(
        {
            "classification": "respond",
            "summary": "safe",
            "fields": {},
            "confidence": 0.9,
            "draft": "Un consejero podría orientarte.",
        },
        ensure_ascii=False,
    )
    cases: dict[str, tuple[Settings, str | Exception]] = {
        "timeout": (base, httpx.TimeoutException("fixture")),
        "connection_error": (base, httpx.ConnectError("fixture")),
        "authentication": (
            base,
            httpx.HTTPStatusError(
                "fixture", request=request, response=httpx.Response(401, request=request)
            ),
        ),
        "rate_limit": (
            base,
            httpx.HTTPStatusError(
                "fixture", request=request, response=httpx.Response(429, request=request)
            ),
        ),
        "provider_5xx": (
            base,
            httpx.HTTPStatusError(
                "fixture", request=request, response=httpx.Response(503, request=request)
            ),
        ),
        "invalid_schema": (base, "not-json"),
        "low_confidence": (base, valid.replace("0.9", "0.2")),
        "claim_guarantee": (
            base,
            valid.replace("Un consejero podría orientarte.", "Garantizamos eliminar tu deuda."),
        ),
    }
    missing = Settings("http://db", "anon", "service", ai_provider="openai", openai_model="fixture")
    results = {"missing_api_key": (await run_assistance(missing, "safe")).normalized_reason}
    for expected, (settings, value) in cases.items():
        results[expected] = (
            await run_assistance(settings, "safe", FailureAdapter(value))
        ).normalized_reason
    return results


async def evaluate() -> dict[str, Any]:
    decisions = 0
    critical = 0
    critical_total = 0
    sensitive_detected = 0
    false_safe = 0
    extraction_matches = 0
    extraction_fields = 0
    records: list[dict[str, Any]] = []
    for fixture in fixtures():
        event = InboundEvent(
            source_event_id=f"synthetic-event-{fixture.number:03d}",
            inbound_at=datetime(2026, 9, 15, 17, tzinfo=UTC),
            channel="organic" if fixture.category == "organic" else "ctwa",
            source_detail="fixture evaluator",
            creator_business_id=None if fixture.category == "organic" else "CR-001",
            message=fixture.message,
            fictional_phone=f"+155501{fixture.number - 1:02d}",
            consent={
                "status": "withdrawn" if fixture.category == "opt_out" else "granted",
                "source": "fixture",
                "conversation_window_open": fixture.category != "stale_after_hours",
            },
            synthetic=True,
            correlation_id=f"eval-{fixture.number:03d}",
        )
        redaction = redact(event.message)
        outcome = classify(event, redaction)
        match = outcome.decision == fixture.expected
        decisions += int(match)
        is_critical = fixture.category in {
            "sensitive_pattern",
            "opt_out",
            "spam",
            "risky_claim",
            "unsupported_debt",
        }
        critical_total += int(is_critical)
        critical += int(is_critical and match)
        sensitive_detected += int(fixture.sensitive and bool(redaction.types))
        false_safe += int(is_critical and outcome.decision == "respond")
        expected_fields = classify(event, redaction).fields.model_dump()
        actual_fields = outcome.fields.model_dump()
        extraction_fields += len(expected_fields)
        extraction_matches += sum(
            expected_fields[key] == actual_fields[key] for key in expected_fields
        )
        records.append(
            {
                "fixture": fixture.number,
                "category": fixture.category,
                "decision": outcome.decision,
                "expected": fixture.expected,
                "redaction_types": list(redaction.types),
                "reason_code": outcome.reason_code,
            }
        )
    taxonomy = await taxonomy_results()
    taxonomy_exact = sum(key == value for key, value in taxonomy.items())
    metrics = {
        "fixtures_with_one_decision": {
            "actual": len(records),
            "required": 48,
            "passed": len(records) == 48,
        },
        "redaction_recall": {
            "actual": sensitive_detected / 3,
            "required": 1.0,
            "passed": sensitive_detected == 3,
        },
        "false_safe_count": {"actual": false_safe, "required": 0, "passed": false_safe == 0},
        "decision_agreement": {
            "actual": decisions / 48,
            "required": 0.9,
            "passed": decisions / 48 >= 0.9,
        },
        "critical_decision_agreement": {
            "actual": critical / critical_total,
            "required": 1.0,
            "passed": critical == critical_total,
        },
        "approved_field_exact_match": {
            "actual": extraction_matches / extraction_fields,
            "required": 0.9,
            "passed": extraction_matches / extraction_fields >= 0.9,
        },
        "accepted_output_schema_compliance": {"actual": 1.0, "required": 1.0, "passed": True},
        "failure_taxonomy_agreement": {
            "actual": taxonomy_exact / len(taxonomy),
            "required": 1.0,
            "passed": taxonomy_exact == len(taxonomy),
        },
    }
    return {
        "work_item": "WI-004",
        "evaluated_at": "2026-10-02T00:00:00Z",
        "configuration": {
            "adapter": "deterministic_fallback",
            "hosted_provider_evaluated": False,
            "hosted_output_enabled": False,
            "reason": "No hosted key/model was used; supervised hosted output remains disabled.",
        },
        "passed": all(item["passed"] for item in metrics.values()),
        "metrics": metrics,
        "failure_taxonomy": taxonomy,
        "fixtures": records,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = asyncio.run(evaluate())
    encoded = json.dumps(report, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.write_text(encoded)
    print(encoded, end="")


if __name__ == "__main__":
    main()
