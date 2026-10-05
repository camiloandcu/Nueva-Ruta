import pytest
from fastapi import Response
from fastapi.testclient import TestClient
from nueva_ruta_api import main
from pytest import MonkeyPatch


@pytest.mark.asyncio
async def test_liveness_does_not_depend_on_supabase() -> None:
    payload = await main.liveness()

    assert payload == {"service": "api", "status": "alive"}


@pytest.mark.asyncio
async def test_readiness_identifies_missing_configuration(monkeypatch: MonkeyPatch) -> None:
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    response = Response()
    payload = await main.readiness(response)

    assert response.status_code == 503
    assert payload["dependencies"]["supabase_auth"] == "missing_configuration"


def test_request_log_has_correlation_and_no_query_or_payload(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level("INFO", logger="nueva_ruta.request")
    with TestClient(main.app) as client:
        response = client.get(
            "/health/live?token=do-not-log",
            headers={"X-Correlation-ID": "release-check-001"},
        )

    assert response.headers["X-Correlation-ID"] == "release-check-001"
    assert '"correlation_id":"release-check-001"' in caplog.text
    assert '"route":"/health/live"' in caplog.text
    assert "do-not-log" not in caplog.text
    assert "authorization" not in caplog.text.lower()


def test_invalid_correlation_header_is_replaced(caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level("INFO", logger="nueva_ruta.request")
    with TestClient(main.app) as client:
        response = client.get("/health/live", headers={"X-Correlation-ID": "bad\nvalue"})

    assert response.status_code == 200
    assert response.headers["X-Correlation-ID"] != "bad\nvalue"
    assert "bad" not in caplog.text
