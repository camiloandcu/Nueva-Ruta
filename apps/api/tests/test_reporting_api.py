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
from nueva_ruta_api.ingestion_store import IngestionStore
from nueva_ruta_api.rules import canonical_content, parse_yaml

SETTINGS = Settings("http://supabase.invalid", "anon", "service")
USER = UUID("00000000-0000-0000-0000-000000000001")
SEED = Path("config/rules/fictional-defaults.yaml").read_text()


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


def facts() -> dict[str, object]:
    return {
        "active_rule": {
            "id": "rule-v2",
            "version": 2,
            "content": canonical_content(parse_yaml(SEED)),
        },
        "leads": [],
        "transfers": [],
        "imports": [],
        "enrollments": [],
        "reconciliations": [],
        "normalized_quality": [],
        "decisions": [],
        "drafts": [],
        "follow_up_drafts": [],
        "escalations": [],
        "dispositions": [],
        "outbox": [],
        "delivery_attempts": [],
    }


@pytest.mark.asyncio
async def test_filter_options_reflect_authorized_facts_and_exclude_unsupported_values(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def rpc(self: IngestionStore, name: str, payload: dict[str, object]) -> dict[str, object]:
        del self
        assert name == "operational_reporting_facts"
        assert payload == {"p_actor_id": str(USER)}
        snapshot = facts()
        snapshot["leads"] = [
            {"creator_business_id": "CR-002", "channel": "ctwa", "state": "TX"},
            {"creator_business_id": "CR-002", "channel": "organic", "state": "CA"},
            {"creator_business_id": "CR-bad", "channel": "other", "state": "NY"},
        ]
        return snapshot

    monkeypatch.setattr(IngestionStore, "rpc", rpc)
    async with client_for(Role.ANALYST) as client:
        response = client.get("/v1/reports/filter-options")
    assert response.status_code == 200
    assert response.json() == {
        "creators": ["CR-002"],
        "channels": ["ctwa", "organic"],
        "states": ["CA", "TX"],
        "can_open_crm": False,
    }
    assert "fictional_phone" not in response.text
    async with client_for(Role.OPERATOR) as client:
        operator_response = client.get("/v1/reports/filter-options")
    assert operator_response.status_code == 200
    assert operator_response.json()["can_open_crm"] is True


@pytest.mark.asyncio
async def test_analyst_can_read_reports_through_authorized_fastapi_rpc(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}

    async def rpc(self: IngestionStore, name: str, payload: dict[str, object]) -> dict[str, object]:
        del self
        captured["name"] = name
        captured.update(payload)
        return facts()

    monkeypatch.setattr(IngestionStore, "rpc", rpc)
    async with client_for(Role.ANALYST) as client:
        response = client.get(
            "/v1/reports/overview?from=2026-09-01&to=2026-09-30&creator=CR-001&channel=ctwa&state=TX&as_of=2026-09-15T17:00:00Z&stalled_limit=10&stalled_offset=5"
        )
    assert response.status_code == 200
    assert response.json()["filters"]["reporting_timezone"] == "America/New_York"
    assert response.json()["stalled_pagination"]["limit"] == 10
    assert response.json()["stalled_pagination"]["offset"] == 5
    assert captured["name"] == "operational_reporting_facts"
    assert captured["p_actor_id"] == str(USER)
    assert "fictional_phone" not in response.text


@pytest.mark.asyncio
async def test_report_filters_fail_closed_and_unmapped_analyst_has_no_rpc(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    called = False

    async def rpc(self: IngestionStore, name: str, payload: dict[str, object]) -> dict[str, object]:
        del self, name, payload
        nonlocal called
        called = True
        return facts()

    monkeypatch.setattr(IngestionStore, "rpc", rpc)
    async with client_for(Role.ANALYST) as client:
        bad_channel = client.get("/v1/reports/overview?channel=whatsapp")
        bad_range = client.get("/v1/reports/overview?from=2026-10-01&to=2026-09-01")
        bad_page = client.get("/v1/reports/overview?stalled_limit=101")
    async with client_for(Role.OPERATOR) as client:
        assert client.get("/v1/reports/overview?as_of=2026-09-15T17:00:00").status_code == 422
    assert bad_channel.status_code == 422
    assert bad_range.status_code == 422
    assert bad_page.status_code == 422
    assert called is False


@pytest.mark.asyncio
async def test_report_evidence_is_read_only_and_not_found_is_actionable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def rpc(self: IngestionStore, name: str, payload: dict[str, object]) -> dict[str, object]:
        del self, name, payload
        request = httpx.Request("POST", "http://supabase.invalid/rpc/evidence")
        response = httpx.Response(
            404, request=request, json={"message": "reported enrollment not found"}
        )
        raise httpx.HTTPStatusError("not found", request=request, response=response)

    monkeypatch.setattr(IngestionStore, "rpc", rpc)
    async with client_for(Role.ANALYST) as client:
        response = client.get("/v1/reports/enrollments/00000000-0000-0000-0000-000000000010")
    assert response.status_code == 404
    assert response.json()["detail"] == "Enrollment evidence not found"


@pytest.mark.asyncio
async def test_report_evidence_redacts_raw_partner_values_and_phone(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def rpc(self: IngestionStore, name: str, payload: dict[str, object]) -> dict[str, object]:
        del self, name, payload
        return {
            "canonical_enrollment_id": "00000000-0000-0000-0000-000000000010",
            "source_row_numbers": [1],
            "reconciliation": {
                "status": "review_required",
                "evidence": {
                    "normalization_version": "wi006-v1",
                    "source_row_numbers": [1],
                    "source_values": {"phone_raw": "+15550100"},
                    "normalized_phone": "+15550100",
                },
            },
            "source_rows": [{"row_number": 1, "row_checksum": "a" * 64}],
        }

    monkeypatch.setattr(IngestionStore, "rpc", rpc)
    async with client_for(Role.ANALYST) as client:
        response = client.get("/v1/reports/enrollments/00000000-0000-0000-0000-000000000010")
    assert response.status_code == 200
    assert "+15550100" not in response.text
    assert "source_values" not in response.text
    assert response.json()["reconciliation"]["evidence"] == {
        "normalization_version": "wi006-v1",
        "source_row_numbers": [1],
    }
