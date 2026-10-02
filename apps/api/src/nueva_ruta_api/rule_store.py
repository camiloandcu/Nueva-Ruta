from typing import Any

import httpx

from nueva_ruta_api.config import Settings


class RuleStore:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    @property
    def headers(self) -> dict[str, str]:
        key = self.settings.supabase_service_role_key
        return {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Prefer": "return=representation",
        }

    async def rows(
        self, table: str, *, filters: dict[str, str] | None = None, order: str = "created_at.desc"
    ) -> list[dict[str, Any]]:
        params = {"select": "*", "order": order, **(filters or {})}
        async with httpx.AsyncClient(timeout=self.settings.request_timeout_seconds) as client:
            response = await client.get(
                f"{self.settings.rest_url}/{table}", params=params, headers=self.headers
            )
        response.raise_for_status()
        payload: list[dict[str, Any]] = response.json()
        return payload

    async def create_draft(self, payload: dict[str, Any]) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self.settings.request_timeout_seconds) as client:
            response = await client.post(
                f"{self.settings.rest_url}/rule_drafts", json=payload, headers=self.headers
            )
        response.raise_for_status()
        rows: list[dict[str, Any]] = response.json()
        return rows[0]

    async def rpc(self, name: str, payload: dict[str, Any]) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self.settings.request_timeout_seconds) as client:
            response = await client.post(
                f"{self.settings.rest_url}/rpc/{name}", json=payload, headers=self.headers
            )
        response.raise_for_status()
        value: dict[str, Any] = response.json()
        return value
