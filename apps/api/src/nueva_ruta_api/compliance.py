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
SCRIPT_BENEFIT_PATTERN = re.compile(r"\b(?:ahorr\w*|reduc\w*\s+(?:tu\s+)?pago)\b", re.I)
SCRIPT_CONDITIONAL_PATTERN = re.compile(
    r"\b(?:podr[ií]a|en algunos casos|dependiendo de la situaci[oó]n y de los acreedores)\b",
    re.I,
)
SCRIPT_OUTCOME_FIGURE_PATTERN = re.compile(
    r"\b(?:\d+(?:[.,]\d+)?|uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|"
    r"nueve|diez|varios|varias)\s*(?:d[ií]as|semanas|meses|a[nñ]os)\b",
    re.I,
)
SCRIPT_INDIVIDUAL_ADVICE_PATTERN = re.compile(
    r"\b(?:te recomiendo|debes elegir|tu mejor opci[oó]n|te conviene demandar|"
    r"decl[aá]rate en bancarrota|decl[aá]rate en quiebra)\b",
    re.I,
)
SCRIPT_TESTIMONIAL_PATTERN = re.compile(
    r"\b(?:testimonio real|historia real|a m[ií] me funcion[oó]|cliente real)\b", re.I
)


def review_content(content: str) -> ContentReview:
    codes = tuple(code for code, pattern in PROHIBITED if pattern.search(content))
    checksum = hashlib.sha256(content.encode()).hexdigest()
    return ContentReview(not codes, codes, checksum)


def review_script_content(content: str) -> ContentReview:
    """Apply deterministic marketing controls to a human-reviewed script version."""
    codes = set(review_content(content).codes)
    if SCRIPT_BENEFIT_PATTERN.search(content) and not SCRIPT_CONDITIONAL_PATTERN.search(content):
        codes.add("BENEFIT_UNCONDITIONAL")
    if SCRIPT_OUTCOME_FIGURE_PATTERN.search(content):
        codes.add("UNSUPPORTED_TIMELINE")
    if SCRIPT_INDIVIDUAL_ADVICE_PATTERN.search(content):
        codes.add("INDIVIDUALIZED_ADVICE")
    if SCRIPT_TESTIMONIAL_PATTERN.search(content) and not re.search(
        r"\b(?:fictici[oa]|inventad[oa])\b", content, re.I
    ):
        codes.add("TESTIMONIAL_MISREPRESENTED")
    ordered = tuple(sorted(codes))
    checksum = hashlib.sha256(content.encode()).hexdigest()
    return ContentReview(not ordered, ordered, checksum)
