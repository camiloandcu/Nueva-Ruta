from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Annotated, Any, Literal, cast
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from nueva_ruta_api.auth import Principal, Role, get_settings, require_roles
from nueva_ruta_api.compliance import review_content
from nueva_ruta_api.config import Settings
from nueva_ruta_api.crm_store import CrmStore
from nueva_ruta_api.partner_delivery import dispatch_due_transfers

router = APIRouter(prefix="/v1/crm", tags=["crm"])
Operator = Annotated[Principal, Depends(require_roles(Role.OPERATOR, Role.SUPERVISOR))]
Config = Annotated[Settings, Depends(get_settings)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class QualificationRequest(StrictModel):
    reason: str = Field(min_length=1, max_length=300)
    correlation_id: str = Field(min_length=1, max_length=100)


class Disposition(StrEnum):
    NO_ANSWER = "No Answer"
    INFO_SENT = "Info Sent"
    TRANSFERRED = "Transferido"
    CALL_BACK = "Call Back"
    NOT_INTERESTED = "No le interesa"


class DispositionRequest(StrictModel):
    disposition: str = Field(min_length=1, max_length=40)
    idempotency_key: str = Field(min_length=8, max_length=120)
    reason: str = Field(min_length=1, max_length=300)
    correlation_id: str = Field(min_length=1, max_length=100)
    callback_at: datetime | None = None
    timezone: str | None = Field(default=None, max_length=80)
    delivery_event_id: UUID | None = None
    external_action_reference: str | None = Field(default=None, max_length=200)
    explicit_opt_out: bool = False

    @field_validator("callback_at")
    @classmethod
    def callback_must_have_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and (value.tzinfo is None or value.utcoffset() is None):
            raise ValueError("callback_at must include a timezone offset")
        return value

    @field_validator("timezone")
    @classmethod
    def timezone_must_be_iana(cls, value: str | None) -> str | None:
        if value:
            try:
                ZoneInfo(value)
            except ZoneInfoNotFoundError as exc:
                raise ValueError("timezone must be a valid IANA timezone") from exc
        return value

    @model_validator(mode="after")
    def action_evidence(self) -> DispositionRequest:
        if self.disposition == Disposition.CALL_BACK.value and (
            self.callback_at is None or self.timezone is None
        ):
            raise ValueError("Call Back requires a timezone-aware future timestamp and timezone")
        if self.disposition == Disposition.INFO_SENT.value and not (
            self.delivery_event_id or self.external_action_reference
        ):
            raise ValueError(
                "Info Sent requires simulated delivery or an external action reference"
            )
        if self.delivery_event_id and self.external_action_reference:
            raise ValueError("Select one delivery evidence route")
        return self


class SimulatedDeliveryRequest(StrictModel):
    draft_kind: Literal["intake", "follow_up"]
    draft_id: UUID
    idempotency_key: str = Field(min_length=8, max_length=120)
    correlation_id: str = Field(min_length=1, max_length=100)


class TransferApprovalRequest(StrictModel):
    crm_lead_id: UUID
    idempotency_key: str = Field(min_length=8, max_length=120)
    reason: str = Field(min_length=1, max_length=300)
    correlation_id: str = Field(min_length=1, max_length=100)


class DraftApprovalRequest(StrictModel):
    content: str = Field(min_length=1, max_length=1200)
    reason: str = Field(min_length=1, max_length=300)
    correlation_id: str = Field(min_length=1, max_length=100)


class EscalationAction(StrEnum):
    ASSIGN = "assign"
    CLAIM = "claim"
    RESOLVE = "resolve"
    CLOSE = "close"


class EscalationActionRequest(StrictModel):
    action: EscalationAction
    correlation_id: str = Field(min_length=1, max_length=100)
    owner_id: UUID | None = None
    resolution_action: str | None = Field(default=None, max_length=80)
    reason: str | None = Field(default=None, max_length=300)

    @model_validator(mode="after")
    def required_action_fields(self) -> EscalationActionRequest:
        if self.action is EscalationAction.ASSIGN and self.owner_id is None:
            raise ValueError("assign requires owner_id")
        if self.action in {EscalationAction.RESOLVE, EscalationAction.CLOSE} and not self.reason:
            raise ValueError("resolution and closure require reason")
        return self


class DispatchRequest(StrictModel):
    mode: Literal["success", "retryable_failure", "permanent_failure"] = "success"


def api_error(exc: httpx.HTTPStatusError) -> HTTPException:
    code = ""
    message = ""
    try:
        payload = exc.response.json()
        code = str(payload.get("code", ""))
        message = str(payload.get("message", ""))
    except (ValueError, AttributeError):
        pass
    if code == "42501":
        return HTTPException(status.HTTP_403_FORBIDDEN, "CRM action is not authorized")
    if code == "P0002":
        return HTTPException(status.HTTP_404_NOT_FOUND, "CRM record was not found")
    if exc.response.status_code == 409:
        return HTTPException(status.HTTP_409_CONFLICT, "CRM command conflicts with current state")
    if code == "23505":
        return HTTPException(
            status.HTTP_409_CONFLICT, "CRM record already has a conflicting command or transfer"
        )
    if exc.response.status_code in {400, 422} or code in {"22023", "23514", "22P02"}:
        known_errors = {
            "qualify lead before recording delivery": (
                "Califica el caso antes de registrar la entrega."
            ),
            "granted consent required for simulated delivery": (
                "Se requiere consentimiento vigente para registrar la entrega."
            ),
            "opted-out lead cannot receive a message": "Este caso tiene el contacto revocado.",
            "approved draft does not belong to this lead": (
                "El borrador aprobado no pertenece a este caso."
            ),
            "simulated delivery does not belong to this lead": (
                "La entrega seleccionada no pertenece a este caso."
            ),
            "approval alone is not delivery evidence": (
                "La aprobación del borrador no demuestra el envío."
            ),
            "disposition is not valid from current stage": (
                "Esta disposición no es válida para la etapa actual."
            ),
        }
        return HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            known_errors.get(message, "CRM command failed validation"),
        )
    return HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "CRM store unavailable")


@router.get("/leads")
async def crm_leads(
    _: Operator,
    settings: Config,
    stage: Annotated[str | None, Query(max_length=40)] = None,
) -> list[dict[str, Any]]:
    filters = {"commercial_stage": f"eq.{stage}"} if stage else None
    return await CrmStore(settings).rows(
        "operational_crm_leads", order="updated_at.desc", filters=filters
    )


@router.get("/dispositions")
async def dispositions(_: Operator, settings: Config) -> list[dict[str, Any]]:
    return await CrmStore(settings).rows("crm_disposition_events", order="occurred_at.desc")


@router.get("/leads/{crm_lead_id}/message-evidence")
async def message_evidence(
    crm_lead_id: UUID, _: Operator, settings: Config
) -> list[dict[str, Any]]:
    try:
        return await CrmStore(settings).rows(
            "operational_crm_message_evidence",
            order="approved_at.desc",
            filters={"crm_lead_id": f"eq.{crm_lead_id}"},
        )
    except httpx.HTTPStatusError as exc:
        raise api_error(exc) from exc


@router.post("/leads/{crm_lead_id}/message-deliveries")
async def record_message_delivery(
    crm_lead_id: UUID, body: SimulatedDeliveryRequest, actor: Operator, settings: Config
) -> Any:
    try:
        return await CrmStore(settings).rpc(
            "record_simulated_message_delivery",
            {
                "p_payload": {
                    **body.model_dump(mode="json"),
                    "actor_id": str(actor.id),
                    "crm_lead_id": str(crm_lead_id),
                }
            },
        )
    except httpx.HTTPStatusError as exc:
        try:
            if exc.response.json().get("code") == "23505":
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    "Este borrador ya tiene una entrega simulada registrada.",
                ) from exc
        except (ValueError, AttributeError):
            pass
        raise api_error(exc) from exc


@router.post("/leads/{crm_lead_id}/qualify")
async def qualify_lead(
    crm_lead_id: UUID, body: QualificationRequest, actor: Operator, settings: Config
) -> Any:
    try:
        return await CrmStore(settings).rpc(
            "qualify_crm_lead",
            {
                "p_payload": {
                    **body.model_dump(),
                    "actor_id": str(actor.id),
                    "crm_lead_id": str(crm_lead_id),
                }
            },
        )
    except httpx.HTTPStatusError as exc:
        raise api_error(exc) from exc


@router.post("/leads/{crm_lead_id}/dispositions")
async def apply_disposition(
    crm_lead_id: UUID, body: DispositionRequest, actor: Operator, settings: Config
) -> Any:
    try:
        return await CrmStore(settings).rpc(
            "apply_crm_disposition",
            {
                "p_payload": {
                    **body.model_dump(mode="json"),
                    "actor_id": str(actor.id),
                    "crm_lead_id": str(crm_lead_id),
                }
            },
        )
    except httpx.HTTPStatusError as exc:
        try:
            error_code = str(exc.response.json().get("code", ""))
        except (ValueError, AttributeError):
            error_code = ""
        if error_code in {"22P02", "22023"}:
            try:
                await CrmStore(settings).rpc(
                    "record_crm_command_failure",
                    {
                        "p_payload": {
                            "actor_id": str(actor.id),
                            "crm_lead_id": str(crm_lead_id),
                            "attempted_disposition": "unsupported_value",
                            "error_code": error_code,
                            "correlation_id": body.correlation_id,
                        }
                    },
                )
            except httpx.HTTPError:
                pass
        raise api_error(exc) from exc


@router.post("/transfers/approve")
async def approve_transfer(body: TransferApprovalRequest, actor: Operator, settings: Config) -> Any:
    try:
        return await CrmStore(settings).rpc(
            "approve_partner_transfer",
            {"p_payload": {**body.model_dump(mode="json"), "actor_id": str(actor.id)}},
        )
    except httpx.HTTPStatusError as exc:
        raise api_error(exc) from exc


@router.get("/escalations")
async def escalations(_: Operator, settings: Config) -> list[dict[str, Any]]:
    return await CrmStore(settings).rows("operational_escalations", order="due_at.asc")


@router.get("/access")
async def crm_access(actor: Operator) -> dict[str, str]:
    return {"id": str(actor.id), "role": actor.role.value}


@router.get("/team")
async def operator_team(_: Operator, settings: Config) -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
        response = await client.get(
            f"{settings.rest_url}/app_users",
            params={
                "select": "id,display_name,role",
                "active": "eq.true",
                "role": "in.(operator,supervisor)",
            },
            headers=CrmStore(settings).headers,
        )
    response.raise_for_status()
    return cast(list[dict[str, Any]], response.json())


@router.post("/escalations/{escalation_id}/actions")
async def escalation_action(
    escalation_id: UUID, body: EscalationActionRequest, actor: Operator, settings: Config
) -> Any:
    try:
        return await CrmStore(settings).rpc(
            "apply_escalation_action",
            {
                "p_payload": {
                    **body.model_dump(mode="json"),
                    "actor_id": str(actor.id),
                    "escalation_id": str(escalation_id),
                }
            },
        )
    except httpx.HTTPStatusError as exc:
        raise api_error(exc) from exc


@router.get("/deliveries")
async def deliveries(_: Operator, settings: Config) -> list[dict[str, Any]]:
    return await CrmStore(settings).rows("operational_partner_deliveries", order="created_at.desc")


@router.get("/delivery-attempts")
async def delivery_attempts(_: Operator, settings: Config) -> list[dict[str, Any]]:
    return await CrmStore(settings).rows(
        "operational_partner_delivery_attempts", order="completed_at.desc"
    )


@router.get("/recovery")
async def recovery_items(_: Operator, settings: Config) -> list[dict[str, Any]]:
    return await CrmStore(settings).rows(
        "operational_crm_recovery", order="created_at.desc", filters={"status": "eq.open"}
    )


@router.get("/follow-up-drafts")
async def follow_up_drafts(_: Operator, settings: Config) -> list[dict[str, Any]]:
    return await CrmStore(settings).rows(
        "operational_crm_follow_up_drafts", order="created_at.desc"
    )


@router.post("/follow-up-drafts/{draft_id}/approve")
async def approve_follow_up_draft(
    draft_id: UUID, body: DraftApprovalRequest, actor: Operator, settings: Config
) -> Any:
    review = review_content(body.content)
    if not review.valid:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            {
                "message": "Draft failed deterministic compliance review",
                "violation_codes": list(review.codes),
            },
        )
    try:
        return await CrmStore(settings).rpc(
            "approve_crm_follow_up_draft",
            {
                "p_payload": {
                    **body.model_dump(),
                    "actor_id": str(actor.id),
                    "draft_id": str(draft_id),
                    "content_checksum": review.checksum,
                }
            },
        )
    except httpx.HTTPStatusError as exc:
        raise api_error(exc) from exc


@router.post("/deliveries/process")
async def process_deliveries(
    body: DispatchRequest, request: Request, _: Operator, settings: Config
) -> dict[str, Any]:
    return await dispatch_due_transfers(
        settings,
        body.mode,
        correlation_id=request.state.correlation_id,
    )


@router.post("/deliveries/{event_id}/replay")
async def replay_delivery(
    event_id: UUID, body: QualificationRequest, actor: Operator, settings: Config
) -> Any:
    try:
        return await CrmStore(settings).rpc(
            "replay_partner_outbox",
            {
                "p_payload": {
                    **body.model_dump(),
                    "actor_id": str(actor.id),
                    "event_id": str(event_id),
                }
            },
        )
    except httpx.HTTPStatusError as exc:
        raise api_error(exc) from exc
