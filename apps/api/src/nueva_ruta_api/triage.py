import re
from dataclasses import dataclass
from datetime import datetime
from typing import Literal
from uuid import NAMESPACE_URL, uuid5

from nueva_ruta_api.ingestion_models import ApprovedFields, InboundEvent
from nueva_ruta_api.redaction import RedactionResult


@dataclass(frozen=True)
class TriageOutcome:
    decision: str
    reason_code: str
    explanation: str
    fields: ApprovedFields
    draft: str | None
    escalation_priority: str | None
    automatic_purpose: str | None


OPT_OUT = re.compile(r"\b(no (?:me )?(?:escriban|contacten)|stop|baja|cancelar mensajes)\b", re.I)
SPAM = re.compile(r"\b(?:crypto giveaway|casino|seo backlinks)\b", re.I)
RISK = re.compile(r"\b(?:abogado|demanda|demandar|suicid|amenaza|embargo|legal)\w*\b", re.I)
HANDOFF = re.compile(r"\b(?:persona|supervisor|hablar con alguien)\b", re.I)
AMOUNT = re.compile(r"(?:\$\s*)?(\d{1,3}(?:[,.]\d{3})+|\d{4,6})")
STATE = re.compile(r"\b(CA|FL|TX|NY|NJ|AZ)\b", re.I)


def stable_id(kind: str, event: InboundEvent, suffix: str = "") -> str:
    return str(
        uuid5(NAMESPACE_URL, f"nueva-ruta:{kind}:{event.channel}:{event.source_event_id}:{suffix}")
    )


def extract_fields(text: str) -> ApprovedFields:
    lowered = text.casefold()
    amount_match = AMOUNT.search(text)
    amount = int(amount_match.group(1).replace(",", "").replace(".", "")) if amount_match else None
    state_match = STATE.search(text)
    debt_type: Literal["credit_card", "medical", "personal_loan"] | None = None
    if "tarjeta" in lowered or "credit card" in lowered:
        debt_type = "credit_card"
    elif "médic" in lowered or "medic" in lowered:
        debt_type = "medical"
    elif "préstamo" in lowered or "personal loan" in lowered:
        debt_type = "personal_loan"
    return ApprovedFields(
        approximate_debt=amount,
        debt_type=debt_type,
        state=state_match.group(1).upper() if state_match else None,
        preferred_language="en" if re.search(r"\b(?:hello|debt|help)\b", lowered) else "es",
        wants_counselor=True if re.search(r"\bconsejero\b", lowered) else None,
    )


def classify(
    event: InboundEvent, redaction: RedactionResult, now: datetime | None = None
) -> TriageOutcome:
    del now
    text = redaction.text
    fields = extract_fields(text)
    if redaction.types:
        return TriageOutcome(
            "escalate_human",
            "sensitive_data",
            "Sensitive span detected.",
            fields,
            None,
            "high",
            None,
        )
    if OPT_OUT.search(text) or event.consent.status == "withdrawn":
        return TriageOutcome(
            "ignore",
            "explicit_opt_out",
            "Consent withdrawn.",
            fields,
            None,
            None,
            "opt_out_confirmation",
        )
    if SPAM.search(text):
        return TriageOutcome(
            "ignore", "obvious_spam", "Known spam pattern.", fields, None, None, None
        )
    if RISK.search(text):
        return TriageOutcome(
            "escalate_human",
            "legal_or_risk",
            "Risk language requires review.",
            fields,
            None,
            "urgent",
            None,
        )
    if HANDOFF.search(text):
        return TriageOutcome(
            "escalate_human", "requested_handoff", "Person requested.", fields, None, "normal", None
        )
    if fields.state and fields.state not in {"CA", "FL", "TX"}:
        return TriageOutcome(
            "escalate_human",
            "unsupported_state",
            "State is outside active coverage.",
            fields,
            None,
            "normal",
            None,
        )
    if fields.approximate_debt and not 5_000 <= fields.approximate_debt <= 100_000:
        return TriageOutcome(
            "escalate_human",
            "unsupported_debt",
            "Debt amount is outside policy.",
            fields,
            None,
            "normal",
            None,
        )
    missing = [
        name for name in ("approximate_debt", "debt_type", "state") if getattr(fields, name) is None
    ]
    draft = (
        "Gracias por escribir. Para orientarte, ¿podrías compartir un monto aproximado, "
        "el tipo general de deuda y tu estado? No envíes números de cuenta ni credenciales."
        if missing
        else "Gracias por la información. Un consejero podría orientarte según tu situación."
    )
    purpose = "after_hours" if not event.consent.conversation_window_open else "receipt_privacy"
    return TriageOutcome(
        "respond",
        "safe_inquiry",
        "Request is eligible for human-draft review.",
        fields,
        draft,
        None,
        purpose,
    )
