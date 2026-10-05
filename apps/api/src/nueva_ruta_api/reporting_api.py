from datetime import UTC, date, datetime
from typing import Annotated, Any
from uuid import UUID
from zoneinfo import ZoneInfoNotFoundError

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status

from nueva_ruta_api.auth import Principal, Role, get_settings, require_roles
from nueva_ruta_api.config import Settings
from nueva_ruta_api.ingestion_store import IngestionStore
from nueva_ruta_api.reporting import available_filter_options, build_operational_report

router = APIRouter(prefix="/v1/reports", tags=["operational reporting"])
Viewer = Annotated[Principal, Depends(require_roles(Role.OPERATOR, Role.SUPERVISOR, Role.ANALYST))]
Config = Annotated[Settings, Depends(get_settings)]
ALLOWED_STATES = {"CA", "FL", "TX"}
ALLOWED_CHANNELS = {"ctwa", "organic"}


@router.get("/filter-options")
async def filter_options(principal: Viewer, settings: Config) -> dict[str, list[str] | bool]:
    try:
        facts = await IngestionStore(settings).rpc(
            "operational_reporting_facts", {"p_actor_id": str(principal.id)}
        )
        return {
            **available_filter_options(facts),
            "can_open_crm": principal.role in {Role.OPERATOR, Role.SUPERVISOR},
        }
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == status.HTTP_403_FORBIDDEN:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Role is not authorized for reports"
            ) from exc
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Reporting facts unavailable"
        ) from exc
    except (httpx.HTTPError, TypeError, ValueError) as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Reporting facts unavailable"
        ) from exc


def _validate_filters(
    from_date: date | None,
    to_date: date | None,
    creator: str | None,
    channel: str | None,
    state: str | None,
) -> None:
    if from_date and to_date and from_date > to_date:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "from must not be after to")
    if from_date and to_date and (to_date - from_date).days > 366:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "Report date range cannot exceed 367 days"
        )
    if creator and len(creator) > 20:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Invalid creator filter")
    if channel and channel not in ALLOWED_CHANNELS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unsupported channel filter")
    if state and state not in ALLOWED_STATES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unsupported state filter")


def _as_of(value: datetime | None) -> datetime:
    if value is None:
        return datetime.now(UTC)
    if value.tzinfo is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "as_of must include a timezone")
    return value.astimezone(UTC)


@router.get("/overview")
async def overview(
    principal: Viewer,
    settings: Config,
    from_date: Annotated[date | None, Query(alias="from")] = None,
    to_date: Annotated[date | None, Query(alias="to")] = None,
    creator: Annotated[str | None, Query(pattern=r"^CR-[0-9]{3}$")] = None,
    channel: Annotated[str | None, Query()] = None,
    state: Annotated[str | None, Query()] = None,
    as_of: Annotated[datetime | None, Query()] = None,
    stalled_limit: Annotated[int, Query(ge=1, le=100)] = 25,
    stalled_offset: Annotated[int, Query(ge=0, le=10000)] = 0,
) -> dict[str, Any]:
    _validate_filters(from_date, to_date, creator, channel, state)
    instant = _as_of(as_of)
    try:
        facts = await IngestionStore(settings).rpc(
            "operational_reporting_facts", {"p_actor_id": str(principal.id)}
        )
        return build_operational_report(
            facts,
            start_date=from_date,
            end_date=to_date,
            creator=creator,
            channel=channel,
            state=state,
            as_of=instant,
            stalled_limit=stalled_limit,
            stalled_offset=stalled_offset,
        )
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == status.HTTP_403_FORBIDDEN:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Role is not authorized for reports"
            ) from exc
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Reporting facts unavailable"
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Reporting facts unavailable"
        ) from exc
    except (KeyError, TypeError, ValueError, ZoneInfoNotFoundError) as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Reporting facts are incomplete"
        ) from exc


@router.get("/enrollments/{canonical_id}")
async def enrollment_evidence(
    canonical_id: UUID,
    principal: Viewer,
    settings: Config,
) -> dict[str, Any]:
    try:
        evidence = await IngestionStore(settings).rpc(
            "operational_reporting_enrollment_evidence",
            {"p_actor_id": str(principal.id), "p_canonical_id": str(canonical_id)},
        )
        reconciliation = evidence.get("reconciliation")
        if isinstance(reconciliation, dict):
            internal = reconciliation.get("evidence")
            safe = {}
            if isinstance(internal, dict):
                for key in ("normalization_version", "source_row_numbers", "candidate_count"):
                    if key in internal:
                        safe[key] = internal[key]
            reconciliation["evidence"] = safe
        return evidence
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == status.HTTP_404_NOT_FOUND:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Enrollment evidence not found") from exc
        if exc.response.status_code == status.HTTP_403_FORBIDDEN:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Role is not authorized for reports"
            ) from exc
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Enrollment evidence unavailable"
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Enrollment evidence unavailable"
        ) from exc
