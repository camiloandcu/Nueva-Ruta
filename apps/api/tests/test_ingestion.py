import asyncio
import json
from datetime import UTC, datetime
from typing import Any

import httpx
import pytest
from nueva_ruta_api.ai_assistance import (
    assistance_request,
    response_text,
    run_assistance,
    validate_output,
)
from nueva_ruta_api.config import Settings
from nueva_ruta_api.ingestion_models import InboundEvent
from nueva_ruta_api.ingestion_service import process_event, safe_log_fields
from nueva_ruta_api.redaction import redact
from nueva_ruta_api.triage import classify, extract_fields

SETTINGS = Settings("http://db.invalid", "anon", "service")


def event(message: str, event_id: str = "fixture-1") -> InboundEvent:
    return InboundEvent(
        source_event_id=event_id,
        inbound_at=datetime(2026, 9, 15, 17, tzinfo=UTC),
        channel="ctwa",
        source_detail="synthetic test",
        creator_business_id="CR-001",
        message=message,
        fictional_phone="+15550100",
        consent={"status": "granted", "source": "synthetic", "conversation_window_open": True},
        synthetic=True,
        correlation_id=f"corr-{event_id}",
    )


class MemoryStore:
    def __init__(self) -> None:
        self.values: dict[str, dict[str, Any]] = {}
        self.lock = asyncio.Lock()

    async def rpc(self, name: str, payload: dict[str, Any]) -> dict[str, Any]:
        assert name == "ingest_source_event"
        async with self.lock:
            event_data = payload["p_payload"]["event"]
            key = f"{event_data['channel']}:{event_data['source_event_id']}"
            if key in self.values:
                return {**self.values[key], "replayed": True}
            value = payload["p_payload"]["result"]
            self.values[key] = value
            return value


@pytest.mark.parametrize(
    ("body", "kind"),
    [
        ("SSN 123-45-6789", "ssn"),
        ("cuenta número 12345678901", "account"),
        ("tarjeta 4111 1111 1111 1111", "card"),
        ("contraseña: secret-123", "credential"),
    ],
)
def test_sensitive_spans_are_typed_and_removed(body: str, kind: str) -> None:
    result = redact(body)
    assert kind in result.types
    assert "123-45-6789" not in result.text
    assert "secret-123" not in result.text


@pytest.mark.parametrize("body", ["Llámame al +15550100", "Debo aproximadamente $12,000"])
def test_allowed_phone_and_approximate_amount_are_not_redacted(body: str) -> None:
    assert redact(body).types == ()


def test_decisive_triage_and_minimal_extraction() -> None:
    opt_out = classify(event("No me contacten"), redact("No me contacten"))
    legal_risk = classify(
        event("Mi abogado presentará demanda"), redact("Mi abogado presentará demanda")
    )
    assert opt_out.reason_code == "explicit_opt_out"
    assert legal_risk.decision == "escalate_human"
    fields = extract_fields("Tengo $12,000 de tarjeta en TX y quiero un consejero")
    assert fields.model_dump() == {
        "approximate_debt": 12000,
        "debt_type": "credit_card",
        "state": "TX",
        "preferred_language": "es",
        "preferred_contact_time": None,
        "wants_counselor": True,
    }
    assert not ({"ssn", "income", "credit_score"} & fields.model_fields_set)


class RawAdapter:
    def __init__(self, value: str | Exception) -> None:
        self.value = value

    async def assist(self, redacted_text: str) -> str:
        assert "123-45-6789" not in redacted_text
        if isinstance(self.value, Exception):
            raise self.value
        return self.value


def valid_output(**changes: Any) -> str:
    value = {
        "classification": "respond",
        "summary": "Consulta segura",
        "fields": {},
        "confidence": 0.9,
        "draft": "Un consejero podría orientarte según tu situación.",
        **changes,
    }
    return json.dumps(value)


@pytest.mark.asyncio
async def test_no_key_is_an_intentional_deterministic_path() -> None:
    configured = Settings(
        "http://db", "anon", "service", ai_provider="openai", openai_model="gpt-test"
    )
    attempt = await run_assistance(configured, "safe")
    assert (attempt.status, attempt.failure_layer, attempt.normalized_reason) == (
        "skipped_configuration",
        "configuration",
        "missing_api_key",
    )


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("failure", "layer", "reason"),
    [
        (httpx.ConnectError("dns"), "transport", "connection_error"),
        (httpx.TimeoutException("slow"), "transport", "timeout"),
    ],
)
async def test_transport_taxonomy(failure: Exception, layer: str, reason: str) -> None:
    configured = Settings(
        "http://db",
        "anon",
        "service",
        ai_provider="openai",
        openai_api_key="test",
        openai_model="test",
    )
    attempt = await run_assistance(configured, "safe", RawAdapter(failure))
    assert (attempt.failure_layer, attempt.normalized_reason) == (layer, reason)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "status_code,reason",
    [(400, "invalid_request"), (401, "authentication"), (429, "rate_limit"), (503, "provider_5xx")],
)
async def test_provider_taxonomy(status_code: int, reason: str) -> None:
    request = httpx.Request("POST", "https://provider.invalid")
    failure = httpx.HTTPStatusError(
        "provider", request=request, response=httpx.Response(status_code, request=request)
    )
    configured = Settings(
        "http://db",
        "anon",
        "service",
        ai_provider="openai",
        openai_api_key="test",
        openai_model="test",
    )
    attempt = await run_assistance(configured, "safe", RawAdapter(failure))
    assert (attempt.failure_layer, attempt.normalized_reason) == ("provider", reason)


@pytest.mark.parametrize(
    ("raw", "reason"),
    [("not-json", "invalid_schema"), (valid_output(confidence=0.2), "low_confidence")],
)
def test_output_validation_taxonomy(raw: str, reason: str) -> None:
    with pytest.raises(ValueError, match=reason):
        validate_output(raw)


def test_prohibited_language_is_rejected() -> None:
    with pytest.raises(PermissionError, match="claim_guarantee"):
        validate_output(valid_output(draft="Garantizamos que tu deuda desaparecerá"))


def test_openai_request_is_redaction_bounded_and_not_stored() -> None:
    request = assistance_request("gpt-6-luna", "Tengo [REDACTED_ACCOUNT]")
    assert request["model"] == "gpt-6-luna"
    assert request["store"] is False
    assert "human review" in str(request["instructions"])
    assert request["text"]["format"]["strict"] is True
    schema = request["text"]["format"]["schema"]
    assert schema["required"] == list(schema["properties"])
    fields = schema["properties"]["fields"]
    assert fields["required"] == list(fields["properties"])
    assert schema["properties"]["draft"]["type"] == ["string", "null"]
    output = '{"classification":"respond"}'
    assert response_text({"output_text": output}) == output


@pytest.mark.asyncio
async def test_concurrent_replay_returns_stable_original_result() -> None:
    store = MemoryStore()
    first, second = await asyncio.gather(
        process_event(event("Tengo deuda de tarjeta en TX", "same"), SETTINGS, store=store),  # type: ignore[arg-type]
        process_event(event("Tengo deuda de tarjeta en TX", "same"), SETTINGS, store=store),  # type: ignore[arg-type]
    )
    assert first.decision_id == second.decision_id
    assert len(store.values) == 1
    assert {first.replayed, second.replayed} == {False, True}
    assert "redacted_message" not in safe_log_fields(first)
