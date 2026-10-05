from dataclasses import dataclass
from enum import StrEnum
from typing import Annotated
from uuid import UUID

import httpx
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from nueva_ruta_api.config import Settings


class Role(StrEnum):
    OPERATOR = "operator"
    SUPERVISOR = "supervisor"
    ANALYST = "analyst"


@dataclass(frozen=True)
class Principal:
    id: UUID
    email: str
    role: Role


bearer = HTTPBearer(auto_error=False)


def get_settings(request: Request) -> Settings:
    override = getattr(request.app.state, "settings", None)
    return override if isinstance(override, Settings) else Settings.from_environment()


async def current_principal(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> Principal:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Valid bearer token required")
    common_headers = {"apikey": settings.supabase_anon_key}
    try:
        async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
            identity_response = await client.get(
                settings.auth_user_url,
                headers={**common_headers, "Authorization": f"Bearer {credentials.credentials}"},
            )
            if identity_response.status_code != status.HTTP_200_OK:
                raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid access token")
            identity = identity_response.json()
            user_id = UUID(identity["id"])
            role_response = await client.get(
                f"{settings.rest_url}/app_users",
                params={"id": f"eq.{user_id}", "active": "eq.true", "select": "email,role"},
                headers=settings.service_role_headers,
            )
    except (httpx.HTTPError, KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Identity verification failed") from exc
    if role_response.status_code != status.HTTP_200_OK:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Role lookup unavailable")
    mappings = role_response.json()
    if len(mappings) != 1:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Active application role required")
    try:
        return Principal(
            id=user_id,
            email=str(mappings[0]["email"]),
            role=Role(mappings[0]["role"]),
        )
    except (KeyError, ValueError) as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Valid application role required") from exc


def require_roles(*roles: Role) -> object:
    async def dependency(
        principal: Annotated[Principal, Depends(current_principal)],
    ) -> Principal:
        if principal.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Role is not authorized")
        return principal

    return dependency
