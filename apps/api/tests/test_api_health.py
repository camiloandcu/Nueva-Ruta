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


@pytest.mark.asyncio
async def test_readiness_checks_supabase_with_publishable_api_key(
    monkeypatch: MonkeyPatch,
) -> None:
    class HealthyResponse:
        status_code = 200

        @property
        def is_success(self) -> bool:
            return True

    class HealthyClient:
        def __init__(self, **_: object) -> None:
            pass

        async def __aenter__(self) -> "HealthyClient":
            return self

        async def __aexit__(self, *_: object) -> None:
            pass

        async def get(self, url: str, *, headers: dict[str, str]) -> HealthyResponse:
            assert url == "https://supabase.invalid/auth/v1/health"
            assert headers == {"apikey": "publishable-test"}
            return HealthyResponse()

    monkeypatch.setenv("SUPABASE_URL", "https://supabase.invalid")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "publishable-test")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "service-test")
    monkeypatch.setattr(main.httpx, "AsyncClient", HealthyClient)

    response = Response()
    payload = await main.readiness(response)

    assert response.status_code == 200
    assert payload["dependencies"]["supabase_auth"] == "ready"


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
    assert f'"correlation_id":"{response.headers["X-Correlation-ID"]}"' in caplog.text
    assert "bad\\nvalue" not in caplog.text
