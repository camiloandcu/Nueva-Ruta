from fastapi.testclient import TestClient
from nueva_ruta_simulator.main import app

client = TestClient(app)
REQUEST = {
    "transfer_id": "00000000-0000-4000-8000-000000000001",
    "crm_lead_id": "00000000-0000-4000-8000-000000000002",
    "idempotency_key": "transfer-key-00001",
    "fictional_phone": "+15550100",
    "synthetic": True,
}


def test_partner_simulator_returns_stable_case_id_for_success() -> None:
    response = client.post("/v1/partner/transfers", json=REQUEST)
    assert response.status_code == 200
    assert response.json()["partner_request_id"].startswith("CC-")
    assert (
        response.json()["partner_request_id"]
        == client.post("/v1/partner/transfers", json=REQUEST).json()["partner_request_id"]
    )


def test_partner_simulator_exposes_retryable_and_permanent_failures() -> None:
    retry = client.post("/v1/partner/transfers", json={**REQUEST, "mode": "retryable_failure"})
    permanent = client.post("/v1/partner/transfers", json={**REQUEST, "mode": "permanent_failure"})
    assert retry.status_code == 503
    assert permanent.status_code == 422
