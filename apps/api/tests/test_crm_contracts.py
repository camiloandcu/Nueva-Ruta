from datetime import UTC, datetime, timedelta

import pytest
from nueva_ruta_api.crm_api import Disposition, DispositionRequest
from pydantic import ValidationError


def test_only_the_five_documented_dispositions_are_accepted() -> None:
    common = {
        "idempotency_key": "command-key-0001",
        "reason": "Reviewed",
        "correlation_id": "crm-test",
    }
    for disposition in Disposition:
        evidence = (
            {"external_action_reference": "manual-log-01"}
            if disposition is Disposition.INFO_SENT
            else {}
        )
        if disposition is Disposition.CALL_BACK:
            evidence = {
                "callback_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
                "timezone": "America/Bogota",
            }
        assert (
            DispositionRequest(disposition=disposition.value, **common, **evidence).disposition
            == disposition.value
        )
    assert {item.value for item in Disposition} == {
        "No Answer",
        "Info Sent",
        "Transferido",
        "Call Back",
        "No le interesa",
    }


def test_callback_requires_timezone_aware_future_timestamp_and_timezone() -> None:
    with pytest.raises(ValidationError, match="Call Back requires"):
        DispositionRequest(
            disposition=Disposition.CALL_BACK.value,
            idempotency_key="command-key-0001",
            reason="Call",
            correlation_id="crm-test",
        )
    with pytest.raises(ValidationError, match="timezone offset"):
        DispositionRequest(
            disposition=Disposition.CALL_BACK.value,
            idempotency_key="command-key-0001",
            reason="Call",
            correlation_id="crm-test",
            callback_at=datetime(2027, 1, 1),
            timezone="America/Bogota",
        )


def test_info_sent_requires_delivery_or_manual_action_reference() -> None:
    with pytest.raises(ValidationError, match="Info Sent requires"):
        DispositionRequest(
            disposition=Disposition.INFO_SENT.value,
            idempotency_key="command-key-0001",
            reason="Sent",
            correlation_id="crm-test",
        )
    with pytest.raises(ValidationError, match="Extra inputs are not permitted"):
        DispositionRequest(
            disposition=Disposition.INFO_SENT.value,
            idempotency_key="command-key-0002",
            reason="Approved only",
            correlation_id="crm-test",
            draft_id="00000000-0000-0000-0000-000000000001",  # type: ignore[call-arg]
        )
