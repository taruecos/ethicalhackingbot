"""Telegram finding reporter — pings configured chat when high-value findings appear.

Filters by severity (default: high+critical only). HTML-formatted (parse_mode=HTML).
Stub mode if TELEGRAM_BOT_TOKEN missing — logs message instead of sending.
"""

from __future__ import annotations

import asyncio
import html
import logging
from dataclasses import dataclass
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# Severity ordering — higher index = higher severity.
# Used for `min_severity` gating: a finding is reported iff its index >= min_severity index.
SEVERITY_ORDER: dict[str, int] = {
    "info": 0,
    "low": 1,
    "medium": 2,
    "high": 3,
    "critical": 4,
}

SEVERITY_EMOJI: dict[str, str] = {
    "critical": "🔴",
    "high": "🟠",
    "medium": "🟡",
    "low": "🟢",
    "info": "⚪",
}

TELEGRAM_API_URL = "https://api.telegram.org/bot{token}/sendMessage"
MAX_DESCRIPTION_CHARS = 500
REQUEST_TIMEOUT_SECONDS = 10.0


@dataclass
class ReportResult:
    """Outcome of a report attempt.

    - sent: True iff Telegram acknowledged delivery.
    - stubbed: True iff stub mode (no token / no chat_id) was active.
    - gated: True iff the finding was dropped because severity < min_severity.
    - message_id: Telegram-returned message id on success.
    - error: short error description on failure.
    """

    sent: bool = False
    stubbed: bool = False
    gated: bool = False
    message_id: int | None = None
    error: str | None = None


def _normalize_severity(severity: str | None) -> str:
    if not severity:
        return "info"
    return severity.strip().lower()


def _severity_rank(severity: str | None) -> int:
    return SEVERITY_ORDER.get(_normalize_severity(severity), -1)


class TelegramReporter:
    """Posts high-value findings to a Telegram chat.

    If `token` or `chat_id` is falsy, all sends become stub log entries
    (so the scanner stays runnable in dev without Telegram credentials).
    """

    def __init__(
        self,
        token: str | None,
        chat_id: str | None,
        min_severity: str = "high",
    ) -> None:
        self.token = token or None
        self.chat_id = chat_id or None
        self.min_severity = _normalize_severity(min_severity)
        if self.min_severity not in SEVERITY_ORDER:
            raise ValueError(
                f"invalid min_severity {min_severity!r}; "
                f"expected one of {list(SEVERITY_ORDER)}"
            )

    # ─── public API ────────────────────────────────────────────────────────

    @property
    def is_stub(self) -> bool:
        """True iff this reporter will not actually hit Telegram."""
        return not (self.token and self.chat_id)

    def should_report(self, severity: str | None) -> bool:
        """True iff a finding at `severity` clears the `min_severity` gate."""
        min_rank = SEVERITY_ORDER[self.min_severity]
        return _severity_rank(severity) >= min_rank

    async def report_finding(
        self, finding: dict[str, Any], scan: dict[str, Any]
    ) -> ReportResult:
        """Format and dispatch a finding alert.

        Returns `ReportResult(gated=True)` if the finding's severity is below
        `min_severity`. Returns `ReportResult(stubbed=True)` in stub mode.
        """
        severity = _normalize_severity(finding.get("severity"))
        if not self.should_report(severity):
            return ReportResult(gated=True)

        message = self._format_finding(finding, scan, severity)
        return await self._send(message)

    async def report_scan_complete(
        self, scan: dict[str, Any], findings_summary: dict[str, Any]
    ) -> ReportResult:
        """Send a digest message when a scan finishes."""
        message = self._format_summary(scan, findings_summary)
        return await self._send(message)

    # ─── formatting (HTML parse_mode) ──────────────────────────────────────

    def _format_finding(
        self,
        finding: dict[str, Any],
        scan: dict[str, Any],
        severity: str,
    ) -> str:
        emoji = SEVERITY_EMOJI.get(severity, "⚪")
        module = html.escape(str(finding.get("module") or "unknown"))
        title = html.escape(str(finding.get("title") or "Untitled"))
        target = html.escape(str(scan.get("target") or "unknown"))
        scan_id = html.escape(str(scan.get("id") or "unknown"))

        description_raw = str(finding.get("description") or "")
        if len(description_raw) > MAX_DESCRIPTION_CHARS:
            description_raw = description_raw[:MAX_DESCRIPTION_CHARS].rstrip() + "…"
        description = html.escape(description_raw)

        lines: list[str] = [
            f"🚨 <b>{emoji} {severity.upper()}</b> — {module}",
            "",
            f"<b>{title}</b>",
            "",
            f"Target: <code>{target}</code>",
        ]

        url = finding.get("url")
        if url:
            lines.append(f"URL: <code>{html.escape(str(url))}</code>")

        cvss_score = finding.get("cvss_score")
        if cvss_score is not None:
            cvss_vector = finding.get("cvss_vector") or ""
            score_str = html.escape(str(cvss_score))
            if cvss_vector:
                lines.append(
                    f"CVSS: {score_str} ({html.escape(str(cvss_vector))})"
                )
            else:
                lines.append(f"CVSS: {score_str}")

        if description:
            lines.append("")
            lines.append(description)

        lines.append("")
        lines.append(f"Scan: <code>{scan_id}</code>")
        return "\n".join(lines)

    def _format_summary(
        self, scan: dict[str, Any], summary: dict[str, Any]
    ) -> str:
        target = html.escape(str(scan.get("target") or "unknown"))
        scan_id = html.escape(str(scan.get("id") or "unknown"))
        total = int(summary.get("total", 0) or 0)

        lines: list[str] = [
            f"✅ <b>Scan complete</b> — <code>{target}</code>",
            "",
            f"Total findings: <b>{total}</b>",
        ]
        for sev in ("critical", "high", "medium", "low", "info"):
            count = int(summary.get(sev, 0) or 0)
            if count:
                emoji = SEVERITY_EMOJI.get(sev, "⚪")
                lines.append(f"{emoji} {sev.capitalize()}: <b>{count}</b>")

        lines.append("")
        lines.append(f"Scan: <code>{scan_id}</code>")
        return "\n".join(lines)

    # ─── transport ─────────────────────────────────────────────────────────

    async def _send(self, message: str) -> ReportResult:
        if self.is_stub:
            logger.info("[STUB-TELEGRAM] would send: %s", message)
            return ReportResult(sent=False, stubbed=True)

        url = TELEGRAM_API_URL.format(token=self.token)
        payload = {
            "chat_id": self.chat_id,
            "text": message,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }

        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
                response = await self._post_with_retry(client, url, payload)
        except httpx.HTTPError as exc:
            logger.warning("telegram send failed: %s", exc)
            return ReportResult(sent=False, error=str(exc))

        if response.status_code >= 400:
            logger.warning(
                "telegram returned %s: %s", response.status_code, response.text[:200]
            )
            return ReportResult(
                sent=False,
                error=f"http_{response.status_code}",
            )

        try:
            body = response.json()
        except ValueError:
            return ReportResult(sent=False, error="invalid_json_response")

        if not body.get("ok"):
            return ReportResult(
                sent=False, error=str(body.get("description") or "telegram_not_ok")
            )

        result = body.get("result") or {}
        message_id = result.get("message_id")
        return ReportResult(
            sent=True,
            message_id=int(message_id) if isinstance(message_id, int) else None,
        )

    @staticmethod
    async def _post_with_retry(
        client: httpx.AsyncClient,
        url: str,
        payload: dict[str, Any],
    ) -> httpx.Response:
        """POST once; retry exactly once on 5xx with a short backoff."""
        response = await client.post(url, json=payload)
        if 500 <= response.status_code < 600:
            await asyncio.sleep(0.5)
            response = await client.post(url, json=payload)
        return response
