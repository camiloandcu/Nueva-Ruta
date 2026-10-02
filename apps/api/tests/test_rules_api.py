from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from uuid import UUID

import httpx
import pytest
from fastapi.testclient import TestClient
from nueva_ruta_api import auth, main
from nueva_ruta_api.auth import Principal, Role
from nueva_ruta_api.config import Settings
from nueva_ruta_api.rule_store import RuleStore

SETTINGS = Settings("http://supabase.invalid", "anon-test", "service-test")
USER_ID = UUID("00000000-0000-0000-0000-000000000001")
DRAFT_ID = UUID("00000000-0000-0000-0000-000000000010")
VERSION_ID = UUID("00000000-0000-0000-0000-000000000020")
SEED = Path("config/rules/fictional-defaults.yaml").read_text()


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


@pytest.mark.asyncio
async def test_operator_can_import_valid_draft(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    async def create(self: RuleStore, payload: dict[str, object]) -> dict[str, object]:
        del self
        captured.update(payload)
        return {"id": str(DRAFT_ID), **payload}

    monkeypatch.setattr(RuleStore, "create_draft", create)
    async with client_for(Role.OPERATOR) as client:
        response = client.post(
            "/v1/rules/drafts/import",
            headers={"Authorization": "Bearer test"},
            json={"yaml": SEED, "source_name": "test.yaml"},
        )

    assert response.status_code == 201
    assert response.json()["valid"] is True
    assert response.json()["validation_issues"] == []
    assert captured["created_by"] == str(USER_ID)


@pytest.mark.asyncio
async def test_invalid_policy_is_not_persisted(monkeypatch: pytest.MonkeyPatch) -> None:
    called = False

    async def create(self: RuleStore, payload: dict[str, object]) -> dict[str, object]:
        del self, payload
        nonlocal called
        called = True
        return {}

    monkeypatch.setattr(RuleStore, "create_draft", create)
    async with client_for(Role.OPERATOR) as client:
        response = client.post(
            "/v1/rules/drafts/import",
            headers={"Authorization": "Bearer test"},
            json={"yaml": "schema_version: [", "source_name": "bad.yaml"},
        )

    assert response.status_code == 422
    assert called is False
    assert response.json()["detail"][0]["code"] == "RULE_YAML_PARSE"


@pytest.mark.asyncio
async def test_operator_cannot_publish(monkeypatch: pytest.MonkeyPatch) -> None:
    called = False

    async def rpc(self: RuleStore, name: str, payload: dict[str, object]) -> dict[str, object]:
        del self, name, payload
        nonlocal called
        called = True
        return {}

    monkeypatch.setattr(RuleStore, "rpc", rpc)
    async with client_for(Role.OPERATOR) as client:
        response = client.post(
            f"/v1/rules/drafts/{DRAFT_ID}/publish",
            headers={"Authorization": "Bearer test"},
            json={"content_hash": "a" * 64, "reason": "test", "correlation_id": "rules-1"},
        )

    assert response.status_code == 403
    assert called is False


@pytest.mark.asyncio
async def test_supervisor_publication_forwards_exact_hash(monkeypatch: pytest.MonkeyPatch) -> None:
    expected = {"id": str(VERSION_ID), "version": 2, "content_hash": "b" * 64, "active": True}

    async def rpc(self: RuleStore, name: str, payload: dict[str, object]) -> dict[str, object]:
        del self
        assert name == "publish_rule_draft"
        assert payload["p_confirmed_hash"] == "b" * 64
        assert payload["p_actor_id"] == str(USER_ID)
        return expected

    monkeypatch.setattr(RuleStore, "rpc", rpc)
    async with client_for(Role.SUPERVISOR) as client:
        response = client.post(
            f"/v1/rules/drafts/{DRAFT_ID}/publish",
            headers={"Authorization": "Bearer test"},
            json={"content_hash": "b" * 64, "reason": "reviewed", "correlation_id": "rules-2"},
        )

    assert response.status_code == 200
    assert response.json() == expected


@pytest.mark.asyncio
async def test_stale_hash_returns_conflict(monkeypatch: pytest.MonkeyPatch) -> None:
    request = httpx.Request("POST", "http://supabase.invalid/rpc/publish_rule_draft")
    response = httpx.Response(409, request=request)

    async def rpc(self: RuleStore, name: str, payload: dict[str, object]) -> dict[str, object]:
        del self, name, payload
        raise httpx.HTTPStatusError("conflict", request=request, response=response)

    monkeypatch.setattr(RuleStore, "rpc", rpc)
    async with client_for(Role.SUPERVISOR) as client:
        result = client.post(
            f"/v1/rules/drafts/{DRAFT_ID}/publish",
            headers={"Authorization": "Bearer test"},
            json={"content_hash": "c" * 64, "reason": "reviewed", "correlation_id": "rules-3"},
        )

    assert result.status_code == 409
    assert "stale" in result.json()["detail"]


@pytest.mark.asyncio
async def test_rollback_draft_preserves_derivation(monkeypatch: pytest.MonkeyPatch) -> None:
    async def rows(
        self: RuleStore,
        table: str,
        *,
        filters: dict[str, str] | None = None,
        order: str = "created_at.desc",
    ) -> list[dict[str, object]]:
        del self, filters, order
        assert table == "rule_versions"
        from nueva_ruta_api.rules import canonical_content, content_hash, parse_yaml

        document = parse_yaml(SEED)
        return [
            {
                "id": str(VERSION_ID),
                "content": canonical_content(document),
                "content_hash": content_hash(document),
            }
        ]

    async def create(self: RuleStore, payload: dict[str, object]) -> dict[str, object]:
        del self
        return {"id": str(DRAFT_ID), **payload}

    monkeypatch.setattr(RuleStore, "rows", rows)
    monkeypatch.setattr(RuleStore, "create_draft", create)
    async with client_for(Role.SUPERVISOR) as client:
        response = client.post(
            "/v1/rules/rollback-drafts",
            headers={"Authorization": "Bearer test"},
            json={"version_id": str(VERSION_ID), "reason": "restore reviewed policy"},
        )

    assert response.status_code == 201
    assert response.json()["derived_from_version_id"] == str(VERSION_ID)
