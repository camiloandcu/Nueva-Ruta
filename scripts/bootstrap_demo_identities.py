import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]


def fail(message: str) -> None:
    print(f"error: {message}", file=sys.stderr)
    raise SystemExit(1)


def dotenv() -> dict[str, str]:
    path = ROOT / ".env"
    values: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


BASE_URL = os.environ.get("SUPABASE_BOOTSTRAP_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


def request(method: str, path: str, body: dict[str, Any] | None = None, *, prefer: str = "") -> Any:
    data = None if body is None else json.dumps(body).encode()
    headers = {
        "apikey": SERVICE_KEY,
        "Content-Type": "application/json",
    }
    if not SERVICE_KEY.startswith("sb_secret_"):
        headers["Authorization"] = f"Bearer {SERVICE_KEY}"
    if prefer:
        headers["Prefer"] = prefer
    req = urllib.request.Request(f"{BASE_URL}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            payload = response.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors="replace")[:300]
        fail(f"Supabase identity bootstrap failed ({exc.code}): {detail}")
    return json.loads(payload) if payload else None


def main() -> None:
    if not BASE_URL or not SERVICE_KEY:
        fail("SUPABASE_BOOTSTRAP_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    env = {**dotenv(), **os.environ}
    accounts = [
        ("operator", "DEMO_OPERATOR_EMAIL", "DEMO_OPERATOR_PASSWORD", "Demo Operator"),
        ("supervisor", "DEMO_SUPERVISOR_EMAIL", "DEMO_SUPERVISOR_PASSWORD", "Demo Supervisor"),
        ("analyst", "DEMO_ANALYST_EMAIL", "DEMO_ANALYST_PASSWORD", "Demo Influgain Analyst"),
    ]
    missing = [key for account in accounts for key in account[1:3] if not env.get(key)]
    if missing:
        fail(f"missing local demo identity configuration: {', '.join(missing)}")

    listed = request("GET", "/auth/v1/admin/users?page=1&per_page=1000")
    users = listed.get("users", []) if isinstance(listed, dict) else []
    by_email = {str(user.get("email", "")).lower(): user for user in users}
    for role, email_key, password_key, display_name in accounts:
        email = env[email_key].lower()
        password = env[password_key]
        existing = by_email.get(email)
        if existing:
            user = request(
                "PUT",
                f"/auth/v1/admin/users/{existing['id']}",
                {"password": password, "email_confirm": True},
            )
        else:
            user = request(
                "POST",
                "/auth/v1/admin/users",
                {"email": email, "password": password, "email_confirm": True},
            )
        request(
            "POST",
            "/rest/v1/app_users?on_conflict=id",
            {
                "id": user["id"],
                "email": email,
                "display_name": display_name,
                "role": role,
                "active": True,
            },
            prefer="resolution=merge-duplicates,return=minimal",
        )
    print("ready: three local demo identities mapped to application roles")


if __name__ == "__main__":
    main()
