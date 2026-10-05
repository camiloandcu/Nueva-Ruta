from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from nueva_ruta_api import auth, main
from nueva_ruta_api.auth import Principal, Role
from nueva_ruta_api.config import Settings
from nueva_ruta_api.ingestion_store import IngestionStore

SETTINGS = Settings("http://supabase.invalid", "anon", "service")
USER = UUID("00000000-0000-0000-0000-000000000001")


@asynccontextmanager
async def client_for(role: Role) -> AsyncIterator[TestClient]:
    async def principal() -> Principal:
        return Principal(USER, "synthetic@localhost.invalid", role)
    main.app.dependency_overrides[auth.current_principal] = principal
    main.app.state.settings = SETTINGS
    try:
        with TestClient(main.app) as client:
            yield client
    finally:
        main.app.dependency_overrides.clear()
        del main.app.state.settings


def inbound(message: str = "Tengo deuda de tarjeta en TX") -> dict[str, object]:
    return {
        "source_event_id": "api-1", "inbound_at": datetime(2026, 9, 15, 17, tzinfo=UTC).isoformat(),
        "channel": "ctwa", "source_detail": "n8n synthetic", "creator_business_id": "CR-001",
        "message": message, "fictional_phone": "+15550100",
        "consent": {"status": "granted", "source": "synthetic", "conversation_window_open": True},
        "synthetic": True, "correlation_id": "corr-api-1",
    }


@pytest.mark.asyncio
async def test_ingestion_response_never_exposes_original(monkeypatch: pytest.MonkeyPatch) -> None:
    async def rpc(self: IngestionStore, name: str, payload: dict[str, object]) -> dict[str, object]:
        del self
        assert name == "ingest_source_event"
        return payload["p_payload"]["result"]  # type: ignore[index,return-value]
    monkeypatch.setattr(IngestionStore, "rpc", rpc)
    async with client_for(Role.OPERATOR) as client:
        response = client.post("/v1/ingestion/events", json=inbound("SSN 123-45-6789"))
    assert response.status_code == 201
    assert "123-45-6789" not in response.text
    assert response.json()["decision"] == "escalate_human"


@pytest.mark.asyncio
async def test_analyst_cannot_ingest_or_view_operations() -> None:
    async with client_for(Role.ANALYST) as client:
        assert client.post("/v1/ingestion/events", json=inbound()).status_code == 403
        assert client.get("/v1/operations/ai").status_code == 403


@pytest.mark.asyncio
async def test_operator_can_read_review_drafts_without_a_direct_database_client(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def rows(self: IngestionStore, table: str, **kwargs: object) -> list[dict[str, str]]:
        del self
        assert table == "response_drafts"
        assert kwargs == {"order": "created_at.desc"}
        return [{"id": "draft-1", "status": "approved"}]

    monkeypatch.setattr(IngestionStore, "rows", rows)
    async with client_for(Role.OPERATOR) as client:
        response = client.get("/v1/drafts")

    assert response.status_code == 200
    assert response.json() == [{"id": "draft-1", "status": "approved"}]


@pytest.mark.asyncio
async def test_supervisor_can_read_minimized_assistance_trace(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def rows(self: IngestionStore, table: str, **kwargs: object) -> list[dict[str, str]]:
        del self
        assert table == "operational_assistance_attempts"
        assert kwargs == {
            "filters": {"correlation_id": "eq.flow-001"},
            "order": "created_at.desc",
        }
        return [{"correlation_id": "flow-001", "decision": "respond"}]

    monkeypatch.setattr(IngestionStore, "rows", rows)
    async with client_for(Role.SUPERVISOR) as client:
        response = client.get("/v1/operations/ai?correlation_id=flow-001")

    assert response.status_code == 200
    assert response.json() == [{"correlation_id": "flow-001", "decision": "respond"}]
