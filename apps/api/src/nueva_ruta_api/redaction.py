import re
from dataclasses import dataclass


@dataclass(frozen=True)
class RedactionResult:
    text: str
    types: tuple[str, ...]
    span_count: int


PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("SSN", re.compile(r"(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)")),
    (
        "ACCOUNT",
        re.compile(r"\b(?:cuenta|account)\s*(?:n[uú]mero|number|#)?\s*[:#-]?\s*\d{8,17}\b", re.I),
    ),
    ("CARD", re.compile(r"(?<!\d)(?:\d[ -]?){13,19}(?!\d)")),
    (
        "CREDENTIAL",
        re.compile(
            r"\b(?:contrase(?:ñ|n)a|password|pin|c[oó]digo\s+de\s+acceso)\s*[:=-]\s*\S+", re.I
        ),
    ),
)


def redact(text: str) -> RedactionResult:
    redacted = text
    found: list[str] = []
    count = 0
    for kind, pattern in PATTERNS:
        redacted, replacements = pattern.subn(f"[REDACTED_{kind}]", redacted)
        if replacements:
            found.append(kind.lower())
            count += replacements
    return RedactionResult(redacted, tuple(found), count)
