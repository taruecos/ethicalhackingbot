"""Intigriti submission client — submits confirmed findings to Intigriti.

Stubbed if INTIGRITI_API_TOKEN is missing or equal to "stub-mode".
Real-shaped: payload, dedup (hash), retry, logging match production API.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
from dataclasses import dataclass
from typing import Any

import httpx

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://api.intigriti.com/external/researcher/v1"
STUB_TOKEN_SENTINEL = "stub-mode"

# Map our internal severity codes to Intigriti's severity enum.
# `info` is intentionally None — informational findings are not submitted.
SEVERITY_MAP: dict[str, str | None] = {
    "critical": "Critical",
    "high": "High",
    "medium": "Medium",
    "low": "Low",
    "info": None,
}

# Map our scanner module names to Intigriti vulnerability type labels.
TYPE_MAP: dict[str, str] = {
    "idor": "Insecure Direct Object Reference",
    "xss": "Cross-Site Scripting",
    "sqli": "SQL Injection",
    "ssrf": "Server-Side Request Forgery",
    "csrf": "Cross-Site Request Forgery",
    "access_control": "Broken Access Control",
    "info_disclosure": "Information Disclosure",
    "differential": "Authorization Flaw",
}

MAX_RETRIES = 3
INITIAL_BACKOFF_SECONDS = 1.0


@dataclass
class SubmissionResult:
    """Outcome of a single submission attempt."""

    submission_id: str | None
    status: str
    deduped: bool
    stubbed: bool


class IntigritiSubmitter:
    """Submit findings to Intigriti's researcher API.

    When `token` is missing/falsy or equals "stub-mode", operates in stub
    mode: logs intent and returns a deterministic fake submission id without
    making any HTTP call. Otherwise issues a real POST with Bearer auth,
    retrying transient 5xx failures with exponential backoff.
    """

    def __init__(
        self,
        token: str | None,
        base_url: str = DEFAULT_BASE_URL,
    ) -> None:
        self.token = token
        self.base_url = base_url.rstrip("/")
        # Process-local dedup cache: program_id|hash -> submission_id.
        # Lets us short-circuit when the same finding is resubmitted within
        # a process lifetime. Persistent dedup is the caller's job (Prisma).
        self._dedup_cache: dict[str, str] = {}

    @property
    def is_stub(self) -> bool:
        return not self.token or self.token == STUB_TOKEN_SENTINEL

    @staticmethod
    def compute_dedup_hash(finding: dict[str, Any], program_id: str) -> str:
        """SHA256 of program_id|module|title|url|cwe_id.

        Used as the canonical fingerprint for a finding+program pair so
        we never resubmit the same issue twice.
        """
        module = str(finding.get("module") or "")
        title = str(finding.get("title") or "")
        url = str(finding.get("url") or "")
        cwe_id = str(finding.get("cwe_id") or "")
        material = f"{program_id}|{module}|{title}|{url}|{cwe_id}"
        return hashlib.sha256(material.encode("utf-8")).hexdigest()

    def _map_severity(self, severity: str | None) -> str | None:
        if severity is None:
            return None
        return SEVERITY_MAP.get(severity.lower())

    def _map_type(self, module: str | None) -> str:
        if module is None:
            return "Other"
        return TYPE_MAP.get(module.lower(), "Other")

    def _build_payload(
        self,
        finding: dict[str, Any],
        program_id: str,
        severity_label: str,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "programId": program_id,
            "title": finding.get("title", ""),
            "description": finding.get("description", ""),
            "severity": severity_label,
            "type": self._map_type(finding.get("module")),
        }
        if finding.get("url"):
            payload["endpoint"] = finding["url"]
        if finding.get("evidence"):
            payload["evidence"] = finding["evidence"]
        if finding.get("cvss_vector"):
            payload["cvssVector"] = finding["cvss_vector"]
        if finding.get("cwe_id"):
            payload["cweId"] = finding["cwe_id"]
        return payload

    async def submit(
        self,
        finding: dict[str, Any],
        program_id: str,
    ) -> SubmissionResult:
        """Submit a single finding to a program. Skips info-severity findings."""

        dedup_hash = self.compute_dedup_hash(finding, program_id)

        severity_label = self._map_severity(finding.get("severity"))
        if severity_label is None:
            logger.info(
                "Skipping info-severity finding %s for program %s",
                finding.get("title"),
                program_id,
            )
            return SubmissionResult(
                submission_id=None,
                status="rejected_info_severity",
                deduped=False,
                stubbed=self.is_stub,
            )

        if dedup_hash in self._dedup_cache:
            return SubmissionResult(
                submission_id=self._dedup_cache[dedup_hash],
                status="deduped",
                deduped=True,
                stubbed=self.is_stub,
            )

        if self.is_stub:
            stub_id = f"stub-{dedup_hash[:12]}"
            logger.info(
                "[STUB] would submit %s to %s",
                finding.get("title"),
                program_id,
            )
            self._dedup_cache[dedup_hash] = stub_id
            return SubmissionResult(
                submission_id=stub_id,
                status="stubbed",
                deduped=False,
                stubbed=True,
            )

        payload = self._build_payload(finding, program_id, severity_label)
        submission_id = await self._post_with_retry(payload)
        self._dedup_cache[dedup_hash] = submission_id
        return SubmissionResult(
            submission_id=submission_id,
            status="submitted",
            deduped=False,
            stubbed=False,
        )

    async def _post_with_retry(self, payload: dict[str, Any]) -> str:
        """POST /submissions with retry-on-5xx, raise-on-4xx."""

        url = f"{self.base_url}/submissions"
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

        backoff = INITIAL_BACKOFF_SECONDS
        last_exc: Exception | None = None

        async with httpx.AsyncClient(timeout=30.0) as client:
            for attempt in range(1, MAX_RETRIES + 1):
                try:
                    resp = await client.post(url, json=payload, headers=headers)
                except httpx.HTTPError as exc:
                    last_exc = exc
                    logger.warning(
                        "Intigriti submit transport error (attempt %d/%d): %s",
                        attempt,
                        MAX_RETRIES,
                        exc,
                    )
                    if attempt == MAX_RETRIES:
                        raise
                    await asyncio.sleep(backoff)
                    backoff *= 2
                    continue

                if 500 <= resp.status_code < 600:
                    logger.warning(
                        "Intigriti submit 5xx (attempt %d/%d): %d %s",
                        attempt,
                        MAX_RETRIES,
                        resp.status_code,
                        resp.text[:200],
                    )
                    if attempt == MAX_RETRIES:
                        resp.raise_for_status()
                    await asyncio.sleep(backoff)
                    backoff *= 2
                    continue

                if 400 <= resp.status_code < 500:
                    logger.error(
                        "Intigriti submit 4xx: %d %s",
                        resp.status_code,
                        resp.text[:500],
                    )
                    resp.raise_for_status()

                data = resp.json()
                submission_id = (
                    data.get("id")
                    or data.get("submissionId")
                    or data.get("submission_id")
                    or ""
                )
                if not submission_id:
                    raise ValueError(
                        f"Intigriti response missing submission id: {data}"
                    )
                return str(submission_id)

        # Defensive: loop should always return or raise above.
        if last_exc:
            raise last_exc
        raise RuntimeError("Intigriti submit exhausted retries")
