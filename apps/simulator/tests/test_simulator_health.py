import pytest
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
