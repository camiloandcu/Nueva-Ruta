from datetime import UTC, datetime
from enum import StrEnum
from hashlib import sha256
from typing import Literal

from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field

app = FastAPI(title="Nueva Ruta Simulator", version="0.1.0")


@app.get("/health/live")
async def liveness() -> dict[str, str]:
    return {"service": "simulator", "status": "alive"}


@app.get("/health/ready")
async def readiness() -> dict[str, str]:
    return {"service": "simulator", "status": "ready"}


class ProviderMode(StrEnum):
    SUCCESS = "success"
    MISSING_KEY = "missing_key"
    CONNECTION = "connection_error"
    TIMEOUT = "timeout"
    AUTHENTICATION = "authentication"
    RATE_LIMIT = "rate_limit"
    PROVIDER_5XX = "provider_5xx"
    INVALID_JSON = "invalid_json"
    INVALID_SCHEMA = "invalid_schema"
    LOW_CONFIDENCE = "low_confidence"
    PROHIBITED_LANGUAGE = "prohibited_language"


class SimulationRequest(BaseModel):
    source_event_id: str = Field(pattern=r"^[a-zA-Z0-9._:-]+$")
    channel: str = Field(pattern=r"^(ctwa|organic)$")
    message: str = Field(min_length=1, max_length=4000)
    provider_mode: ProviderMode = ProviderMode.SUCCESS


class PartnerTransferMode(StrEnum):
    SUCCESS = "success"
    RETRYABLE_FAILURE = "retryable_failure"
    PERMANENT_FAILURE = "permanent_failure"


class PartnerTransferRequest(BaseModel):
    transfer_id: str = Field(pattern=r"^[0-9a-f-]{36}$")
    idempotency_key: str = Field(min_length=8, max_length=120)
    crm_lead_id: str = Field(pattern=r"^[0-9a-f-]{36}$")
    source_event_id: str | None = None
    fictional_phone: str | None = Field(default=None, pattern=r"^\+155501[0-9]{2}$")
    synthetic: Literal[True] = True
    mode: PartnerTransferMode = PartnerTransferMode.SUCCESS


@app.post("/v1/partner/transfers")
async def partner_transfer(request: PartnerTransferRequest) -> dict[str, str]:
    if request.mode is PartnerTransferMode.RETRYABLE_FAILURE:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "Synthetic retryable partner failure"
        )
    if request.mode is PartnerTransferMode.PERMANENT_FAILURE:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "Synthetic permanent partner rejection"
        )
    suffix = sha256(request.idempotency_key.encode()).hexdigest()[:12].upper()
    return {"partner_request_id": f"CC-{suffix}", "status": "accepted", "synthetic": "true"}


@app.post("/v1/events")
async def simulated_event(request: SimulationRequest) -> dict[str, object]:
    return {
        "event": {
            "source_event_id": request.source_event_id,
            "inbound_at": datetime.now(UTC).isoformat(),
            "channel": request.channel,
            "source_detail": "local simulator; fictional data only",
            "creator_business_id": "CR-001" if request.channel == "ctwa" else None,
            "message": request.message,
            "fictional_phone": "+15550100",
            "consent": {
                "status": "granted",
                "source": "simulator",
                "conversation_window_open": True,
            },
            "synthetic": True,
            "correlation_id": f"sim-{request.source_event_id}",
        },
        "provider_mode": request.provider_mode,
        "delivery": "not_attempted",
    }
