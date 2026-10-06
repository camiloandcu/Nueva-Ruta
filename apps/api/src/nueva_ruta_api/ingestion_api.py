from typing import Annotated, Any
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from nueva_ruta_api.auth import Principal, Role, get_settings, require_roles
from nueva_ruta_api.compliance import review_content
from nueva_ruta_api.config import Settings
from nueva_ruta_api.ingestion_models import InboundEvent, ProcessingResult
from nueva_ruta_api.ingestion_service import process_event
from nueva_ruta_api.ingestion_store import IngestionStore

router = APIRouter(prefix="/v1", tags=["ingestion"])
Operator = Annotated[Principal, Depends(require_roles(Role.OPERATOR, Role.SUPERVISOR))]
Supervisor = Annotated[Principal, Depends(require_roles(Role.SUPERVISOR))]
Config = Annotated[Settings, Depends(get_settings)]


class ApprovalRequest(BaseModel):
    content: str = Field(min_length=1, max_length=1200)
    correlation_id: str = Field(min_length=1, max_length=100)


@router.post(
    "/ingestion/events", response_model=ProcessingResult, status_code=status.HTTP_201_CREATED
)
async def ingest(event: InboundEvent, _: Operator, settings: Config) -> ProcessingResult:
    try:
        return await process_event(event, settings)
    except httpx.HTTPError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Ingestion store unavailable"
        ) from exc


@router.get("/ingestion/results/{channel}/{source_event_id}", response_model=ProcessingResult)
async def result(
    channel: str, source_event_id: str, _: Operator, settings: Config
) -> dict[str, Any]:
    try:
        return await IngestionStore(settings).rpc(
            "source_event_result", {"p_channel": channel, "p_source_event_id": source_event_id}
        )
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Result not found") from exc
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Ingestion store unavailable"
        ) from exc


@router.get("/operational/redacted-leads")
async def redacted_leads(_: Operator, settings: Config) -> list[dict[str, Any]]:
    store = IngestionStore(settings)
    leads = await store.rows("operational_redacted_leads", order="received_at.desc")
    fields_by_decision: dict[str, dict[str, Any]] = {}
    decision_ids = [str(lead["decision_id"]) for lead in leads]
    for offset in range(0, len(decision_ids), 100):
        batch = decision_ids[offset : offset + 100]
        rows = await store.select_rows(
            "extracted_lead_fields",
            select="decision_id,approved_fields,source,corrected_at",
            filters={"decision_id": f"in.({','.join(batch)})"},
        )
        fields_by_decision.update({str(row["decision_id"]): row for row in rows})
    for lead in leads:
        extracted = fields_by_decision.get(str(lead["decision_id"]))
        lead["extracted_fields"] = extracted["approved_fields"] if extracted else None
        lead["extraction_source"] = extracted["source"] if extracted else None
        lead["extraction_corrected_at"] = extracted["corrected_at"] if extracted else None
    return leads


@router.get("/drafts/pending")
async def pending_drafts(_: Operator, settings: Config) -> list[dict[str, Any]]:
    return await IngestionStore(settings).rows(
        "response_drafts", filters={"status": "eq.pending"}, order="created_at.asc"
    )


@router.get("/drafts")
async def drafts(_: Operator, settings: Config) -> list[dict[str, Any]]:
    return await IngestionStore(settings).rows("response_drafts", order="created_at.desc")


@router.post("/drafts/{draft_id}/approve")
async def approve_draft(
    draft_id: UUID, request: ApprovalRequest, principal: Operator, settings: Config
) -> dict[str, Any]:
    review = review_content(request.content)
    try:
        value = await IngestionStore(settings).rpc(
            "review_response_draft",
            {
                "p_draft_id": str(draft_id),
                "p_actor_id": str(principal.id),
                "p_content": request.content,
                "p_checksum": review.checksum,
                "p_violation_codes": list(review.codes),
                "p_correlation_id": request.correlation_id,
            },
        )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Draft review unavailable"
        ) from exc
    if not review.valid:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, value)
    return value


@router.get("/operations/ai")
async def ai_operations(
    _: Supervisor,
    settings: Config,
    correlation_id: Annotated[str | None, Query(max_length=100)] = None,
    status_filter: Annotated[str | None, Query(alias="status", max_length=40)] = None,
) -> list[dict[str, Any]]:
    filters = {}
    if correlation_id:
        filters["correlation_id"] = f"eq.{correlation_id}"
    if status_filter:
        filters["status"] = f"eq.{status_filter}"
    return await IngestionStore(settings).rows(
        "operational_assistance_attempts", filters=filters, order="created_at.desc"
    )
