import hashlib
import re
from dataclasses import dataclass


@dataclass(frozen=True)
class ContentReview:
    valid: bool
    codes: tuple[str, ...]
    checksum: str


PROHIBITED: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("CLAIM_GUARANTEE", re.compile(r"\b(?:garantizamos|garantía|garantizado)\b", re.I)),
    ("STOP_PAYMENT", re.compile(r"\bdeja de pagar\b", re.I)),
    ("AVOID_CREDITOR", re.compile(r"\bno hables con (?:tu|tus) acreedores\b", re.I)),
    ("DEBT_DISAPPEARS", re.compile(r"\b(?:tu )?deuda desaparecerá\b", re.I)),
    ("TERM_NOT_APPROVED", re.compile(r"\b(?:asesor|consultor|especialista)\b", re.I)),
    ("UNSUPPORTED_FIGURE", re.compile(r"(?:\b\d+(?:[.,]\d+)?\s*%|\$\s*\d+)")),
)


def review_content(content: str) -> ContentReview:
    codes = tuple(code for code, pattern in PROHIBITED if pattern.search(content))
    checksum = hashlib.sha256(content.encode()).hexdigest()
    return ContentReview(not codes, codes, checksum)

