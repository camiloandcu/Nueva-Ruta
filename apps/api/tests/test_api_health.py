import pytest
from fastapi import Response
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
