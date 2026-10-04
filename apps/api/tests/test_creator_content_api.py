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
SCRIPT_ID = "00000000-0000-0000-0000-000000000010"
VERSION_ID = "00000000-0000-0000-0000-000000000020"
BODY = (
    "Cuando las facturas se juntan, puede ser difícil saber qué preguntar primero. "
    "Una lista sencilla con tus cuentas y fechas quizá te ayude a ordenar la conversación, "
    "sin compartir números de cuenta por chat. Si estás explorando opciones, un consejero "
    "podría explicarte qué alternativas existen dependiendo de tu situación y de los "
    "acreedores. Cada caso es distinto; esta información no garantiza cambios en tus pagos. "
    "Si quieres, solicita información en privado y el equipo te contará cómo iniciar una "
    "conversación informativa."
)


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


def facts(*, risk: str = "low", review_reason: str = "reviewer private note") -> dict[str, object]:
    return {
        "creators": [
            {"id": "creator-uuid", "business_id": "CR-001", "fictional_name": "Ana ficticia"}
        ],
        "sources": [
            {
                "id": "source-uuid",
                "business_id": "SRC-001",
                "source_date": "2026-09-15",
                "compliance_risk": risk,
                "risk_reason": "test synthetic risk",
                "synthetic": True,
            }
        ],
        "leads": [
            {
                "business_id": "LEAD-001",
                "creator_business_id": "CR-001",
                "source_business_id": "SRC-001",
                "commercial_stage": "new",
                "fictional_phone": "+15550100",
                "body": "raw private lead text",
            }
        ],
        "scripts": [
            {
                "id": SCRIPT_ID,
                "business_id": "SCRIPT-001",
                "title": "Draft",
                "versions": [
                    {
                        "id": VERSION_ID,
                        "version": 1,
                        "creator_id": "CR-001",
                        "source_id": "SRC-001",
                        "body": BODY,
                        "review": {
                            "decision": "changes_requested",
                            "reason": review_reason,
                        },
                    }
                ],
            }
        ],
    }


@pytest.mark.asyncio
async def test_analyst_reads_safe_profiles_and_script_without_private_details(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def rpc(self: IngestionStore, name: str, payload: dict[str, object]) -> dict[str, object]:
        del self
        assert name == "creator_content_facts"
        assert payload["p_actor_id"] == str(USER)
        return facts()

    monkeypatch.setattr(IngestionStore, "rpc", rpc)
    async with client_for(Role.ANALYST) as client:
        profile = client.get("/v1/creators")
        scripts = client.get("/v1/content/scripts")
    assert profile.status_code == 200
    assert profile.json()[0]["funnel_evidence"]["linked_leads"] == 1
    assert scripts.status_code == 200
    assert "reviewer private note" not in scripts.text
    assert "+15550100" not in profile.text + scripts.text
    assert "raw private lead text" not in profile.text + scripts.text


@pytest.mark.asyncio
async def test_analyst_cannot_create_or_review_script_versions(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def rpc(self: IngestionStore, name: str, payload: dict[str, object]) -> dict[str, object]:
        del self, name, payload
        return facts()

    monkeypatch.setattr(IngestionStore, "rpc", rpc)
    async with client_for(Role.ANALYST) as client:
        create = client.post(
            f"/v1/content/scripts/{SCRIPT_ID}/versions",
            json={
                "creator_id": "CR-001",
                "source_id": "SRC-001",
                "fit_rationale": "A fit rationale for this creator.",
                "body": BODY,
            },
        )
        review = client.post(
            f"/v1/content/script-versions/{VERSION_ID}/review",
            json={"decision": "approved", "reason": "Reviewed by supervisor"},
        )
    assert create.status_code == 403
    assert review.status_code == 403


@pytest.mark.asyncio
async def test_access_contract_returns_role_appropriate_capabilities() -> None:
    async with client_for(Role.OPERATOR) as operator_client:
        operator = operator_client.get("/v1/creator-content/access")
    async with client_for(Role.SUPERVISOR) as supervisor_client:
        supervisor = supervisor_client.get("/v1/creator-content/access")
    async with client_for(Role.ANALYST) as analyst_client:
        analyst = analyst_client.get("/v1/creator-content/access")
    assert operator.json() == {"role": "operator", "can_author": True, "can_review": False}
    assert supervisor.json() == {
        "role": "supervisor",
        "can_author": True,
        "can_review": True,
    }
    assert analyst.json() == {"role": "analyst", "can_author": False, "can_review": False}


@pytest.mark.asyncio
async def test_author_creates_duration_checked_version_with_checksum(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}

    async def rpc(self: IngestionStore, name: str, payload: dict[str, object]) -> dict[str, object]:
        del self
        if name == "creator_content_facts":
            return facts()
        captured["name"] = name
        captured.update(payload)
        return {
            "id": VERSION_ID,
            "script_id": "SCRIPT-001",
            "version": 2,
            "review_state": "pending_review",
        }

    monkeypatch.setattr(IngestionStore, "rpc", rpc)
    async with client_for(Role.OPERATOR) as client:
        response = client.post(
            f"/v1/content/scripts/{SCRIPT_ID}/versions",
            json={
                "creator_id": "CR-001",
                "source_id": "SRC-001",
                "fit_rationale": "A fit rationale for this creator.",
                "body": BODY,
            },
        )
    assert response.status_code == 201
    assert response.json()["compliance_valid"] is True
    assert response.json()["estimated_duration_seconds"] == pytest.approx(
        len(BODY.split()) * 60 / 135, abs=0.01
    )
    assert len(str(captured["p_body_checksum"])) == 64
    assert captured["p_actor_id"] == str(USER)


@pytest.mark.asyncio
async def test_high_risk_and_noncompliant_sources_do_not_reach_storage(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def rpc(self: IngestionStore, name: str, payload: dict[str, object]) -> dict[str, object]:
        del self, name, payload
        return facts(risk="high")

    monkeypatch.setattr(IngestionStore, "rpc", rpc)
    async with client_for(Role.OPERATOR) as client:
        high_risk = client.post(
            f"/v1/content/scripts/{SCRIPT_ID}/versions",
            json={
                "creator_id": "CR-001",
                "source_id": "SRC-001",
                "fit_rationale": "A fit rationale for this creator.",
                "body": BODY,
            },
        )
        bad_body = BODY.replace("podría", "te recomiendo")
        noncompliant = client.post(
            f"/v1/content/scripts/{SCRIPT_ID}/versions",
            json={
                "creator_id": "CR-001",
                "source_id": "SRC-001",
                "fit_rationale": "A fit rationale for this creator.",
                "body": bad_body,
            },
        )
    assert high_risk.status_code == 422
    assert noncompliant.status_code == 422


@pytest.mark.asyncio
async def test_supervisor_reviews_only_latest_valid_version(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}

    async def rpc(self: IngestionStore, name: str, payload: dict[str, object]) -> dict[str, object]:
        del self
        if name == "creator_content_facts":
            return facts()
        captured["name"] = name
        captured.update(payload)
        return {"id": "review-uuid", "decision": payload["p_decision"]}

    monkeypatch.setattr(IngestionStore, "rpc", rpc)
    async with client_for(Role.SUPERVISOR) as client:
        response = client.post(
            f"/v1/content/script-versions/{VERSION_ID}/review",
            json={"decision": "approved", "reason": "Reviewed and compliant"},
        )
    assert response.status_code == 200
    assert captured["p_actor_id"] == str(USER)
    assert captured["p_decision"] == "approved"
