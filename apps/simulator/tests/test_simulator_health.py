import pytest
from fastapi.testclient import TestClient
from nueva_ruta_simulator import main
from nueva_ruta_simulator.main import app


@pytest.mark.asyncio
async def test_simulator_is_ready_without_business_routes() -> None:
    assert await main.liveness() == {"service": "simulator", "status": "alive"}
    assert await main.readiness() == {"service": "simulator", "status": "ready"}

    registered_paths = {route.path for route in app.routes}
    assert "/leads" not in registered_paths


@pytest.mark.asyncio
async def test_simulator_builds_synthetic_event_without_delivery() -> None:
    result = await main.simulated_event(
        main.SimulationRequest(
            source_event_id="fixture-1",
            channel="ctwa",
            message="Mensaje ficticio",
            provider_mode="timeout",
        )
    )
    assert result["event"]["synthetic"] is True  # type: ignore[index]
    assert result["provider_mode"] == "timeout"
    assert result["delivery"] == "not_attempted"


def test_request_log_is_correlated_and_omits_query(caplog) -> None:
    caplog.set_level("INFO", logger="nueva_ruta.simulator.request")
    with TestClient(app) as client:
        response = client.get(
            "/health/ready?access_token=private",
            headers={"X-Correlation-ID": "demo-check-001"},
        )

    assert response.status_code == 200
    assert response.headers["X-Correlation-ID"] == "demo-check-001"
    assert '"correlation_id":"demo-check-001"' in caplog.text
    assert '"route":"/health/ready"' in caplog.text
    assert "private" not in caplog.text
