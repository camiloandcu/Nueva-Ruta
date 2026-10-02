from typing import Any

import httpx

from nueva_ruta_api.config import Settings


class DomainStore:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    @property
    def headers(self) -> dict[str, str]:
        key = self.settings.supabase_service_role_key
        return {"apikey": key, "Authorization": f"Bearer {key}"}

    async def select(self, table: str, select: str, *, limit: int = 100) -> list[dict[str, Any]]:
        async with httpx.AsyncClient(timeout=self.settings.request_timeout_seconds) as client:
            response = await client.get(
                f"{self.settings.rest_url}/{table}",
                params={"select": select, "order": "received_at.asc", "limit": str(limit)},
                headers=self.headers,
            )
        response.raise_for_status()
        payload: list[dict[str, Any]] = response.json()
        return payload

    async def message(self, message_id: str) -> dict[str, Any] | None:
        async with httpx.AsyncClient(timeout=self.settings.request_timeout_seconds) as client:
            response = await client.get(
                f"{self.settings.rest_url}/messages",
                params={
                    "id": f"eq.{message_id}",
                    "select": "id,lead_id,direction,body,sent_at,synthetic",
                },
                headers=self.headers,
            )
        response.raise_for_status()
        rows: list[dict[str, Any]] = response.json()
        return rows[0] if rows else None

    async def reset(self, payload: dict[str, Any]) -> dict[str, int]:
        async with httpx.AsyncClient(timeout=self.settings.request_timeout_seconds) as client:
            response = await client.post(
                f"{self.settings.rest_url}/rpc/reset_synthetic_baseline",
                json=payload,
                headers=self.headers,
            )
        response.raise_for_status()
        result: dict[str, int] = response.json()
        return result
