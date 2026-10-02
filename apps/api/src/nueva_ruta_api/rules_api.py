from typing import Annotated, Any
from uuid import UUID

import httpx
import yaml  # type: ignore[import-untyped]
from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field, ValidationError

from nueva_ruta_api.auth import Principal, Role, get_settings, require_roles
from nueva_ruta_api.config import Settings
from nueva_ruta_api.rule_store import RuleStore
from nueva_ruta_api.rules import (
    RuleDocument,
    canonical_content,
    compliance_violations,
    content_hash,
    export_yaml,
    normalized_diff,
    parse_yaml,
    validation_issues,
)

router = APIRouter(prefix="/v1/rules", tags=["rules"])
Reviewer = Annotated[Principal, Depends(require_roles(Role.OPERATOR, Role.SUPERVISOR))]
Supervisor = Annotated[Principal, Depends(require_roles(Role.SUPERVISOR))]
Config = Annotated[Settings, Depends(get_settings)]


class ImportRequest(BaseModel):
    yaml: str = Field(min_length=1)
    source_name: str = Field(min_length=1, max_length=200)


class PublishRequest(BaseModel):
    content_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    reason: str = Field(min_length=1, max_length=200)
    correlation_id: str = Field(min_length=1, max_length=100)


class RollbackRequest(BaseModel):
    version_id: UUID
    reason: str = Field(min_length=1, max_length=200)


async def one(store: RuleStore, table: str, row_id: UUID) -> dict[str, Any]:
    rows = await store.rows(table, filters={"id": f"eq.{row_id}"})
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{table} record not found")
    return rows[0]


def document_from(row: dict[str, Any]) -> RuleDocument:
    return RuleDocument.model_validate(row["content"])


@router.get("/versions")
async def history(_: Reviewer, settings: Config) -> list[dict[str, Any]]:
    try:
        return await RuleStore(settings).rows("rule_versions", order="version.desc")
    except httpx.HTTPError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Rule store unavailable") from exc


@router.get("/active")
async def active(_: Reviewer, settings: Config) -> dict[str, Any]:
    try:
        rows = await RuleStore(settings).rows("rule_versions", filters={"active": "eq.true"})
    except httpx.HTTPError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Rule store unavailable") from exc
    if not rows:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No active rule version")
    return rows[0]


@router.get("/drafts/{draft_id}")
async def draft(draft_id: UUID, _: Reviewer, settings: Config) -> dict[str, Any]:
    try:
        return await one(RuleStore(settings), "rule_drafts", draft_id)
    except httpx.HTTPError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Rule store unavailable") from exc


@router.post("/drafts/import", status_code=status.HTTP_201_CREATED)
async def import_draft(
    request: ImportRequest, principal: Reviewer, settings: Config
) -> dict[str, Any]:
    try:
        document = parse_yaml(request.yaml)
    except (ValidationError, ValueError, yaml.YAMLError) as exc:
        issues = validation_issues(
            exc if isinstance(exc, (ValidationError, ValueError)) else ValueError(str(exc))
        )
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, [item.model_dump() for item in issues]
        ) from exc
    violations = compliance_violations(document)
    payload = {
        "content": canonical_content(document),
        "content_hash": content_hash(document),
        "valid": not violations,
        "validation_issues": [item.model_dump() for item in violations],
        "source_name": request.source_name,
        "created_by": str(principal.id),
    }
    try:
        return await RuleStore(settings).create_draft(payload)
    except httpx.HTTPError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Rule import failed") from exc


@router.get("/drafts/{draft_id}/validate")
async def validate_draft(draft_id: UUID, _: Reviewer, settings: Config) -> dict[str, Any]:
    try:
        row = await one(RuleStore(settings), "rule_drafts", draft_id)
        document = document_from(row)
    except httpx.HTTPError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Rule store unavailable") from exc
    violations = compliance_violations(document)
    return {
        "valid": not violations,
        "issues": [],
        "compliance": [item.model_dump() for item in violations],
        "content_hash": content_hash(document),
    }


@router.get("/drafts/{draft_id}/diff")
async def diff_draft(draft_id: UUID, _: Reviewer, settings: Config) -> dict[str, Any]:
    store = RuleStore(settings)
    try:
        draft_row = await one(store, "rule_drafts", draft_id)
        active_rows = await store.rows("rule_versions", filters={"active": "eq.true"})
    except httpx.HTTPError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Rule store unavailable") from exc
    changes = (
        normalized_diff(document_from(active_rows[0]), document_from(draft_row))
        if active_rows
        else []
    )
    return {"changes": changes, "duplicate": not changes, "content_hash": draft_row["content_hash"]}


@router.get("/{kind}/{row_id}/export", response_class=Response)
async def export_rule(kind: str, row_id: UUID, _: Reviewer, settings: Config) -> Response:
    table = {"drafts": "rule_drafts", "versions": "rule_versions"}.get(kind)
    if table is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown rule resource")
    try:
        row = await one(RuleStore(settings), table, row_id)
    except httpx.HTTPError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Rule store unavailable") from exc
    return Response(export_yaml(document_from(row)), media_type="application/yaml")


@router.post("/drafts/{draft_id}/publish")
async def publish(
    draft_id: UUID, request: PublishRequest, principal: Supervisor, settings: Config
) -> dict[str, Any]:
    try:
        return await RuleStore(settings).rpc(
            "publish_rule_draft",
            {
                "p_draft_id": str(draft_id),
                "p_actor_id": str(principal.id),
                "p_confirmed_hash": request.content_hash,
                "p_reason": request.reason,
                "p_correlation_id": request.correlation_id,
            },
        )
    except httpx.HTTPStatusError as exc:
        detail = "Publication rejected by rule store"
        if exc.response.status_code == 409:
            detail = "Draft hash is stale or duplicates the active version"
        raise HTTPException(status.HTTP_409_CONFLICT, detail) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Rule publication failed") from exc


@router.post("/rollback-drafts", status_code=status.HTTP_201_CREATED)
async def rollback_draft(
    request: RollbackRequest, principal: Supervisor, settings: Config
) -> dict[str, Any]:
    store = RuleStore(settings)
    try:
        version = await one(store, "rule_versions", request.version_id)
        return await store.create_draft(
            {
                "content": version["content"],
                "content_hash": version["content_hash"],
                "valid": True,
                "validation_issues": [],
                "source_name": f"rollback: {request.reason}",
                "created_by": str(principal.id),
                "derived_from_version_id": str(request.version_id),
            }
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Rollback draft failed") from exc
