from __future__ import annotations

import hashlib
import json
import re
from datetime import time
from typing import Any, Literal, cast
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import yaml  # type: ignore[import-untyped]
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ClassificationTrigger(StrictModel):
    id: str = Field(pattern=r"^[a-z][a-z0-9_]+$")
    phrases: list[str] = Field(min_length=1)
    target_stage: str


class ClassificationPolicy(StrictModel):
    triggers: list[ClassificationTrigger] = Field(min_length=1)


class DebtPolicy(StrictModel):
    currency: Literal["USD"]
    minimum: int = Field(ge=0)
    maximum: int = Field(gt=0)
    supported_types: list[Literal["credit_card", "medical", "personal_loan"]] = Field(min_length=1)

    @model_validator(mode="after")
    def valid_range(self) -> DebtPolicy:
        if self.minimum >= self.maximum:
            raise ValueError("debt minimum must be below maximum")
        return self


class StateCoverage(StrictModel):
    included: list[Literal["CA", "FL", "TX"]] = Field(min_length=1)


class OperatingSchedule(StrictModel):
    timezone: str
    weekdays: list[
        Literal["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    ] = Field(min_length=1)
    opens_at: time
    closes_at: time

    @model_validator(mode="after")
    def valid_schedule(self) -> OperatingSchedule:
        try:
            ZoneInfo(self.timezone)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("unknown IANA timezone") from exc
        if self.opens_at >= self.closes_at:
            raise ValueError("opening time must precede closing time")
        return self


class EscalationPolicy(StrictModel):
    sla_minutes: int = Field(gt=0, le=1440)


class StalledWorkPolicy(StrictModel):
    approaching_ratio: float = Field(gt=0, lt=1)
    callback_approaching_minutes: int = Field(gt=0, le=1440)
    new_unclassified_minutes: int = Field(gt=0)
    human_review_pending_business_hours: int = Field(gt=0)
    prequalified_without_disposition_business_hours: int = Field(gt=0)
    info_sent_without_activity_hours: int = Field(gt=0)
    transferred_without_partner_confirmation_hours: int = Field(gt=0)
    reconciliation_conflict_unresolved_business_days: int = Field(gt=0)


class RetryPolicy(StrictModel):
    maximum_attempts: int = Field(ge=0, le=10)
    delays_minutes: list[int]

    @model_validator(mode="after")
    def valid_delays(self) -> RetryPolicy:
        if len(self.delays_minutes) != self.maximum_attempts:
            raise ValueError("retry delays must match maximum attempts")
        if any(delay <= 0 for delay in self.delays_minutes):
            raise ValueError("retry delays must be positive")
        return self


class AutomaticTemplate(StrictModel):
    purpose: str
    version: int = Field(gt=0)
    body: str = Field(min_length=1)


class FeatureFlags(StrictModel):
    automatic_messages_enabled: bool


class CompliancePolicy(StrictModel):
    required_partner_term: Literal["consejero"]
    disallowed_partner_terms: list[str]
    conditional_phrases: list[str] = Field(min_length=1)
    prohibited_phrases: list[str]
    allowed_automatic_purposes: list[str] = Field(min_length=1)


class RuleDocument(StrictModel):
    schema_version: Literal[1, 2]
    policy_id: str = Field(pattern=r"^[a-z][a-z0-9-]+$")
    classification: ClassificationPolicy
    debt_policy: DebtPolicy
    state_coverage: StateCoverage
    operating_schedule: OperatingSchedule
    escalation: EscalationPolicy
    stalled_work: StalledWorkPolicy | None = None
    retry_policy: RetryPolicy
    stage_transitions: dict[str, list[str]]
    automatic_templates: list[AutomaticTemplate]
    feature_flags: FeatureFlags
    compliance: CompliancePolicy

    @model_validator(mode="after")
    def valid_references(self) -> RuleDocument:
        if (self.schema_version == 2) != (self.stalled_work is not None):
            raise ValueError("schema version 2 requires stalled_work; version 1 must omit it")
        stages = set(self.stage_transitions)
        referenced = {target for targets in self.stage_transitions.values() for target in targets}
        trigger_targets = {trigger.target_stage for trigger in self.classification.triggers}
        if (referenced | trigger_targets) - stages:
            raise ValueError("stage transition contains an unknown stage")
        return self


class RuleIssue(StrictModel):
    code: str
    severity: Literal["error", "warning"]
    path: str
    message: str


class ComplianceViolation(StrictModel):
    code: str
    severity: Literal["blocking", "warning"]
    path: str
    message: str


class RuleValidation(StrictModel):
    valid: bool
    issues: list[RuleIssue]
    compliance: list[ComplianceViolation]


AUTOMATIC_PURPOSES = {"receipt_privacy", "after_hours", "opt_out_confirmation"}
BENEFIT_PATTERN = re.compile(r"\b(ahorr\w*|reduc\w*\s+(?:tu\s+)?pago)\b", re.IGNORECASE)
FIGURE_PATTERN = re.compile(
    r"(?:\b\d+(?:[.,]\d+)?\s*%|\$\s*\d+|\b\d+\s*(?:días|meses|años)\b)", re.IGNORECASE
)
PLACEHOLDER_PATTERN = re.compile(r"{{[^}]+}}|\{[^}]+\}")
GUARANTEE_PATTERN = re.compile(r"\bgaranti(?:za|zar|zado|zada|zamos|zarán|ía)\w*", re.IGNORECASE)


def canonical_content(document: RuleDocument) -> dict[str, Any]:
    return document.model_dump(mode="json", exclude_none=True)


def canonical_json(document: RuleDocument) -> str:
    return json.dumps(
        canonical_content(document), ensure_ascii=False, sort_keys=True, separators=(",", ":")
    )


def content_hash(document: RuleDocument) -> str:
    return hashlib.sha256(canonical_json(document).encode()).hexdigest()


def parse_yaml(source: str) -> RuleDocument:
    value = yaml.safe_load(source)
    if not isinstance(value, dict):
        raise ValueError("rule YAML must contain one mapping")
    return RuleDocument.model_validate(value)


def export_yaml(document: RuleDocument) -> str:
    return cast(
        str,
        yaml.safe_dump(
            canonical_content(document),
            allow_unicode=True,
            sort_keys=True,
            default_flow_style=False,
        ),
    )


def validation_issues(exc: ValidationError | ValueError) -> list[RuleIssue]:
    if isinstance(exc, ValidationError):
        return [
            RuleIssue(
                code=f"RULE_{str(error['type']).upper().replace('.', '_')}",
                severity="error",
                path=".".join(str(part) for part in error["loc"]) or "$",
                message=str(error["msg"]),
            )
            for error in exc.errors()
        ]
    return [RuleIssue(code="RULE_YAML_PARSE", severity="error", path="$", message=str(exc))]


def compliance_violations(document: RuleDocument) -> list[ComplianceViolation]:
    violations: list[ComplianceViolation] = []
    allowed = set(document.compliance.allowed_automatic_purposes)
    if allowed != AUTOMATIC_PURPOSES:
        violations.append(
            ComplianceViolation(
                code="AUTO_PURPOSE_ALLOWLIST",
                severity="blocking",
                path="compliance.allowed_automatic_purposes",
                message="Automatic purposes must exactly match the approved allowlist.",
            )
        )
    purposes = [template.purpose for template in document.automatic_templates]
    if set(purposes) != AUTOMATIC_PURPOSES or len(purposes) != len(AUTOMATIC_PURPOSES):
        violations.append(
            ComplianceViolation(
                code="AUTO_TEMPLATE_SET",
                severity="blocking",
                path="automatic_templates",
                message="Exactly one fixed template is required for each approved purpose.",
            )
        )
    for index, template in enumerate(document.automatic_templates):
        path = f"automatic_templates.{index}.body"
        body = template.body.casefold()
        if template.purpose not in AUTOMATIC_PURPOSES:
            violations.append(
                ComplianceViolation(
                    code="AUTO_PURPOSE_NOT_ALLOWED",
                    severity="blocking",
                    path=f"automatic_templates.{index}.purpose",
                    message="Automatic template purpose is not approved.",
                )
            )
        for term in document.compliance.disallowed_partner_terms:
            if re.search(rf"\b{re.escape(term.casefold())}\b", body):
                violations.append(
                    ComplianceViolation(
                        code="TERM_DISALLOWED_PARTNER",
                        severity="blocking",
                        path=path,
                        message="Use the approved partner term 'consejero'.",
                    )
                )
                break
        if GUARANTEE_PATTERN.search(body) or any(
            phrase.casefold() in body for phrase in document.compliance.prohibited_phrases
        ):
            violations.append(
                ComplianceViolation(
                    code="CLAIM_PROHIBITED",
                    severity="blocking",
                    path=path,
                    message="Template contains a prohibited promise or instruction.",
                )
            )
        if BENEFIT_PATTERN.search(body) and not any(
            phrase.casefold() in body for phrase in document.compliance.conditional_phrases
        ):
            violations.append(
                ComplianceViolation(
                    code="BENEFIT_UNCONDITIONAL",
                    severity="blocking",
                    path=path,
                    message="Savings and payment claims must be conditional.",
                )
            )
        if FIGURE_PATTERN.search(body):
            violations.append(
                ComplianceViolation(
                    code="FIGURE_UNSUPPORTED",
                    severity="blocking",
                    path=path,
                    message="Automatic templates cannot contain outcome figures.",
                )
            )
        if PLACEHOLDER_PATTERN.search(body):
            violations.append(
                ComplianceViolation(
                    code="AUTO_PERSONALIZATION",
                    severity="blocking",
                    path=path,
                    message="Automatic templates must be fixed and cannot contain placeholders.",
                )
            )
    return sorted(violations, key=lambda item: (item.path, item.code))


def validate_document(document: RuleDocument) -> RuleValidation:
    violations = compliance_violations(document)
    return RuleValidation(valid=not violations, issues=[], compliance=violations)


def normalized_diff(old: RuleDocument, new: RuleDocument) -> list[dict[str, Any]]:
    changes: list[dict[str, Any]] = []

    def walk(path: str, before: Any, after: Any) -> None:
        if isinstance(before, dict) and isinstance(after, dict):
            for key in sorted(set(before) | set(after)):
                child = f"{path}.{key}" if path else key
                if key not in before:
                    changes.append(
                        {"operation": "added", "path": child, "old": None, "new": after[key]}
                    )
                elif key not in after:
                    changes.append(
                        {"operation": "removed", "path": child, "old": before[key], "new": None}
                    )
                else:
                    walk(child, before[key], after[key])
        elif before != after:
            changes.append({"operation": "changed", "path": path, "old": before, "new": after})

    walk("", canonical_content(old), canonical_content(new))
    return changes
