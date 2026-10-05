import json
import logging
import re
import time
from typing import Annotated, Any
from uuid import uuid4

import httpx
from fastapi import Depends, FastAPI, HTTPException, Response, status
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request

from nueva_ruta_api.auth import Principal, Role, get_settings, require_roles
from nueva_ruta_api.config import Settings
from nueva_ruta_api.creator_content_api import router as creator_content_router
from nueva_ruta_api.crm_api import router as crm_router
from nueva_ruta_api.domain import DomainStore
from nueva_ruta_api.ingestion_api import router as ingestion_router
from nueva_ruta_api.partner_api import router as partner_router
from nueva_ruta_api.reporting_api import router as reporting_router
from nueva_ruta_api.rules_api import router as rules_router
from nueva_ruta_api.schemas import (
    AnalystLead,
    MessageDetail,
    OperationalLead,
    ResetRequest,
    ResetResult,
)

app = FastAPI(title="Nueva Ruta API", version="0.1.0")

logger = logging.getLogger("nueva_ruta.request")
CORRELATION_ID = re.compile(r"^[A-Za-z0-9._:-]{1,100}$")


class RequestObservabilityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        supplied = request.headers.get("x-correlation-id", "")
        correlation_id = supplied if CORRELATION_ID.fullmatch(supplied) else str(uuid4())
        request.state.correlation_id = correlation_id
        started = time.perf_counter()
        status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        try:
            response = await call_next(request)
            status_code = response.status_code
            response.headers["X-Correlation-ID"] = correlation_id
            return response
        finally:
            logger.info(
                json.dumps(
                    {
                        "event": "http_request",
                        "correlation_id": correlation_id,
                        "method": request.method,
                        "route": getattr(request.scope.get("route"), "path", "unmatched"),
                        "status_code": status_code,
                        "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                    },
                    separators=(",", ":"),
                    sort_keys=True,
                )
            )


app.add_middleware(RequestObservabilityMiddleware)
app.include_router(rules_router)
app.include_router(ingestion_router)
app.include_router(partner_router)
app.include_router(reporting_router)
app.include_router(creator_content_router)
app.include_router(crm_router)


async def check_supabase_auth(settings: Settings) -> tuple[bool, str]:
    try:
        async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
            response = await client.get(settings.auth_health_url)
        if response.is_success:
            return True, "ready"
        return False, f"unexpected_status_{response.status_code}"
    except httpx.TimeoutException:
        return False, "timeout"
    except httpx.HTTPError:
        return False, "connection_error"


@app.get("/health/live")
async def liveness() -> dict[str, str]:
    return {"service": "api", "status": "alive"}


@app.get("/health/ready")
async def readiness(response: Response) -> dict[str, Any]:
    try:
        settings = Settings.from_environment()
    except RuntimeError:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "service": "api",
            "status": "not_ready",
            "dependencies": {"supabase_auth": "missing_configuration"},
        }

    ready, reason = await check_supabase_auth(settings)
    if not ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {
        "service": "api",
        "status": "ready" if ready else "not_ready",
        "dependencies": {"supabase_auth": reason},
    }


@app.get("/v1/operational/leads", response_model=list[OperationalLead])
async def operational_leads(
    _: Annotated[Principal, Depends(require_roles(Role.OPERATOR, Role.SUPERVISOR))],
    settings: Annotated[Settings, Depends(get_settings)],
) -> list[dict[str, Any]]:
    try:
        return await DomainStore(settings).select(
            "leads",
            "id,business_id,creator_id,content_source_id,channel,source_detail,received_at,initial_status,case_tags,fictional_phone,synthetic,messages(id,direction,body,sent_at,synthetic)",
        )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Domain store unavailable"
        ) from exc


@app.get("/v1/analysis/leads", response_model=list[AnalystLead])
async def analyst_leads(
    _: Annotated[Principal, Depends(require_roles(Role.ANALYST, Role.SUPERVISOR))],
    settings: Annotated[Settings, Depends(get_settings)],
) -> list[dict[str, Any]]:
    try:
        return await DomainStore(settings).select(
            "leads",
            "id,business_id,creator_id,content_source_id,channel,received_at,initial_status,case_tags,synthetic",
        )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Domain store unavailable"
        ) from exc


@app.get("/v1/messages/{message_id}", response_model=MessageDetail)
async def message_detail(
    message_id: str,
    _: Annotated[Principal, Depends(require_roles(Role.OPERATOR, Role.SUPERVISOR))],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, Any]:
    try:
        message = await DomainStore(settings).message(message_id)
    except httpx.HTTPError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Domain store unavailable"
        ) from exc
    if message is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found")
    return message


@app.post(
    "/v1/admin/synthetic-baseline/reset",
    response_model=ResetResult,
    response_model_exclude_defaults=True,
)
async def reset_synthetic_baseline(
    request: ResetRequest,
    principal: Annotated[Principal, Depends(require_roles(Role.SUPERVISOR))],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, int]:
    if request.confirmation != "RESET SYNTHETIC BASELINE":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Exact reset confirmation required")
    try:
        return await DomainStore(settings).reset(
            {
                "p_actor_id": str(principal.id),
                "p_confirmation": request.confirmation,
                "p_reason": request.reason,
                "p_correlation_id": request.correlation_id,
            }
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Synthetic reset failed") from exc
