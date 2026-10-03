import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    request_timeout_seconds: float = 30.0
    ai_provider: str = "deterministic"
    openai_api_key: str | None = None
    openai_model: str = ""
    simulator_url: str = "http://simulator:8081"

    @classmethod
    def from_environment(cls) -> "Settings":
        supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
        supabase_anon_key = os.getenv("SUPABASE_ANON_KEY", "")
        supabase_service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        values = {
            "supabase_url": supabase_url,
            "supabase_anon_key": supabase_anon_key,
            "supabase_service_role_key": supabase_service_role_key,
        }
        missing = [name.upper() for name, value in values.items() if not value]
        if missing:
            raise RuntimeError(f"Required environment variables are missing: {', '.join(missing)}")
        return cls(
            supabase_url=supabase_url,
            supabase_anon_key=supabase_anon_key,
            supabase_service_role_key=supabase_service_role_key,
            ai_provider=os.getenv("AI_PROVIDER", "deterministic"),
            openai_api_key=os.getenv("OPENAI_API_KEY") or None,
            openai_model=os.getenv("OPENAI_MODEL", ""),
            simulator_url=os.getenv("SIMULATOR_URL", "http://simulator:8081").rstrip("/"),
        )

    @property
    def auth_health_url(self) -> str:
        return f"{self.supabase_url}/auth/v1/health"

    @property
    def auth_user_url(self) -> str:
        return f"{self.supabase_url}/auth/v1/user"

    @property
    def rest_url(self) -> str:
        return f"{self.supabase_url}/rest/v1"
