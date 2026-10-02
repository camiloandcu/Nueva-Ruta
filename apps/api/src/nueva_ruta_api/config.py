import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    request_timeout_seconds: float = 3.0

    @classmethod
    def from_environment(cls) -> "Settings":
        value = os.getenv("SUPABASE_URL", "").rstrip("/")
        if not value:
            raise RuntimeError("Required environment variable SUPABASE_URL is missing")
        return cls(supabase_url=value)

    @property
    def auth_health_url(self) -> str:
        return f"{self.supabase_url}/auth/v1/health"
