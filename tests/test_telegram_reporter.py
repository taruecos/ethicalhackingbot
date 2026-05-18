"""Tests for TelegramReporter.

Covers:
- Stub mode (no token / no chat_id) — no HTTP, returns stubbed=True
- Severity gating below min_severity returns gated=True
- HTML escaping of user-provided fields
- Severity emoji + ordering
"""

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

from src.reporter.telegram_reporter import (
    SEVERITY_EMOJI,
    SEVERITY_ORDER,
    ReportResult,
    TelegramReporter,
)


# ─── fixtures ──────────────────────────────────────────────────────────────


def _make_finding(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "title": "SQL Injection in /api/users",
        "severity": "high",
        "module": "sqli",
        "url": "https://target.example/api/users?id=1",
        "description": "Boolean-based blind SQLi detected via id param.",
        "cvss_score": 8.6,
        "cvss_vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
        "evidence": {"payload": "1' OR 1=1--"},
    }
    base.update(overrides)
    return base


def _make_scan(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {"id": "scan_abc123", "target": "target.example"}
    base.update(overrides)
    return base


# ─── stub mode ─────────────────────────────────────────────────────────────


def test_stub_mode_when_no_token() -> None:
    reporter = TelegramReporter(token=None, chat_id="12345", min_severity="info")
    assert reporter.is_stub is True


def test_stub_mode_when_no_chat_id() -> None:
    reporter = TelegramReporter(token="bot:abc", chat_id=None, min_severity="info")
    assert reporter.is_stub is True


def test_stub_mode_when_empty_strings() -> None:
    reporter = TelegramReporter(token="", chat_id="", min_severity="info")
    assert reporter.is_stub is True


@pytest.mark.asyncio
async def test_stub_mode_returns_stubbed_and_no_http_call() -> None:
    reporter = TelegramReporter(token=None, chat_id=None, min_severity="info")
    with patch("src.reporter.telegram_reporter.httpx.AsyncClient") as client_cls:
        result = await reporter.report_finding(_make_finding(), _make_scan())
    assert isinstance(result, ReportResult)
    assert result.stubbed is True
    assert result.sent is False
    client_cls.assert_not_called()


@pytest.mark.asyncio
async def test_scan_complete_stub_mode() -> None:
    reporter = TelegramReporter(token=None, chat_id=None)
    summary = {"critical": 1, "high": 2, "medium": 0, "low": 0, "info": 0, "total": 3}
    with patch("src.reporter.telegram_reporter.httpx.AsyncClient") as client_cls:
        result = await reporter.report_scan_complete(_make_scan(), summary)
    assert result.stubbed is True
    assert result.sent is False
    client_cls.assert_not_called()


# ─── severity gating ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_medium_finding_is_gated_when_min_high() -> None:
    reporter = TelegramReporter(token=None, chat_id=None, min_severity="high")
    finding = _make_finding(severity="medium")
    result = await reporter.report_finding(finding, _make_scan())
    assert result.gated is True
    assert result.sent is False
    assert result.stubbed is False


@pytest.mark.asyncio
async def test_low_finding_is_gated_when_min_high() -> None:
    reporter = TelegramReporter(token=None, chat_id=None, min_severity="high")
    result = await reporter.report_finding(
        _make_finding(severity="low"), _make_scan()
    )
    assert result.gated is True


@pytest.mark.asyncio
async def test_high_finding_passes_gate_when_min_high() -> None:
    reporter = TelegramReporter(token=None, chat_id=None, min_severity="high")
    result = await reporter.report_finding(
        _make_finding(severity="high"), _make_scan()
    )
    # Not gated, falls into stub mode (no token).
    assert result.gated is False
    assert result.stubbed is True


@pytest.mark.asyncio
async def test_critical_finding_passes_gate_when_min_high() -> None:
    reporter = TelegramReporter(token=None, chat_id=None, min_severity="high")
    result = await reporter.report_finding(
        _make_finding(severity="critical"), _make_scan()
    )
    assert result.gated is False


def test_should_report_uses_min_severity() -> None:
    reporter = TelegramReporter(token=None, chat_id=None, min_severity="medium")
    assert reporter.should_report("critical") is True
    assert reporter.should_report("high") is True
    assert reporter.should_report("medium") is True
    assert reporter.should_report("low") is False
    assert reporter.should_report("info") is False
    assert reporter.should_report(None) is False
    assert reporter.should_report("bogus") is False


def test_invalid_min_severity_raises() -> None:
    with pytest.raises(ValueError):
        TelegramReporter(token=None, chat_id=None, min_severity="urgent")


# ─── severity ordering ─────────────────────────────────────────────────────


def test_severity_order_is_correct() -> None:
    assert (
        SEVERITY_ORDER["critical"]
        > SEVERITY_ORDER["high"]
        > SEVERITY_ORDER["medium"]
        > SEVERITY_ORDER["low"]
        > SEVERITY_ORDER["info"]
    )


def test_severity_emoji_coverage() -> None:
    for sev in ("critical", "high", "medium", "low", "info"):
        assert sev in SEVERITY_EMOJI
    assert SEVERITY_EMOJI["critical"] == "🔴"
    assert SEVERITY_EMOJI["high"] == "🟠"


# ─── HTML escaping & message format ────────────────────────────────────────


def test_html_in_title_is_escaped() -> None:
    reporter = TelegramReporter(token=None, chat_id=None, min_severity="info")
    finding = _make_finding(title="<script>alert(1)</script>")
    message = reporter._format_finding(finding, _make_scan(), "high")
    assert "<script>" not in message
    assert "&lt;script&gt;alert(1)&lt;/script&gt;" in message


def test_html_in_description_is_escaped() -> None:
    reporter = TelegramReporter(token=None, chat_id=None, min_severity="info")
    finding = _make_finding(description="bad <b>html</b> & such")
    message = reporter._format_finding(finding, _make_scan(), "high")
    assert "<b>html</b>" not in message
    assert "&lt;b&gt;html&lt;/b&gt; &amp; such" in message


def test_html_in_url_is_escaped() -> None:
    reporter = TelegramReporter(token=None, chat_id=None, min_severity="info")
    finding = _make_finding(url="https://x.test/?q=<script>")
    message = reporter._format_finding(finding, _make_scan(), "high")
    assert "<script>" not in message
    assert "&lt;script&gt;" in message


def test_message_format_includes_severity_emoji() -> None:
    reporter = TelegramReporter(token=None, chat_id=None, min_severity="info")
    message = reporter._format_finding(_make_finding(), _make_scan(), "high")
    assert "🟠" in message
    assert "HIGH" in message
    assert "sqli" in message


def test_message_format_includes_critical_emoji() -> None:
    reporter = TelegramReporter(token=None, chat_id=None, min_severity="info")
    message = reporter._format_finding(
        _make_finding(severity="critical"), _make_scan(), "critical"
    )
    assert "🔴" in message
    assert "CRITICAL" in message


def test_message_format_truncates_long_description() -> None:
    reporter = TelegramReporter(token=None, chat_id=None, min_severity="info")
    long_desc = "x" * 1200
    message = reporter._format_finding(
        _make_finding(description=long_desc), _make_scan(), "high"
    )
    # 500 chars + ellipsis, not the full 1200.
    assert "x" * 1200 not in message
    assert "…" in message


def test_message_format_includes_cvss_when_present() -> None:
    reporter = TelegramReporter(token=None, chat_id=None, min_severity="info")
    message = reporter._format_finding(_make_finding(), _make_scan(), "high")
    assert "CVSS: 8.6" in message
    assert "AV:N" in message


def test_message_format_omits_cvss_when_missing() -> None:
    reporter = TelegramReporter(token=None, chat_id=None, min_severity="info")
    finding = _make_finding()
    finding.pop("cvss_score")
    finding.pop("cvss_vector")
    message = reporter._format_finding(finding, _make_scan(), "high")
    assert "CVSS" not in message


def test_message_format_includes_target_and_scan_id() -> None:
    reporter = TelegramReporter(token=None, chat_id=None, min_severity="info")
    message = reporter._format_finding(_make_finding(), _make_scan(), "high")
    assert "target.example" in message
    assert "scan_abc123" in message


# ─── scan-complete summary format ──────────────────────────────────────────


def test_summary_format_lists_nonzero_buckets_only() -> None:
    reporter = TelegramReporter(token=None, chat_id=None, min_severity="info")
    summary = {"critical": 0, "high": 2, "medium": 0, "low": 1, "info": 0, "total": 3}
    message = reporter._format_summary(_make_scan(), summary)
    assert "High" in message
    assert "Low" in message
    assert "Critical" not in message  # zero bucket skipped
    assert "Total findings" in message
    assert "<b>3</b>" in message


# ─── HTTP path (mocked) ────────────────────────────────────────────────────


class _FakeResponse:
    def __init__(self, status_code: int, payload: dict[str, Any] | None = None) -> None:
        self.status_code = status_code
        self._payload = payload or {}
        self.text = str(self._payload)

    def json(self) -> dict[str, Any]:
        return self._payload


class _FakeClient:
    """Drop-in replacement for `httpx.AsyncClient` used as an async context manager."""

    def __init__(self, responses: list[_FakeResponse]) -> None:
        self._responses = responses
        self.post = AsyncMock(side_effect=responses)

    async def __aenter__(self) -> "_FakeClient":
        return self

    async def __aexit__(self, *exc: Any) -> None:
        return None


@pytest.mark.asyncio
async def test_real_send_success_returns_message_id() -> None:
    reporter = TelegramReporter(
        token="bot:token", chat_id="999", min_severity="info"
    )
    fake = _FakeClient([_FakeResponse(200, {"ok": True, "result": {"message_id": 42}})])
    with patch(
        "src.reporter.telegram_reporter.httpx.AsyncClient",
        return_value=fake,
    ):
        result = await reporter.report_finding(_make_finding(), _make_scan())
    assert result.sent is True
    assert result.message_id == 42
    assert result.stubbed is False
    fake.post.assert_awaited_once()


@pytest.mark.asyncio
async def test_real_send_retries_once_on_5xx() -> None:
    reporter = TelegramReporter(
        token="bot:token", chat_id="999", min_severity="info"
    )
    fake = _FakeClient(
        [
            _FakeResponse(503),
            _FakeResponse(200, {"ok": True, "result": {"message_id": 7}}),
        ]
    )
    with patch(
        "src.reporter.telegram_reporter.httpx.AsyncClient",
        return_value=fake,
    ), patch("src.reporter.telegram_reporter.asyncio.sleep", new=AsyncMock()):
        result = await reporter.report_finding(_make_finding(), _make_scan())
    assert result.sent is True
    assert result.message_id == 7
    assert fake.post.await_count == 2


@pytest.mark.asyncio
async def test_real_send_returns_error_on_4xx() -> None:
    reporter = TelegramReporter(
        token="bot:token", chat_id="999", min_severity="info"
    )
    fake = _FakeClient([_FakeResponse(400, {"ok": False, "description": "bad request"})])
    with patch(
        "src.reporter.telegram_reporter.httpx.AsyncClient",
        return_value=fake,
    ):
        result = await reporter.report_finding(_make_finding(), _make_scan())
    assert result.sent is False
    assert result.error == "http_400"


if __name__ == "__main__":  # pragma: no cover
    asyncio.run(asyncio.sleep(0))
