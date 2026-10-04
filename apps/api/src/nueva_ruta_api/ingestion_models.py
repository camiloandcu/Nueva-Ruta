from datetime import datetime
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Channel(StrEnum):
    CTWA = "ctwa"
    ORGANIC = "organic"


class ConsentContext(StrictModel):
    status: Literal["granted", "withdrawn", "unknown"]
    source: str = Field(min_length=1, max_length=100)
    conversation_window_open: bool


class InboundEvent(StrictModel):
    source_event_id: str = Field(min_length=1, max_length=120, pattern=r"^[a-zA-Z0-9._:-]+$")
    inbound_at: datetime
    channel: Channel
    source_detail: str = Field(min_length=1, max_length=200)
    creator_business_id: str | None = Field(default=None, pattern=r"^CR-[0-9]{3}$")
    message: str = Field(min_length=1, max_length=4000)
    fictional_phone: str = Field(pattern=r"^\+155501[0-9]{2}$")
    consent: ConsentContext
    synthetic: Literal[True]
    correlation_id: str = Field(min_length=1, max_length=100)

    @field_validator("creator_business_id")
    @classmethod
    def creator_required_for_ctwa(cls, value: str | None, info: Any) -> str | None:
        channel = info.data.get("channel")
        if channel == Channel.CTWA and value is None:
            raise ValueError("creator_business_id is required for CTWA")
        if channel == Channel.ORGANIC and value is not None:
            raise ValueError("organic events cannot claim creator attribution")
        return value


class ApprovedFields(StrictModel):
    approximate_debt: int | None = Field(default=None, ge=0, le=1_000_000)
    debt_type: Literal["credit_card", "medical", "personal_loan"] | None = None
    state: str | None = Field(default=None, pattern=r"^[A-Z]{2}$")
    preferred_language: Literal["es", "en"] | None = None
    preferred_contact_time: str | None = Field(default=None, max_length=80)
    wants_counselor: bool | None = None


class AssistanceOutput(StrictModel):
    classification: Literal["respond", "ignore", "escalate_human"]
    summary: str = Field(min_length=1, max_length=500)
    fields: ApprovedFields
    confidence: float = Field(ge=0, le=1)
    draft: str | None = Field(default=None, max_length=1200)


class ProcessingResult(StrictModel):
    lead_id: str
    message_id: str
    decision_id: str
    correlation_id: str
    decision: Literal["respond", "ignore", "escalate_human"]
    reason_code: str
    decision_source: Literal["deterministic", "ai_assisted", "deterministic_fallback"]
    ai_attempt_status: Literal[
        "not_attempted", "skipped_configuration", "succeeded", "failed", "rejected"
    ]
    failure_layer: Literal[
        "none", "configuration", "transport", "provider", "output_validation", "compliance"
    ]
    normalized_reason: str
    redacted_message: str
    redaction_types: list[str]
    extracted_fields: ApprovedFields
    draft_id: str | None = None
    escalation_id: str | None = None
    automatic_effect_id: str | None = None
    replayed: bool = False
