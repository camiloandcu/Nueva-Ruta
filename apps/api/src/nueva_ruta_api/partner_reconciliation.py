"""Deterministic, evidence-preserving normalization and partner reconciliation."""

import csv
import hashlib
import io
import json
import re
from datetime import UTC, date, datetime
from typing import Any

NORMALIZATION_VERSION = "wi006-v1"
MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_ROWS = 5000
REQUIRED_FIELDS = {"partner_enrollment_id"}
FIELD_ALIASES = {
    "partner_enrollment_id": {"partner_enrollment_id", "enrollment_id"},
    "partner_case_id": {"partner_case_id", "case_id"},
    "enrollment_date_raw": {"enrollment_date_raw", "enrollment_date"},
    "phone_raw": {"phone_raw", "phone"},
    "creator_id_raw": {"creator_id_raw", "creator_id"},
    "status_raw": {"status_raw", "status"},
}
KNOWN_CREATORS = {f"CR-{number:03d}" for number in range(1, 6)}


class CsvImportError(ValueError):
    """CSV is invalid or outside the synthetic-import contract."""


def parse_partner_csv(content: bytes) -> tuple[list[dict[str, str]], str]:
    if len(content) > MAX_FILE_BYTES:
        raise CsvImportError("CSV exceeds the 5 MiB upload limit")
    try:
        decoded = content.decode("utf-8-sig", errors="strict")
    except UnicodeDecodeError as exc:
        raise CsvImportError("CSV must use UTF-8 encoding") from exc
    reader = csv.DictReader(io.StringIO(decoded, newline=""))
    if not reader.fieldnames or len(reader.fieldnames) > 32:
        raise CsvImportError("CSV must contain between 1 and 32 column headers")
    headers = [header.strip() for header in reader.fieldnames]
    if len({header.casefold() for header in headers}) != len(headers):
        raise CsvImportError("CSV contains duplicate column headers")
    recognized = [header.casefold() for header in headers]
    allowed = set().union(*FIELD_ALIASES.values())
    unknown = sorted(set(recognized) - allowed)
    if unknown:
        raise CsvImportError(f"CSV contains unsupported columns: {', '.join(unknown)}")
    if (
        len([header for header in recognized if header in FIELD_ALIASES["partner_enrollment_id"]])
        > 1
    ):
        raise CsvImportError("CSV must use only one partner enrollment ID column")
    canonical = {
        field
        for field, aliases in FIELD_ALIASES.items()
        if any(header.strip().casefold() in aliases for header in headers)
    }
    if not REQUIRED_FIELDS.issubset(canonical):
        raise CsvImportError("CSV requires partner_enrollment_id or enrollment_id")
    rows: list[dict[str, str]] = []
    for number, row in enumerate(reader, start=2):
        if number > MAX_ROWS + 1:
            raise CsvImportError(f"CSV exceeds the {MAX_ROWS}-row limit")
        if None in row:
            raise CsvImportError(f"Row {number} has more values than the header")
        values = {str(key): (value or "") for key, value in row.items()}
        if not any(values.values()):
            raise CsvImportError(f"Row {number} is blank")
        rows.append(values)
    if not rows:
        raise CsvImportError("CSV must contain at least one data row")
    return rows, hashlib.sha256(content).hexdigest()


def canonical_values(source: dict[str, Any]) -> dict[str, str]:
    mapped: dict[str, str] = {}
    for field, aliases in FIELD_ALIASES.items():
        matches = [
            str(value or "").strip()
            for key, value in source.items()
            if str(key).strip().casefold() in aliases
        ]
        mapped[field] = matches[0] if matches else ""
    return mapped


def normalize_phone(raw: str) -> str | None:
    digits = re.sub(r"\D", "", raw)
    explicit_country_code = raw.strip().startswith("+")
    if explicit_country_code and not digits.startswith("1"):
        return None
    # Demo phones deliberately use the reserved-looking fictional 555-01xx form.
    if len(digits) == 7 and digits.startswith("55501"):
        return f"+1{digits}"
    if len(digits) == 8 and digits.startswith("155501"):
        return f"+{digits}"
    if len(digits) == 10:
        return f"+1{digits}"
    if len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"
    return None


def parse_date(raw: str) -> tuple[date | None, bool]:
    value = raw.strip()
    if not value:
        return None, False
    try:
        parsed = date.fromisoformat(value)
        return parsed, False
    except ValueError:
        pass
    for pattern in ("%m/%d/%Y", "%m-%d-%Y", "%m/%d/%y"):
        try:
            parsed = datetime.strptime(value, pattern).date()
        except ValueError:
            continue
        parts = re.split(r"[/\-]", value)
        if int(parts[0]) <= 12 and int(parts[1]) <= 12 and int(parts[0]) != int(parts[1]):
            return None, True
        return parsed, False
    return None, False


def _field(source: dict[str, Any], field: str) -> str:
    return canonical_values(source)[field]


def build_analysis(
    raw_rows: list[dict[str, Any]],
    leads: list[dict[str, Any]],
    transfers: list[dict[str, Any]],
    imported_at: datetime,
) -> dict[str, list[dict[str, Any]]]:
    """Build deterministic normalized rows, duplicate groups and reconciliation cases."""
    if imported_at.tzinfo is None:
        raise ValueError("imported_at must include a timezone")
    reference_date = imported_at.astimezone(UTC).date()
    transfers_by_request: dict[str, list[str]] = {}
    for transfer in transfers:
        if transfer.get("status") and transfer.get("status") != "accepted":
            continue
        request_id = str(transfer.get("partner_request_id") or "").strip()
        lead_id = str(transfer.get("baseline_lead_id") or "").strip()
        if request_id and lead_id:
            transfers_by_request.setdefault(request_id, []).append(lead_id)
    lead_by_id = {str(lead["id"]): lead for lead in leads}
    leads_by_phone: dict[str, list[dict[str, Any]]] = {}
    for lead in leads:
        lead_phone = normalize_phone(str(lead.get("fictional_phone") or ""))
        if lead_phone:
            leads_by_phone.setdefault(lead_phone, []).append(lead)

    normalized_rows: list[dict[str, Any]] = []
    by_external_id: dict[str, list[dict[str, Any]]] = {}
    by_checksum: dict[str, list[dict[str, Any]]] = {}
    for row in raw_rows:
        source = row["source_values"]
        values = canonical_values(source)
        issues: list[str] = []
        phone = normalize_phone(values["phone_raw"])
        if values["phone_raw"] and phone is None:
            issues.append("invalid_phone")
        if not values["phone_raw"]:
            issues.append("missing_phone")
        enrollment_date, ambiguous = parse_date(values["enrollment_date_raw"])
        if not values["enrollment_date_raw"]:
            issues.append("missing_date")
        elif ambiguous:
            issues.append("ambiguous_date")
        elif enrollment_date is None:
            issues.append("invalid_date")
        elif enrollment_date > reference_date:
            issues.append("future_date")
        creator = values["creator_id_raw"].strip().upper() or None
        if creator is None:
            issues.append("missing_creator")
        elif creator not in KNOWN_CREATORS:
            issues.append("unknown_creator")
        status_value = values["status_raw"].strip().casefold() or None
        if status_value is None:
            issues.append("missing_status")
        elif status_value not in {"enrolled", "reported", "active", "synthetic_reported"}:
            issues.append("unknown_status")
        for tag in row.get("defect_tags", []):
            if tag in {
                "ambiguous_link",
                "conflicting_id",
                "contradictory_creator",
                "date_quality",
                "missing_creator",
                "phone_mismatch",
                "repeated_enrollment",
                "unmatched_phone",
                "unknown_creator",
            }:
                issues.append(tag)
        row_number = int(row["row_number"])
        normalized_record = {
            "row_number": row_number,
            "normalization_version": NORMALIZATION_VERSION,
            "partner_enrollment_id": values["partner_enrollment_id"] or None,
            "partner_case_id": values["partner_case_id"] or None,
            "enrollment_date": enrollment_date.isoformat() if enrollment_date else None,
            "phone": phone,
            "creator_id": creator,
            "status": status_value,
            "quality_issues": sorted(set(issues)),
            "source_checksum": row["row_checksum"],
        }
        normalized_rows.append(normalized_record)
        by_checksum.setdefault(str(row["row_checksum"]), []).append(normalized_record)
        if normalized_record["partner_enrollment_id"]:
            by_external_id.setdefault(normalized_record["partner_enrollment_id"], []).append(
                normalized_record
            )

    groups: list[dict[str, Any]] = []
    grouped_rows: set[int] = set()
    for kind, groups_by_key in (
        ("exact_duplicate", by_checksum),
        ("conflicting_id", by_external_id),
    ):
        for key in sorted(groups_by_key):
            member_records = groups_by_key[key]
            if len(member_records) < 2:
                continue
            if kind == "conflicting_id" and all(
                member["row_number"] in grouped_rows for member in member_records
            ):
                continue
            row_numbers = sorted(member["row_number"] for member in member_records)
            groups.append({"group_type": kind, "group_key": key, "row_numbers": row_numbers})
            grouped_rows.update(row_numbers)

    canonical_rows: list[dict[str, Any]] = []
    canonical_sources: dict[str, list[dict[str, Any]]] = {}
    exact_keys = {
        tuple(group["row_numbers"]) for group in groups if group["group_type"] == "exact_duplicate"
    }
    conflict_keys = {
        tuple(group["row_numbers"]) for group in groups if group["group_type"] == "conflicting_id"
    }
    handled: set[int] = set()
    for row in normalized_rows:
        number = row["row_number"]
        conflict_group = next((key for key in conflict_keys if number in key), None)
        exact_group = next((key for key in exact_keys if number in key), None)
        source_row_numbers = conflict_group or exact_group or (number,)
        if number in handled:
            continue
        handled.update(source_row_numbers)
        key = f"rows:{','.join(map(str, source_row_numbers))}"
        conflicted = bool(conflict_group)
        source_rows = [item for item in raw_rows if int(item["row_number"]) in source_row_numbers]
        chosen = min(source_rows, key=lambda item: int(item["row_number"]))
        canonical = {
            "canonical_key": key,
            "partner_enrollment_id": None if conflicted else row["partner_enrollment_id"],
            "source_row_numbers": list(source_row_numbers),
            "canonical_values": {} if conflicted else chosen["source_values"],
            "conflicted": conflicted,
            "quality_issues": sorted(
                {
                    issue
                    for item in normalized_rows
                    if item["row_number"] in source_row_numbers
                    for issue in item["quality_issues"]
                }
            ),
        }
        canonical_rows.append(canonical)
        canonical_sources[key] = [
            item for item in normalized_rows if item["row_number"] in source_row_numbers
        ]

    cases: list[dict[str, Any]] = []
    for canonical in canonical_rows:
        key = canonical["canonical_key"]
        sources = canonical_sources[key]
        if canonical["conflicted"]:
            cases.append(
                {
                    "canonical_key": key,
                    "status": "review_required",
                    "match_method": None,
                    "lead_id": None,
                    "candidate_lead_ids": [],
                    "conflict_flags": ["conflicting_partner_id"],
                    "evidence": {"source_row_numbers": canonical["source_row_numbers"]},
                    "potentially_commissionable": False,
                }
            )
            continue
        row = sources[0]
        source = next(
            item["source_values"]
            for item in raw_rows
            if int(item["row_number"]) == row["row_number"]
        )
        values = canonical_values(source)
        case_id = values["partner_case_id"]
        exact_candidates = sorted(set(transfers_by_request.get(case_id or "", [])))
        method = "exact_external_id" if len(exact_candidates) == 1 else None
        candidate_method = "exact_external_id" if exact_candidates else None
        candidate_ids = exact_candidates
        if not candidate_ids and row["phone"]:
            candidate_ids = sorted(
                {str(item["id"]) for item in leads_by_phone.get(row["phone"], [])}
            )
            method = "exact_phone" if len(candidate_ids) == 1 else None
            candidate_method = "exact_phone" if candidate_ids else None
        candidate = lead_by_id.get(candidate_ids[0]) if len(candidate_ids) == 1 else None
        conflicts: list[str] = []
        if len(candidate_ids) > 1:
            conflicts.append("ambiguous_candidates")
        if (
            candidate
            and row["creator_id"]
            and row["creator_id"] != candidate.get("creator_business_id")
        ):
            conflicts.append("creator_contradiction")
        if candidate and row["enrollment_date"]:
            received = str(candidate.get("received_at") or "")[:10]
            if received and row["enrollment_date"] < received:
                conflicts.append("enrollment_before_lead")
        if canonical["quality_issues"]:
            conflicts.extend(canonical["quality_issues"])
        status = (
            "matched"
            if candidate and not conflicts
            else "review_required"
            if candidate_ids or conflicts
            else "unmatched"
        )
        safe = status == "matched" and not canonical["quality_issues"] and not conflicts
        cases.append(
            {
                "canonical_key": key,
                "status": status,
                "match_method": method,
                "candidate_method": candidate_method,
                "lead_id": str(candidate["id"]) if candidate and status == "matched" else None,
                "candidate_lead_ids": candidate_ids,
                "conflict_flags": sorted(set(conflicts)),
                "evidence": {
                    "source_row_numbers": canonical["source_row_numbers"],
                    "candidate_lead_ids": candidate_ids,
                    "match_method": method,
                    "normalization_version": NORMALIZATION_VERSION,
                },
                "potentially_commissionable": safe,
            }
        )
    return {
        "normalized_rows": normalized_rows,
        "duplicate_groups": groups,
        "canonical_rows": canonical_rows,
        "reconciliation_cases": cases,
    }


def canonical_json_checksum(values: dict[str, str]) -> str:
    return hashlib.sha256(
        json.dumps(values, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
