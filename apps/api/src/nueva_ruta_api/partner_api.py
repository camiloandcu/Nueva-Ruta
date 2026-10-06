from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID, uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from nueva_ruta_api.auth import Principal, Role, get_settings, require_roles
from nueva_ruta_api.config import Settings
from nueva_ruta_api.ingestion_store import IngestionStore
from nueva_ruta_api.partner_reconciliation import (
    MAX_FILE_BYTES,
    NORMALIZATION_VERSION,
    CsvImportError,
    build_analysis,
    canonical_json_checksum,
    parse_partner_csv,
)

router = APIRouter(prefix="/v1/partner-imports", tags=["partner reconciliation"])
Operator = Annotated[Principal, Depends(require_roles(Role.OPERATOR, Role.SUPERVISOR))]
Reviewer = Annotated[Principal, Depends(require_roles(Role.ANALYST, Role.SUPERVISOR))]
Viewer = Annotated[Principal, Depends(require_roles(Role.OPERATOR, Role.ANALYST, Role.SUPERVISOR))]
Config = Annotated[Settings, Depends(get_settings)]


class ReviewRequest(BaseModel):
    action: Literal["accept", "reject", "link"]
    reason: str = Field(min_length=1, max_length=500)
    correlation_id: str = Field(min_length=1, max_length=100)
    lead_id: UUID | None = None


async def _rpc(store: IngestionStore, name: str, payload: dict[str, object]) -> dict[str, object]:
    try:
        return await store.rpc(name, {"p_payload": payload})
    except httpx.HTTPStatusError as exc:
        code = exc.response.status_code
        if code == status.HTTP_403_FORBIDDEN:
            raise HTTPException(code, "Role is not authorized for this partner operation") from exc
        if code == status.HTTP_404_NOT_FOUND:
            raise HTTPException(code, "Partner import or reconciliation case not found") from exc
        if code == status.HTTP_400_BAD_REQUEST:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, "Partner command was rejected"
            ) from exc
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Partner data store unavailable"
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Partner data store unavailable"
        ) from exc


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_partner_csv(
    request: Request,
    principal: Operator,
    settings: Config,
    filename: Annotated[str, Query(min_length=1, max_length=180)],
    synthetic: Annotated[bool, Query()],
) -> dict[str, object]:
    if not synthetic:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Only synthetic demo CSV files are accepted"
        )
    if not filename.lower().endswith(".csv") or "/" in filename or "\\" in filename:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Provide a plain .csv filename")
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_FILE_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "CSV exceeds the 5 MiB upload limit")
    content = bytearray()
    async for chunk in request.stream():
        content.extend(chunk)
        if len(content) > MAX_FILE_BYTES:
            raise HTTPException(
                status.HTTP_413_CONTENT_TOO_LARGE, "CSV exceeds the 5 MiB upload limit"
            )
    try:
        rows, file_checksum = parse_partner_csv(bytes(content))
    except CsvImportError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    payload_rows = [
        {
            "row_number": number,
            "row_checksum": canonical_json_checksum(row),
            "source_values": row,
        }
        for number, row in enumerate(rows, start=1)
    ]
    correlation_id = f"partner-import-{uuid4()}"
    result = await _rpc(
        IngestionStore(settings),
        "create_partner_import",
        {
            "actor_id": str(principal.id),
            "correlation_id": correlation_id,
            "filename": filename,
            "file_checksum": file_checksum,
            "synthetic": True,
            "rows": payload_rows,
        },
    )
    return result


@router.get("")
async def list_partner_imports(_: Viewer, settings: Config) -> list[dict[str, object]]:
    store = IngestionStore(settings)
    try:
        jobs = await store.select_rows(
            "partner_import_jobs",
            select="id,business_id,filename,file_checksum,imported_at",
            filters={"synthetic": "eq.true"},
            order="imported_at.desc",
        )
        for job in jobs:
            raw_rows = await store.select_rows(
                "raw_partner_rows",
                select="id",
                filters={"import_job_id": f"eq.{job['id']}"},
            )
            job["row_count"] = len(raw_rows)
            normalized = await store.select_rows(
                "partner_normalized_rows",
                select="id,raw_partner_rows!inner(import_job_id)",
                filters={
                    "normalization_version": f"eq.{NORMALIZATION_VERSION}",
                    "raw_partner_rows.import_job_id": f"eq.{job['id']}",
                },
            )
            job["normalized_count"] = len(normalized)
        return jobs
    except httpx.HTTPError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Partner imports unavailable"
        ) from exc


@router.get("/reconciliation/queue")
async def reconciliation_queue(_: Viewer, settings: Config) -> list[dict[str, object]]:
    try:
        return await IngestionStore(settings).select_rows(
            "partner_reconciliation_cases",
            select="*,partner_canonical_enrollments(canonical_key,partner_enrollment_id,canonical_values,source_row_numbers,quality_issues,conflicted),partner_reconciliation_candidates(lead_id,match_method,evidence,leads(business_id)),partner_reconciliation_decisions(action,reason,created_at,actor_id,lead_id)",
            order="updated_at.desc",
        )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Reconciliation queue unavailable"
        ) from exc


@router.get("/reconciliation/available-leads")
async def reconciliation_available_leads(_: Reviewer, settings: Config) -> list[dict[str, object]]:
    """Offer business-labeled CRM cases for a deliberate manual match."""
    try:
        return await IngestionStore(settings).select_rows(
            "operational_crm_leads",
            select="id,business_id,commercial_stage",
            order="business_id.asc",
        )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Case choices unavailable"
        ) from exc


@router.get("/{import_job_id}/quality")
async def import_quality(
    import_job_id: UUID, _: Viewer, settings: Config
) -> list[dict[str, object]]:
    try:
        return await IngestionStore(settings).select_rows(
            "partner_normalized_rows",
            select="*,raw_partner_rows!inner(row_number,source_values,defect_tags)",
            filters={
                "normalization_version": f"eq.{NORMALIZATION_VERSION}",
                "raw_partner_rows.import_job_id": f"eq.{import_job_id}",
            },
            order="created_at.asc",
        )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Partner quality issues unavailable"
        ) from exc


async def _analyze_import(
    import_job_id: UUID, actor: UUID | None, settings: Settings
) -> dict[str, object]:
    store = IngestionStore(settings)
    try:
        jobs = await store.select_rows(
            "partner_import_jobs",
            select="id,imported_at",
            filters={"id": f"eq.{import_job_id}"},
        )
        if not jobs:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Partner import not found")
        raw_rows = await store.select_rows(
            "raw_partner_rows",
            select="id,row_number,row_checksum,source_values,defect_tags",
            filters={"import_job_id": f"eq.{import_job_id}"},
            order="row_number.asc",
        )
        leads_raw = await store.select_rows(
            "leads",
            select="id,business_id,creator_id,fictional_phone,received_at,creators(business_id)",
            filters={"synthetic": "eq.true"},
        )
        leads = []
        for lead in leads_raw:
            creator = lead.pop("creators", None)
            if isinstance(creator, list):
                creator = creator[0] if creator else None
            lead["creator_business_id"] = (
                creator.get("business_id") if isinstance(creator, dict) else None
            )
            leads.append(lead)
        transfers_raw = await store.select_rows(
            "partner_transfers",
            select="partner_request_id,crm_lead_states(baseline_lead_id)",
        )
        transfers = []
        for transfer in transfers_raw:
            state_rows = transfer.get("crm_lead_states") or []
            if isinstance(state_rows, dict):
                state_rows = [state_rows]
            if state_rows:
                transfers.append(
                    {**transfer, "baseline_lead_id": state_rows[0].get("baseline_lead_id")}
                )
        reference = datetime.fromisoformat(str(jobs[0]["imported_at"]).replace("Z", "+00:00"))
        analysis = build_analysis(raw_rows, leads, transfers, reference)
        payload: dict[str, object] = {
            "import_job_id": str(import_job_id),
            "normalization_version": NORMALIZATION_VERSION,
            "normalized_rows": analysis["normalized_rows"],
            "duplicate_groups": analysis["duplicate_groups"],
            "canonical_rows": analysis["canonical_rows"],
            "reconciliation_cases": analysis["reconciliation_cases"],
            "actor_id": str(actor) if actor else None,
            "correlation_id": f"partner-analysis-{uuid4()}",
        }
        return await _rpc(store, "persist_partner_analysis", payload)
    except HTTPException:
        raise
    except httpx.HTTPError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Partner analysis inputs unavailable"
        ) from exc


@router.post("/{import_job_id}/process")
async def process_partner_import(
    import_job_id: UUID, principal: Operator, settings: Config
) -> dict[str, object]:
    return await _analyze_import(import_job_id, principal.id, settings)


@router.post("/reconciliation/{case_id}/review")
async def review_reconciliation(
    case_id: UUID, request: ReviewRequest, principal: Reviewer, settings: Config
) -> dict[str, object]:
    payload: dict[str, object] = request.model_dump(mode="json")
    payload["case_id"] = str(case_id)
    payload["actor_id"] = str(principal.id)
    return await _rpc(IngestionStore(settings), "review_partner_reconciliation", payload)
