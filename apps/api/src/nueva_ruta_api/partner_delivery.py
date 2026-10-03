from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Literal

import httpx

from nueva_ruta_api.config import Settings
from nueva_ruta_api.crm_store import CrmStore


async def dispatch_due_transfers(
    settings: Settings,
    mode: Literal["success", "retryable_failure", "permanent_failure"] = "success",
) -> dict[str, Any]:
    store = CrmStore(settings)
    pending = await store.rows(
        "outbox_events",
        order="next_attempt_at.asc",
        filters={"status": "in.(pending,retry_scheduled)"},
        limit=20,
    )
    results: list[dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
        for event in pending:
            claimed = await store.rpc("claim_partner_outbox", {"p_event_id": event["id"]})
            if not claimed:
                continue
            started_at = datetime.now(UTC).isoformat()
            lead_rows = await store.rows(
                "operational_crm_leads", filters={"id": f"eq.{claimed['crm_lead_id']}"}, limit=1
            )
            lead = lead_rows[0] if lead_rows else {}
            outcome = "retryable_failure"
            error_category = "transport"
            safe_error = "Simulator connection failed"
            partner_request_id = None
            try:
                response = await client.post(
                    f"{settings.simulator_url}/v1/partner/transfers",
                    json={
                        "transfer_id": claimed["transfer_id"],
                        "idempotency_key": claimed["idempotency_key"],
                        "crm_lead_id": claimed["crm_lead_id"],
                        "source_event_id": claimed["source_event_id"],
                        "fictional_phone": lead.get("fictional_phone"),
                        "synthetic": True,
                        "mode": mode,
                    },
                )
                if response.is_success:
                    body = response.json()
                    outcome = "delivered"
                    partner_request_id = body.get("partner_request_id")
                    error_category = ""
                    safe_error = ""
                elif response.status_code == 422:
                    outcome = "permanent_failure"
                    error_category = "partner_rejected"
                    safe_error = "Partner simulator rejected the transfer"
                else:
                    error_category = "partner_unavailable"
                    safe_error = "Partner simulator returned a retryable failure"
            except httpx.TimeoutException:
                safe_error = "Partner simulator timed out"
            except httpx.HTTPError:
                safe_error = "Partner simulator connection failed"
            completed = await store.rpc(
                "complete_partner_outbox",
                {
                    "p_payload": {
                        "event_id": claimed["event_id"],
                        "attempt_number": claimed["attempt_number"],
                        "started_at": started_at,
                        "outcome": outcome,
                        "error_category": error_category,
                        "safe_error": safe_error,
                        "partner_request_id": partner_request_id,
                    }
                },
            )
            results.append(completed)
    return {"processed": len(results), "results": results}
