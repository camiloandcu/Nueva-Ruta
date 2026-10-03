from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class OperationalLead(BaseModel):
    id: UUID
    business_id: str
    creator_id: UUID | None
    content_source_id: UUID | None
    channel: str
    source_detail: str
    received_at: datetime
    initial_status: str
    case_tags: list[str]
    fictional_phone: str
    synthetic: bool
    messages: list[dict[str, object]]


class AnalystLead(BaseModel):
    id: UUID
    business_id: str
    creator_id: UUID | None
    content_source_id: UUID | None
    channel: str
    received_at: datetime
    initial_status: str
    case_tags: list[str]
    synthetic: bool


class MessageDetail(BaseModel):
    id: UUID
    lead_id: UUID
    direction: str
    body: str
    sent_at: datetime
    synthetic: bool


class ResetRequest(BaseModel):
    confirmation: str
    reason: str = Field(min_length=1, max_length=200)
    correlation_id: str = Field(min_length=1, max_length=100)


class ResetResult(BaseModel):
    creators: int
    content_sources: int
    leads: int
    messages: int
    partner_rows: int
    source_events: int = 0
    decisions: int = 0
    drafts: int = 0
    escalations: int = 0
    ai_attempts: int = 0
    crm_leads: int = 0
    crm_recovery_items: int = 0
    partner_transfers: int = 0
    outbox_events: int = 0
    outbox_delivery_attempts: int = 0
