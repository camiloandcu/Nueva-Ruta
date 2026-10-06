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
    prompt_version: str = "wi004-v2"
    output: AssistanceOutput | None = None
    safe_metadata: dict[str, Any] | None = None


class AssistanceAdapter(Protocol):
    async def assist(self, redacted_text: str) -> str: ...


class InvalidAssistanceSchema(ValueError):
    def __init__(self, field: str, issue_type: str) -> None:
        super().__init__("invalid_schema" if field == "document" else f"invalid_schema:{field}")
        self.field = field
        self.issue_type = issue_type


class OpenAIAdapter:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def assist(self, redacted_text: str) -> str:
        request_body = assistance_request(self.settings.openai_model, redacted_text)
        if self.settings.openai_model == "gpt-6-luna":
            request_body["reasoning"] = {"effort": "none"}
        async with httpx.AsyncClient(timeout=self.settings.request_timeout_seconds) as client:
            response = await client.post(
                "https://api.openai.com/v1/responses",
                headers={"Authorization": f"Bearer {self.settings.openai_api_key}"},
                json=request_body,
            )
        response.raise_for_status()
        return response_text(response.json())


def assistance_request(model: str, redacted_text: str) -> dict[str, Any]:
    """Build a privacy-bounded, schema-constrained assistance request."""
    # OpenAI strict schemas require every property, including nullable ones, in
    # `required`. Keep the request schema small; Pydantic validates the limits
    # and patterns again before any assisted result is used.
    nullable_string = {"type": ["string", "null"]}
    schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "classification": {"type": "string", "enum": ["respond", "ignore", "escalate_human"]},
            "summary": {"type": "string"},
            "fields": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "approximate_debt": {
                        "type": ["integer", "null"],
                        "minimum": 0,
                        "maximum": 1000000,
                    },
                    "debt_type": {
                        "type": ["string", "null"],
                        "enum": ["credit_card", "medical", "personal_loan", None],
                    },
                    "state": {"type": ["string", "null"], "pattern": "^[A-Z]{2}$"},
                    "preferred_language": {"type": ["string", "null"], "enum": ["es", "en", None]},
                    "preferred_contact_time": nullable_string,
                    "wants_counselor": {"type": ["boolean", "null"]},
                },
                "required": [
                    "approximate_debt",
                    "debt_type",
                    "state",
                    "preferred_language",
                    "preferred_contact_time",
                    "wants_counselor",
                ],
            },
            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
            "draft": nullable_string,
        },
        "required": ["classification", "summary", "fields", "confidence", "draft"],
    }
    return {
        "model": model,
        "store": False,
        "instructions": (
            "You assist a Spanish-language debt-intake operator. The message has already "
            "been redacted. Return only the requested schema. Do not promise outcomes, "
            "give legal or financial advice, request account numbers, or claim a decision "
            "is final. Suggest a neutral Spanish draft only when it is safe. Deterministic "
            "policy and human review, not you, control routing and delivery. "
            "In draft, never repeat numbers, dollar amounts or percentages from the input; "
            "keep figures only in the structured extraction fields. Use a two-letter uppercase "
            "US state code or null, an integer debt amount from 0 to 1000000 or null, and "
            "confidence between 0 and 1. Keep summary under 500 characters and draft under 1200."
        ),
        "input": redacted_text,
        "text": {
            "format": {
                "type": "json_schema",
                "name": "assistance",
                "schema": schema,
                "strict": True,
            }
        },
    }


def response_text(payload: dict[str, Any]) -> str:
    """Read structured output without assuming its first output item is text."""
    output_text = payload.get("output_text")
    if isinstance(output_text, str) and output_text:
        return output_text
    for item in payload.get("output", []):
        if not isinstance(item, dict):
            continue
        for content in item.get("content", []):
            if isinstance(content, dict) and isinstance(content.get("text"), str):
                return str(content["text"])
    raise ValueError("missing_output_text")


def validate_output(raw: str, minimum_confidence: float = 0.75) -> AssistanceOutput:
    try:
        output = AssistanceOutput.model_validate_json(raw)
    except ValidationError as exc:
        first = exc.errors(include_input=False, include_url=False)[0]
        allowed = {
            "classification",
            "summary",
            "fields",
            "approximate_debt",
            "debt_type",
            "state",
            "preferred_language",
            "preferred_contact_time",
            "wants_counselor",
            "confidence",
            "draft",
        }
        field = ".".join(str(part) for part in first["loc"] if part in allowed) or "document"
        raise InvalidAssistanceSchema(field, str(first["type"])) from exc
    except (ValueError, json.JSONDecodeError) as exc:
        raise InvalidAssistanceSchema("document", "json_invalid") from exc
    if output.confidence < minimum_confidence:
        raise ValueError("low_confidence")
    if output.draft:
        review = review_content(output.draft)
        if not review.valid:
            raise PermissionError(review.codes[0].casefold())
    return output


async def run_assistance(
    settings: Settings, redacted_text: str, adapter: AssistanceAdapter | None = None
) -> Attempt:
    if settings.ai_provider != "openai":
        return Attempt(
            "skipped_configuration", "configuration", "provider_disabled", "deterministic", ""
        )
    if not settings.openai_api_key:
        return Attempt(
            "skipped_configuration",
            "configuration",
            "missing_api_key",
            "openai",
            settings.openai_model,
        )
    if not settings.openai_model:
        return Attempt("skipped_configuration", "configuration", "missing_model", "openai", "")
    selected = adapter or OpenAIAdapter(settings)
    try:
        raw = await selected.assist(redacted_text)
        output = validate_output(raw)
        return Attempt(
            "succeeded", "none", "accepted", "openai", settings.openai_model, output=output
        )
    except httpx.TimeoutException:
        return Attempt("failed", "transport", "timeout", "openai", settings.openai_model)
    except httpx.ConnectError:
        return Attempt("failed", "transport", "connection_error", "openai", settings.openai_model)
    except httpx.HTTPStatusError as exc:
        reasons = {
            400: "invalid_request",
            401: "authentication",
            403: "authentication",
            404: "model_unavailable",
            429: "rate_limit",
        }
        return Attempt(
            "failed",
            "provider",
            reasons.get(exc.response.status_code, "provider_5xx"),
            "openai",
            settings.openai_model,
        )
    except PermissionError as exc:
        return Attempt("rejected", "compliance", str(exc), "openai", settings.openai_model)
    except InvalidAssistanceSchema as exc:
        return Attempt(
            "rejected",
            "output_validation",
            str(exc),
            "openai",
            settings.openai_model,
            safe_metadata={"validation_field": exc.field, "validation_type": exc.issue_type},
        )
    except ValueError as exc:
        return Attempt("rejected", "output_validation", str(exc), "openai", settings.openai_model)
