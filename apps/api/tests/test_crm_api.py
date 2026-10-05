from collections.abc import Iterator
from contextlib import contextmanager
from uuid import UUID

from fastapi.testclient import TestClient
from nueva_ruta_api import auth, crm_api, main
from nueva_ruta_api.auth import Principal, Role
from nueva_ruta_api.config import Settings
from nueva_ruta_api.crm_store import CrmStore

TEST_USER = UUID("00000000-0000-0000-0000-000000000001")
TEST_SETTINGS = Settings("http://supabase.invalid", "anon", "service")


@contextmanager
def client_for(role: Role) -> Iterator[TestClient]:
    async def principal() -> Principal:
        return Principal(TEST_USER, "synthetic@localhost.invalid", role)

    main.app.dependency_overrides[auth.current_principal] = principal
    main.app.state.settings = TEST_SETTINGS
    try:
        with TestClient(main.app) as client:
            yield client
    finally:
        main.app.dependency_overrides.clear()
        del main.app.state.settings


def test_analyst_cannot_read_or_mutate_crm() -> None:
    with client_for(Role.ANALYST) as client:
        assert client.get("/v1/crm/leads").status_code == 403
        response = client.post(
            "/v1/crm/leads/00000000-0000-0000-0000-000000000002/dispositions",
            json={
                "disposition": "No Answer",
                "idempotency_key": "crm-api-denied-0001",
                "reason": "Unauthorized synthetic test",
                "correlation_id": "crm-api-denied",
            },
        )
    assert response.status_code == 403


def test_unauthenticated_actor_cannot_read_crm() -> None:
    main.app.state.settings = TEST_SETTINGS
    try:
        with TestClient(main.app) as client:
            assert client.get("/v1/crm/leads").status_code == 401
    finally:
        del main.app.state.settings


def test_operator_invalid_callback_is_rejected_before_domain_write() -> None:
    with client_for(Role.OPERATOR) as client:
        response = client.post(
            "/v1/crm/leads/00000000-0000-0000-0000-000000000002/dispositions",
            json={
                "disposition": "Call Back",
                "idempotency_key": "crm-api-callback-0001",
                "reason": "Missing callback time",
                "correlation_id": "crm-api-callback",
            },
        )
    assert response.status_code == 422
    assert "Call Back requires" in response.text


def test_delivery_processing_passes_request_correlation_to_simulator_boundary(
    monkeypatch,
) -> None:
    async def dispatch(settings, mode, *, correlation_id=None):
        assert settings == TEST_SETTINGS
        assert mode == "success"
        return {"correlation_id": correlation_id}

    monkeypatch.setattr(crm_api, "dispatch_due_transfers", dispatch)
    with client_for(Role.OPERATOR) as client:
        response = client.post(
            "/v1/crm/deliveries/process",
            headers={"X-Correlation-ID": "wi005-flow-001"},
            json={"mode": "success"},
        )

    assert response.status_code == 200
    assert response.json() == {"correlation_id": "wi005-flow-001"}


def test_operator_can_read_disposition_audit_trail(monkeypatch) -> None:
    async def rows(self, table: str, **kwargs: object):
        del self
        assert table == "crm_disposition_events"
        assert kwargs == {"order": "occurred_at.desc"}
        return [{"disposition": "Info Sent", "resulting_stage": "info_sent"}]

    monkeypatch.setattr(CrmStore, "rows", rows)
    with client_for(Role.OPERATOR) as client:
        response = client.get("/v1/crm/dispositions")

    assert response.status_code == 200
    assert response.json() == [{"disposition": "Info Sent", "resulting_stage": "info_sent"}]


def test_global_queues_use_case_labeled_read_models(monkeypatch) -> None:
    expected = {
        "escalations": "operational_escalations",
        "recovery": "operational_crm_recovery",
        "follow-up-drafts": "operational_crm_follow_up_drafts",
        "deliveries": "operational_partner_deliveries",
        "delivery-attempts": "operational_partner_delivery_attempts",
    }

    async def rows(self, table: str, **kwargs: object):
        del self, kwargs
        assert table in expected.values()
        return [{"business_id": "LEAD-054", "crm_lead_id": str(TEST_USER)}]

    monkeypatch.setattr(CrmStore, "rows", rows)
    with client_for(Role.ANALYST) as client:
        assert client.get("/v1/crm/recovery").status_code == 403
    with client_for(Role.OPERATOR) as client:
        for path in expected:
            response = client.get(f"/v1/crm/{path}")
            assert response.status_code == 200
            assert response.json()[0]["business_id"] == "LEAD-054"


def test_message_evidence_is_case_scoped_and_operator_only(monkeypatch) -> None:
    lead_id = "00000000-0000-0000-0000-000000000002"

    async def rows(self, table: str, **kwargs: object):
        del self
        assert table == "operational_crm_message_evidence"
        assert kwargs == {
            "order": "approved_at.desc",
            "filters": {"crm_lead_id": f"eq.{lead_id}"},
        }
        return [{"crm_lead_id": lead_id, "draft_kind": "intake"}]

    monkeypatch.setattr(CrmStore, "rows", rows)
    with client_for(Role.ANALYST) as client:
        assert client.get(f"/v1/crm/leads/{lead_id}/message-evidence").status_code == 403
    with client_for(Role.OPERATOR) as client:
        response = client.get(f"/v1/crm/leads/{lead_id}/message-evidence")
    assert response.status_code == 200
    assert response.json() == [{"crm_lead_id": lead_id, "draft_kind": "intake"}]


def test_message_delivery_command_passes_case_and_actor(monkeypatch) -> None:
    lead_id = "00000000-0000-0000-0000-000000000002"
    draft_id = "00000000-0000-0000-0000-000000000003"

    async def rpc(self, name: str, payload: dict[str, object]):
        del self
        assert name == "record_simulated_message_delivery"
        assert payload["p_payload"] == {
            "draft_kind": "intake",
            "draft_id": draft_id,
            "idempotency_key": "delivery-key-0001",
            "correlation_id": "crm-api-delivery",
            "actor_id": str(TEST_USER),
            "crm_lead_id": lead_id,
        }
        return {"channel": "simulated", "delivery_event_id": draft_id}

    monkeypatch.setattr(CrmStore, "rpc", rpc)
    body = {
        "draft_kind": "intake",
        "draft_id": draft_id,
        "idempotency_key": "delivery-key-0001",
        "correlation_id": "crm-api-delivery",
    }
    with client_for(Role.ANALYST) as client:
        assert (
            client.post(f"/v1/crm/leads/{lead_id}/message-deliveries", json=body).status_code == 403
        )
    with client_for(Role.OPERATOR) as client:
        response = client.post(f"/v1/crm/leads/{lead_id}/message-deliveries", json=body)
    assert response.status_code == 200
    assert response.json()["channel"] == "simulated"
