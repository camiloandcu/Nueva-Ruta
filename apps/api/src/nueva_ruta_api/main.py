from typing import Any

import httpx
from fastapi import FastAPI, Response, status

from nueva_ruta_api.config import Settings

app = FastAPI(title="Nueva Ruta API", version="0.1.0")


async def check_supabase_auth(settings: Settings) -> tuple[bool, str]:
    try:
        async with httpx.AsyncClient(timeout=settings.request_timeout_seconds) as client:
            response = await client.get(settings.auth_health_url)
        if response.is_success:
            return True, "ready"
        return False, f"unexpected_status_{response.status_code}"
    except httpx.TimeoutException:
        return False, "timeout"
    except httpx.HTTPError:
        return False, "connection_error"


@app.get("/health/live")
async def liveness() -> dict[str, str]:
    return {"service": "api", "status": "alive"}


@app.get("/health/ready")
async def readiness(response: Response) -> dict[str, Any]:
    try:
        settings = Settings.from_environment()
    except RuntimeError:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "service": "api",
            "status": "not_ready",
            "dependencies": {"supabase_auth": "missing_configuration"},
        }

    ready, reason = await check_supabase_auth(settings)
    if not ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {
        "service": "api",
        "status": "ready" if ready else "not_ready",
        "dependencies": {"supabase_auth": reason},
    }
