from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Protocol

import httpx
from pydantic import ValidationError

from nueva_ruta_api.compliance import review_content
from nueva_ruta_api.config import Settings
from nueva_ruta_api.ingestion_models import AssistanceOutput


@dataclass(frozen=True)
class Attempt:
    status: str
    failure_layer: str
    normalized_reason: str
    provider: str
    model: str
    prompt_version: str = "wi004-v1"
    output: AssistanceOutput | None = None
    safe_metadata: dict[str, Any] | None = None


class AssistanceAdapter(Protocol):
    async def assist(self, redacted_text: str) -> str: ...


class OpenAIAdapter:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def assist(self, redacted_text: str) -> str:
        schema = AssistanceOutput.model_json_schema()
        async with httpx.AsyncClient(timeout=self.settings.request_timeout_seconds) as client:
            response = await client.post(
                "https://api.openai.com/v1/responses",
                headers={"Authorization": f"Bearer {self.settings.openai_api_key}"},
                json={
                    "model": self.settings.openai_model,
                    "input": redacted_text,
                    "text": {"format": {"type": "json_schema", "name": "assistance", "schema": schema, "strict": True}},
                },
            )
        response.raise_for_status()
        payload = response.json()
        return str(payload["output"][0]["content"][0]["text"])


def validate_output(raw: str, minimum_confidence: float = 0.75) -> AssistanceOutput:
    try:
        output = AssistanceOutput.model_validate_json(raw)
    except (ValidationError, ValueError, json.JSONDecodeError) as exc:
        raise ValueError("invalid_schema") from exc
    if output.confidence < minimum_confidence:
        raise ValueError("low_confidence")
    if output.draft:
        review = review_content(output.draft)
        if not review.valid:
            raise PermissionError(review.codes[0].casefold())
    return output


async def run_assistance(settings: Settings, redacted_text: str, adapter: AssistanceAdapter | None = None) -> Attempt:
    if settings.ai_provider != "openai":
        return Attempt("skipped_configuration", "configuration", "provider_disabled", "deterministic", "")
    if not settings.openai_api_key:
        return Attempt("skipped_configuration", "configuration", "missing_api_key", "openai", settings.openai_model)
    if not settings.openai_model:
        return Attempt("skipped_configuration", "configuration", "missing_model", "openai", "")
    selected = adapter or OpenAIAdapter(settings)
    try:
        raw = await selected.assist(redacted_text)
        output = validate_output(raw)
        return Attempt("succeeded", "none", "accepted", "openai", settings.openai_model, output=output)
    except httpx.TimeoutException:
        return Attempt("failed", "transport", "timeout", "openai", settings.openai_model)
    except httpx.ConnectError:
        return Attempt("failed", "transport", "connection_error", "openai", settings.openai_model)
    except httpx.HTTPStatusError as exc:
        reasons = {401: "authentication", 403: "authentication", 429: "rate_limit"}
        return Attempt("failed", "provider", reasons.get(exc.response.status_code, "provider_5xx"), "openai", settings.openai_model)
    except PermissionError as exc:
        return Attempt("rejected", "compliance", str(exc), "openai", settings.openai_model)
    except ValueError as exc:
        return Attempt("rejected", "output_validation", str(exc), "openai", settings.openai_model)

