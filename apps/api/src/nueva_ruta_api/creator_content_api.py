from datetime import UTC, datetime
from typing import Annotated, Any, Literal, NoReturn
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field

from nueva_ruta_api.auth import Principal, Role, get_settings, require_roles
from nueva_ruta_api.compliance import review_script_content
from nueva_ruta_api.config import Settings
from nueva_ruta_api.creator_content import creator_profiles, script_library, source_ranking
from nueva_ruta_api.ingestion_store import IngestionStore

router = APIRouter(prefix="/v1", tags=["creator content planning"])
Viewer = Annotated[
    Principal,
    Depends(require_roles(Role.OPERATOR, Role.SUPERVISOR, Role.ANALYST)),
]
Author = Annotated[Principal, Depends(require_roles(Role.OPERATOR, Role.SUPERVISOR))]
Reviewer = Annotated[Principal, Depends(require_roles(Role.SUPERVISOR))]
Config = Annotated[Settings, Depends(get_settings)]


class StrictRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ScriptVersionRequest(StrictRequest):
    creator_id: str = Field(pattern=r"^CR-[0-9]{3}$")
    source_id: str = Field(pattern=r"^SRC-[0-9]{3}$")
    fit_rationale: str = Field(min_length=10, max_length=600)
    body: str = Field(min_length=100, max_length=5000)


class ScriptReviewRequest(StrictRequest):
    decision: Literal["approved", "changes_requested", "rejected"]
    reason: str = Field(min_length=5, max_length=500)


def _store_error(exc: httpx.HTTPStatusError) -> NoReturn:
    try:
        detail = exc.response.json()
        code = detail.get("code") if isinstance(detail, dict) else None
    except ValueError:
        code = None
    if code == "42501" or exc.response.status_code == status.HTTP_403_FORBIDDEN:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Role is not authorized") from exc
    if code == "P0002" or exc.response.status_code == status.HTTP_404_NOT_FOUND:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Creator content record not found") from exc
    if code == "23505":
        raise HTTPException(
            status.HTTP_409_CONFLICT, "This script version already has a review"
        ) from exc
    if code in {"22023", "23514", "23503"}:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Creator content command was rejected"
        ) from exc
    raise HTTPException(
        status.HTTP_503_SERVICE_UNAVAILABLE, "Creator content store unavailable"
    ) from exc


async def _facts(principal: Principal, settings: Settings) -> dict[str, Any]:
    try:
        return await IngestionStore(settings).rpc(
            "creator_content_facts", {"p_actor_id": str(principal.id)}
        )
    except httpx.HTTPStatusError as exc:
        _store_error(exc)
    except httpx.HTTPError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Creator content store unavailable"
        ) from exc


@router.get("/creator-content/access")
async def creator_content_access(principal: Viewer) -> dict[str, bool | str]:
    return {
        "role": principal.role.value,
        "can_author": principal.role in {Role.OPERATOR, Role.SUPERVISOR},
        "can_review": principal.role == Role.SUPERVISOR,
    }


@router.get("/creators")
async def list_creators(principal: Viewer, settings: Config) -> list[dict[str, Any]]:
    facts = await _facts(principal, settings)
    return creator_profiles(facts)


@router.get("/creators/{business_id}")
async def get_creator(business_id: str, principal: Viewer, settings: Config) -> dict[str, Any]:
    if len(business_id) != 6 or not business_id.startswith("CR-") or not business_id[3:].isdigit():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Invalid creator ID")
    facts = await _facts(principal, settings)
    creator = next(
        (row for row in creator_profiles(facts) if row["business_id"] == business_id), None
    )
    if creator is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Creator not found")
    return creator


@router.get("/content/sources/ranking")
async def rank_content_sources(
    principal: Viewer,
    settings: Config,
    as_of: Annotated[datetime | None, Query()] = None,
) -> dict[str, Any]:
    instant = as_of or datetime.now(UTC)
    if instant.tzinfo is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "as_of must include a timezone")
    return source_ranking(await _facts(principal, settings), as_of=instant.astimezone(UTC))


@router.get("/content/scripts")
async def list_scripts(principal: Viewer, settings: Config) -> list[dict[str, Any]]:
    return script_library(
        await _facts(principal, settings), include_review_reason=principal.role != Role.ANALYST
    )


@router.post("/content/scripts/{script_id}/versions", status_code=status.HTTP_201_CREATED)
async def create_script_version(
    script_id: UUID,
    request: ScriptVersionRequest,
    principal: Author,
    settings: Config,
) -> dict[str, Any]:
    facts = await _facts(principal, settings)
    script = next((item for item in facts["scripts"] if item["id"] == str(script_id)), None)
    creator = next(
        (item for item in facts["creators"] if item["business_id"] == request.creator_id), None
    )
    source = next(
        (item for item in facts["sources"] if item["business_id"] == request.source_id), None
    )
    if script is None or creator is None or source is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Script, creator or source not found")
    if source["compliance_risk"] == "high":
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "High-risk sources cannot be used for scripts"
        )
    review = review_script_content(request.body)
    if not review.valid:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            {"detail": "Script failed compliance review", "codes": list(review.codes)},
        )
    word_count = len(request.body.split())
    duration = round(word_count * 60 / 135, 2)
    if not 30 <= duration <= 45:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            {
                "detail": "Script estimate must be between 30 and 45 seconds",
                "word_count": word_count,
            },
        )
    try:
        result = await IngestionStore(settings).rpc(
            "create_creator_script_version",
            {
                "p_actor_id": str(principal.id),
                "p_script_id": str(script_id),
                "p_creator_id": creator["id"],
                "p_source_id": source["id"],
                "p_fit_rationale": request.fit_rationale,
                "p_body": request.body,
                "p_body_checksum": review.checksum,
                "p_word_count": word_count,
                "p_duration_seconds": duration,
            },
        )
    except httpx.HTTPStatusError as exc:
        _store_error(exc)
    except httpx.HTTPError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Script version could not be stored"
        ) from exc
    return {
        **result,
        "word_count": word_count,
        "estimated_duration_seconds": duration,
        "body_checksum": review.checksum,
        "compliance_valid": True,
        "compliance_codes": [],
    }


@router.post("/content/script-versions/{version_id}/review")
async def review_script_version(
    version_id: UUID,
    request: ScriptReviewRequest,
    principal: Reviewer,
    settings: Config,
) -> dict[str, Any]:
    facts = await _facts(principal, settings)
    version = next(
        (
            version
            for script in facts["scripts"]
            for version in script["versions"]
            if version["id"] == str(version_id)
        ),
        None,
    )
    if version is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Script version not found")
    script = next(
        item
        for item in facts["scripts"]
        if any(row["id"] == str(version_id) for row in item["versions"])
    )
    if int(version["version"]) != max(int(row["version"]) for row in script["versions"]):
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Only the latest script version can be reviewed"
        )
    review = review_script_content(str(version["body"]))
    if not review.valid:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            {"detail": "Script failed compliance review", "codes": list(review.codes)},
        )
    source = next(
        (item for item in facts["sources"] if item["business_id"] == version["source_id"]), None
    )
    if source is None or source["compliance_risk"] == "high":
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Script source is not approvable"
        )
    try:
        return await IngestionStore(settings).rpc(
            "review_creator_script_version",
            {
                "p_actor_id": str(principal.id),
                "p_version_id": str(version_id),
                "p_decision": request.decision,
                "p_reason": request.reason,
            },
        )
    except httpx.HTTPStatusError as exc:
        _store_error(exc)
    except httpx.HTTPError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Script review could not be stored"
        ) from exc
