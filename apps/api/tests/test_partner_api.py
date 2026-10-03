from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
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


@pytest.mark.asyncio
async def test_operator_upload_creates_idempotent_import_with_raw_source_values(
    monkeypatch,
) -> None:
    async def rpc(self, name, payload):
        del self
        assert name == "create_partner_import"
        item = payload["p_payload"]
        assert item["synthetic"] is True
        assert item["rows"][0]["source_values"] == {
            "enrollment_id": "ENR-1",
            "phone": "+1 555-0100",
        }
        assert len(item["file_checksum"]) == 64
        return {
            "import_job_id": "00000000-0000-0000-0000-000000000006",
            "row_count": 1,
            "replayed": False,
        }

    monkeypatch.setattr(IngestionStore, "rpc", rpc)
    async with client_for(Role.OPERATOR) as client:
        response = client.post(
            "/v1/partner-imports?filename=sample.csv&synthetic=true",
            content="enrollment_id,phone\nENR-1,+1 555-0100\n",
            headers={"Content-Type": "text/csv"},
        )
    assert response.status_code == 201
    assert response.json()["row_count"] == 1


@pytest.mark.asyncio
async def test_partner_import_rejects_analyst_upload_and_non_synthetic_declaration(
    monkeypatch,
) -> None:
    async def unused_rpc(self, name, payload):
        raise AssertionError(f"unexpected RPC {name}: {payload}")

    monkeypatch.setattr(IngestionStore, "rpc", unused_rpc)
    async with client_for(Role.ANALYST) as client:
        denied = client.post(
            "/v1/partner-imports?filename=sample.csv&synthetic=true",
            content="enrollment_id\nENR-1\n",
        )
    assert denied.status_code == 403
    async with client_for(Role.OPERATOR) as client:
        rejected = client.post(
            "/v1/partner-imports?filename=sample.csv&synthetic=false",
            content="enrollment_id\nENR-1\n",
        )
        review_denied = client.post(
            "/v1/partner-imports/reconciliation/00000000-0000-0000-0000-000000000001/review",
            json={
                "action": "reject",
                "reason": "Synthetic test",
                "correlation_id": "wi006-role-denial",
            },
        )
    assert rejected.status_code == 422
    assert review_denied.status_code == 403
