import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def test_wi005_n8n_disposition_workflow_uses_only_fastapi_and_branches_all_commands() -> None:
    workflow = json.loads((ROOT / "infra/n8n/workflows/wi-005-crm-disposition.json").read_text())
    nodes = workflow["nodes"]
    http_nodes = [node for node in nodes if node["type"] == "n8n-nodes-base.httpRequest"]
    assert len(http_nodes) == 1
    assert http_nodes[0]["parameters"]["url"].endswith(
        "/v1/crm/leads/{{$json.crm_lead_id}}/dispositions"
    )
    assert "/rest/v1/" not in http_nodes[0]["parameters"]["url"]
    assert "auth_token" not in http_nodes[0]["parameters"]["jsonBody"]

    switch = next(node for node in nodes if node["id"] == "disposition-result")
    outputs = {
        condition["rightValue"]
        for value in switch["parameters"]["rules"]["values"]
        for condition in value["conditions"]["conditions"]
    }
    assert outputs == {
        "contact_attempted",
        "info_sent",
        "transferred",
        "callback_scheduled",
        "closed_not_interested",
    }
    assert switch["parameters"]["options"]["renameFallbackOutput"] == (
        "validation_or_recovery_required"
    )


def test_wi005_partner_workflow_dispatches_and_replays_only_through_fastapi() -> None:
    workflow = json.loads((ROOT / "infra/n8n/workflows/wi-005-partner-transfer.json").read_text())
    http_nodes = [
        node for node in workflow["nodes"] if node["type"] == "n8n-nodes-base.httpRequest"
    ]
    urls = {node["parameters"]["url"] for node in http_nodes}
    assert any("/v1/crm/deliveries/process" in url for url in urls)
    assert any("/v1/crm/deliveries/{{$json.event_id}}/replay" in url for url in urls)
    assert all("/rest/v1/" not in url for url in urls)
    assert all("auth_token" not in node["parameters"].get("jsonBody", "") for node in http_nodes)

    operation_switch = next(
        node for node in workflow["nodes"] if node["id"] == "delivery-operation"
    )
    assert operation_switch["parameters"]["rules"]["values"][0]["outputKey"] == "manual_replay"
    outcome_switch = next(node for node in workflow["nodes"] if node["id"] == "delivery-outcome")
    outcomes = {
        condition["rightValue"]
        for value in outcome_switch["parameters"]["rules"]["values"]
        for condition in value["conditions"]["conditions"]
    }
    assert outcomes == {"delivered", "retry_scheduled", "dead_letter"}
