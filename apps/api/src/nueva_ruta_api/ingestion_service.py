from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from nueva_ruta_api.ai_assistance import AssistanceAdapter, run_assistance
from nueva_ruta_api.config import Settings
from nueva_ruta_api.ingestion_models import ApprovedFields, InboundEvent, ProcessingResult
from nueva_ruta_api.ingestion_store import IngestionStore
from nueva_ruta_api.redaction import redact
from nueva_ruta_api.triage import classify, stable_id


async def process_event(
    event: InboundEvent,
    settings: Settings,
    *,
    store: IngestionStore | None = None,
    adapter: AssistanceAdapter | None = None,
) -> ProcessingResult:
    redaction = redact(event.message)
    outcome = classify(event, redaction)
    attempt = await run_assistance(settings, redaction.text, adapter)
    decision_source = "deterministic"
    draft = outcome.draft
    fields = outcome.fields
    if attempt.output and outcome.decision != "ignore":
        fields = ApprovedFields.model_validate(
            {
                name: getattr(fields, name)
                if getattr(fields, name) is not None
                else getattr(attempt.output.fields, name)
                for name in ApprovedFields.model_fields
            }
        )
        if outcome.decision == "respond":
            draft = attempt.output.draft or draft
        decision_source = "ai_assisted"
    elif attempt.status in {"failed", "rejected"}:
        decision_source = "deterministic_fallback"

    lead_id = stable_id("lead", event)
    message_id = stable_id("message", event)
    decision_id = stable_id("decision", event)
    draft_id = stable_id("draft", event) if outcome.decision == "respond" else None
    escalation_id = (
        stable_id("escalation", event, outcome.reason_code)
        if outcome.decision == "escalate_human" or attempt.status in {"failed", "rejected"}
        else None
    )
    result = ProcessingResult(
        lead_id=lead_id,
        message_id=message_id,
        decision_id=decision_id,
        correlation_id=event.correlation_id,
        decision=outcome.decision,  # type: ignore[arg-type]
        reason_code=outcome.reason_code,
        decision_source=decision_source,  # type: ignore[arg-type]
        ai_attempt_status=attempt.status,  # type: ignore[arg-type]
        failure_layer=attempt.failure_layer,  # type: ignore[arg-type]
        normalized_reason=attempt.normalized_reason,
        redacted_message=redaction.text,
        redaction_types=list(redaction.types),
        extracted_fields=fields,
        draft_id=draft_id,
        escalation_id=escalation_id,
    )
    persistence = {
        "event": event.model_dump(mode="json"),
        "result": result.model_dump(mode="json"),
        "restricted_body": event.message,
        "redacted_body": redaction.text,
        "redaction_types": list(redaction.types),
        "draft_body": draft,
        "explanation": outcome.explanation,
        "escalation": {
            "priority": outcome.escalation_priority or "normal",
            "due_at": (datetime.now(UTC) + timedelta(minutes=30)).isoformat(),
            "suggested_role": "supervisor",
        },
        "attempt": {
            "provider": attempt.provider,
            "model": attempt.model,
            "prompt_version": attempt.prompt_version,
            "safe_metadata": attempt.safe_metadata or {},
        },
        "automatic_purpose": outcome.automatic_purpose,
    }
    saved = await (store or IngestionStore(settings)).rpc(
        "ingest_source_event", {"p_payload": persistence}
    )
    return ProcessingResult.model_validate(saved)


def safe_log_fields(result: ProcessingResult) -> dict[str, Any]:
    return {
        "correlation_id": result.correlation_id,
        "decision_id": result.decision_id,
        "decision": result.decision,
        "ai_attempt_status": result.ai_attempt_status,
        "failure_layer": result.failure_layer,
        "normalized_reason": result.normalized_reason,
        "redaction_types": result.redaction_types,
    }
