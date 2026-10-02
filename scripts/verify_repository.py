import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []


def fail(message: str) -> None:
    errors.append(message)


required_paths = (
    "apps/api/Dockerfile",
    "apps/simulator/Dockerfile",
    "apps/web/Dockerfile",
    "compose.yaml",
    "supabase/config.toml",
    "supabase/migrations/20261002000000_runtime_baseline.sql",
)
for relative_path in required_paths:
    if not (ROOT / relative_path).is_file():
        fail(f"required foundation file is missing: {relative_path}")

if any(path.name.lower().startswith("alembic") for path in ROOT.rglob("*")):
    fail("Alembic artifacts are forbidden; Supabase SQL migrations are authoritative")

runtime_migration_text = (
    ROOT / "supabase/migrations/20261002000000_runtime_baseline.sql"
).read_text(encoding="utf-8")
for forbidden_ddl in (r"\bcreate\s+table\b", r"\bcreate\s+type\b", r"\binsert\s+into\b"):
    if re.search(forbidden_ddl, runtime_migration_text, flags=re.IGNORECASE):
        fail(f"WI-001 migration contains forbidden domain DDL/data: {forbidden_ddl}")

domain_migration = ROOT / "supabase/migrations/20261002010000_domain_baseline.sql"
if not domain_migration.is_file():
    fail("WI-002 domain migration is missing")

for relative_root in ("apps/web", "infra/n8n"):
    for path in (ROOT / relative_root).rglob("*"):
        if not path.is_file() or any(part in {"node_modules", ".next"} for part in path.parts):
            continue
        if path.suffix not in {".ts", ".tsx", ".js", ".mjs", ".json", ".md"}:
            continue
        text = path.read_text(encoding="utf-8")
        if re.search(r"\.(from|rpc)\s*\(", text):
            fail(f"direct Supabase domain access pattern found in {path.relative_to(ROOT)}")

secret_patterns = {
    "private key": r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
    "OpenAI key": r"\bsk-[A-Za-z0-9_-]{32,}\b",
    "live payment key": r"\bsk_live_[A-Za-z0-9]{16,}\b",
}
ignored_parts = {".git", "node_modules", ".venv", ".next", ".supabase"}
for path in ROOT.rglob("*"):
    if not path.is_file() or any(part in ignored_parts for part in path.parts):
        continue
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        continue
    for label, pattern in secret_patterns.items():
        if re.search(pattern, text):
            fail(f"possible {label} found in {path.relative_to(ROOT)}")

if errors:
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    raise SystemExit(1)

print("Repository boundaries and tracked-file secret patterns verified.")
