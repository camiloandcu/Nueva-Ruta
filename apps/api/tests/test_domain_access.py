from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from uuid import UUID

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.testclient import TestClient
from nueva_ruta_api import auth, main
from nueva_ruta_api.auth import Principal, Role
from nueva_ruta_api.config import Settings
from nueva_ruta_api.domain import DomainStore
from pytest import MonkeyPatch

SETTINGS = Settings("http://supabase.invalid", "anon-test", "service-test")
USER_ID = UUID("00000000-0000-0000-0000-000000000001")


class FakeResponse:
    def __init__(self, status_code: int, payload: object) -> None:
        self.status_code = status_code
        self._payload = payload

    def json(self) -> object:
        return self._payload


class FakeHttpClient:
    responses: list[FakeResponse] = []

    def __init__(self, **_: object) -> None:
        pass

    async def __aenter__(self) -> "FakeHttpClient":
        return self

    async def __aexit__(self, *_: object) -> None:
        pass

    async def get(self, *_: object, **__: object) -> FakeResponse:
        return self.responses.pop(0)


@asynccontextmanager
async def client_for(role: Role) -> AsyncIterator[TestClient]:
    async def principal() -> Principal:
        return Principal(USER_ID, f"{role.value}@localhost.invalid", role)

    main.app.dependency_overrides[auth.current_principal] = principal
    main.app.state.settings = SETTINGS
    try:
        with TestClient(main.app) as client:
            yield client
    finally:
        main.app.dependency_overrides.clear()
        del main.app.state.settings


@pytest.fixture
def lead_rows() -> list[dict[str, object]]:
    return [
        {
            "id": "00000000-0000-0000-0000-000000000010",
            "business_id": "LEAD-001",
            "creator_id": "00000000-0000-0000-0000-000000000020",
            "content_source_id": "00000000-0000-0000-0000-000000000030",
            "channel": "ctwa",
            "source_detail": "synthetic creator fixture",
            "received_at": "2026-09-15T16:00:00Z",
            "initial_status": "received",
            "case_tags": ["safe_complete"],
            "fictional_phone": "+15550100",
            "synthetic": True,
            "messages": [{"body": "restricted synthetic body"}],
        }
    ]


@pytest.mark.asyncio
async def test_verified_identity_resolves_trusted_role(monkeypatch: MonkeyPatch) -> None:
    FakeHttpClient.responses = [
        FakeResponse(200, {"id": str(USER_ID)}),
        FakeResponse(200, [{"email": "operator@localhost.invalid", "role": "operator"}]),
    ]
    monkeypatch.setattr(auth.httpx, "AsyncClient", FakeHttpClient)

    principal = await auth.current_principal(
        HTTPAuthorizationCredentials(scheme="Bearer", credentials="valid"), SETTINGS
    )

    assert principal == Principal(USER_ID, "operator@localhost.invalid", Role.OPERATOR)


@pytest.mark.asyncio
async def test_unmapped_verified_identity_is_denied(monkeypatch: MonkeyPatch) -> None:
    FakeHttpClient.responses = [FakeResponse(200, {"id": str(USER_ID)}), FakeResponse(200, [])]
    monkeypatch.setattr(auth.httpx, "AsyncClient", FakeHttpClient)

    with pytest.raises(HTTPException) as denied:
        await auth.current_principal(
            HTTPAuthorizationCredentials(scheme="Bearer", credentials="valid"), SETTINGS
        )

    assert denied.value.status_code == 403


@pytest.mark.asyncio
async def test_invalid_identity_token_is_denied(monkeypatch: MonkeyPatch) -> None:
    FakeHttpClient.responses = [FakeResponse(401, {"message": "invalid"})]
    monkeypatch.setattr(auth.httpx, "AsyncClient", FakeHttpClient)

    with pytest.raises(HTTPException) as denied:
        await auth.current_principal(
            HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid"), SETTINGS
        )

    assert denied.value.status_code == 401


@pytest.mark.asyncio
async def test_analyst_projection_omits_message_and_phone(
    monkeypatch: MonkeyPatch, lead_rows: list[dict[str, object]]
) -> None:
    async def select(
        self: DomainStore, table: str, select: str, *, limit: int = 100
    ) -> list[dict[str, object]]:
        del self, table, select, limit
        row = dict(lead_rows[0])
        for restricted in ("messages", "fictional_phone", "source_detail"):
            row.pop(restricted)
        return [row]

    monkeypatch.setattr(DomainStore, "select", select)
    async with client_for(Role.ANALYST) as client:
        response = client.get("/v1/analysis/leads", headers={"Authorization": "Bearer test"})

    assert response.status_code == 200
    assert "messages" not in response.json()[0]
    assert "fictional_phone" not in response.json()[0]


@pytest.mark.asyncio
async def test_analyst_cannot_access_message_detail() -> None:
    async with client_for(Role.ANALYST) as client:
        response = client.get(
            "/v1/messages/00000000-0000-0000-0000-000000000010",
            headers={"Authorization": "Bearer test"},
        )
    assert response.status_code == 403
    assert "body" not in response.text


@pytest.mark.asyncio
async def test_operator_cannot_reset() -> None:
    async with client_for(Role.OPERATOR) as client:
        response = client.post(
            "/v1/admin/synthetic-baseline/reset",
            headers={"Authorization": "Bearer test"},
            json={
                "confirmation": "RESET SYNTHETIC BASELINE",
                "reason": "test",
                "correlation_id": "test-1",
            },
        )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_supervisor_reset_requires_exact_confirmation(monkeypatch: MonkeyPatch) -> None:
    called = False

    async def reset(self: DomainStore, payload: dict[str, object]) -> dict[str, int]:
        del self, payload
        nonlocal called
        called = True
        return {}

    monkeypatch.setattr(DomainStore, "reset", reset)
    async with client_for(Role.SUPERVISOR) as client:
        response = client.post(
            "/v1/admin/synthetic-baseline/reset",
            headers={"Authorization": "Bearer test"},
            json={"confirmation": "reset", "reason": "test", "correlation_id": "test-2"},
        )
    assert response.status_code == 400
    assert called is False


@pytest.mark.asyncio
async def test_supervisor_reset_returns_stable_counts(monkeypatch: MonkeyPatch) -> None:
    counts = {"creators": 5, "content_sources": 10, "leads": 48, "messages": 48, "partner_rows": 30}

    async def reset(self: DomainStore, payload: dict[str, object]) -> dict[str, int]:
        del self
        assert payload["p_actor_id"] == str(USER_ID)
        return counts

    monkeypatch.setattr(DomainStore, "reset", reset)
    async with client_for(Role.SUPERVISOR) as client:
        response = client.post(
            "/v1/admin/synthetic-baseline/reset",
            headers={"Authorization": "Bearer test"},
            json={
                "confirmation": "RESET SYNTHETIC BASELINE",
                "reason": "test",
                "correlation_id": "test-3",
            },
        )
    assert response.status_code == 200
    assert response.json() == counts
