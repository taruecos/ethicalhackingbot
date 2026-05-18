"""Tests for the Intigriti submitter — focus on stub mode + pure logic.

Real HTTP is exercised by integration tests once a token is provisioned.
"""

from __future__ import annotations

import pytest

from src.reporter.intigriti_submitter import (
    SEVERITY_MAP,
    TYPE_MAP,
    IntigritiSubmitter,
    SubmissionResult,
)


@pytest.fixture
def stub_submitter() -> IntigritiSubmitter:
    return IntigritiSubmitter(token=None)


@pytest.fixture
def explicit_stub_submitter() -> IntigritiSubmitter:
    return IntigritiSubmitter(token="stub-mode")


@pytest.fixture
def sample_finding() -> dict:
    return {
        "module": "xss",
        "severity": "high",
        "title": "Reflected XSS in search",
        "description": "User input echoed without escaping.",
        "url": "https://example.com/search?q=",
        "evidence": {"payload": "<script>1</script>"},
        "cwe_id": "CWE-79",
    }


@pytest.mark.asyncio
async def test_stub_mode_without_token(stub_submitter, sample_finding):
    """No token => stub mode: stubbed=True, status='stubbed', deterministic id."""
    result = await stub_submitter.submit(sample_finding, program_id="acme-corp")
    assert isinstance(result, SubmissionResult)
    assert result.stubbed is True
    assert result.status == "stubbed"
    assert result.submission_id is not None
    assert result.submission_id.startswith("stub-")
    assert result.deduped is False


@pytest.mark.asyncio
async def test_stub_mode_with_sentinel_token(explicit_stub_submitter, sample_finding):
    """token=='stub-mode' triggers stub mode same as no token."""
    result = await explicit_stub_submitter.submit(sample_finding, program_id="acme-corp")
    assert result.stubbed is True
    assert result.status == "stubbed"


@pytest.mark.asyncio
async def test_stub_mode_empty_token(sample_finding):
    """Empty string token also triggers stub mode."""
    submitter = IntigritiSubmitter(token="")
    result = await submitter.submit(sample_finding, program_id="acme-corp")
    assert result.stubbed is True


def test_dedup_hash_is_deterministic(sample_finding):
    """Same finding+program => same hash, independent of submitter instance."""
    s1 = IntigritiSubmitter(token=None)
    s2 = IntigritiSubmitter(token="some-real-token")

    h1 = s1.compute_dedup_hash(sample_finding, "acme-corp")
    h2 = s2.compute_dedup_hash(sample_finding, "acme-corp")
    assert h1 == h2
    assert len(h1) == 64  # SHA256 hex


def test_dedup_hash_changes_with_program(sample_finding):
    s = IntigritiSubmitter(token=None)
    h1 = s.compute_dedup_hash(sample_finding, "acme-corp")
    h2 = s.compute_dedup_hash(sample_finding, "other-corp")
    assert h1 != h2


def test_dedup_hash_changes_with_url(sample_finding):
    s = IntigritiSubmitter(token=None)
    h1 = s.compute_dedup_hash(sample_finding, "acme-corp")
    other = dict(sample_finding, url="https://example.com/different")
    h2 = s.compute_dedup_hash(other, "acme-corp")
    assert h1 != h2


def test_dedup_hash_handles_missing_fields():
    """Should not crash on findings with sparse data."""
    s = IntigritiSubmitter(token=None)
    h = s.compute_dedup_hash({"title": "x"}, "acme")
    assert len(h) == 64


@pytest.mark.asyncio
async def test_dedup_short_circuits_resubmit(stub_submitter, sample_finding):
    """Second submission of identical finding returns deduped=True."""
    r1 = await stub_submitter.submit(sample_finding, program_id="acme-corp")
    r2 = await stub_submitter.submit(sample_finding, program_id="acme-corp")
    assert r1.deduped is False
    assert r2.deduped is True
    assert r2.status == "deduped"
    assert r2.submission_id == r1.submission_id


def test_severity_mapping_full():
    """All severity tiers map correctly; info maps to None (rejected)."""
    assert SEVERITY_MAP["critical"] == "Critical"
    assert SEVERITY_MAP["high"] == "High"
    assert SEVERITY_MAP["medium"] == "Medium"
    assert SEVERITY_MAP["low"] == "Low"
    assert SEVERITY_MAP["info"] is None


def test_severity_mapping_case_insensitive(stub_submitter):
    """Uppercase severity strings should still resolve."""
    assert stub_submitter._map_severity("HIGH") == "High"
    assert stub_submitter._map_severity("Critical") == "Critical"
    assert stub_submitter._map_severity("INFO") is None


@pytest.mark.asyncio
async def test_info_severity_rejected(stub_submitter, sample_finding):
    """Info findings get rejected_info_severity without submission."""
    info_finding = dict(sample_finding, severity="info")
    result = await stub_submitter.submit(info_finding, program_id="acme-corp")
    assert result.status == "rejected_info_severity"
    assert result.submission_id is None
    assert result.deduped is False


@pytest.mark.asyncio
async def test_info_severity_uppercase_rejected(stub_submitter, sample_finding):
    info_finding = dict(sample_finding, severity="INFO")
    result = await stub_submitter.submit(info_finding, program_id="acme-corp")
    assert result.status == "rejected_info_severity"


def test_type_mapping_covers_all_eight_modules():
    """All 8 scanner modules have an Intigriti type label."""
    expected = {
        "idor": "Insecure Direct Object Reference",
        "xss": "Cross-Site Scripting",
        "sqli": "SQL Injection",
        "ssrf": "Server-Side Request Forgery",
        "csrf": "Cross-Site Request Forgery",
        "access_control": "Broken Access Control",
        "info_disclosure": "Information Disclosure",
        "differential": "Authorization Flaw",
    }
    assert TYPE_MAP == expected
    assert len(TYPE_MAP) == 8


def test_type_mapping_unknown_module_defaults_to_other(stub_submitter):
    assert stub_submitter._map_type("brand-new-module") == "Other"
    assert stub_submitter._map_type(None) == "Other"


def test_build_payload_shape(stub_submitter, sample_finding):
    """Real-shaped payload — what production POST would carry."""
    payload = stub_submitter._build_payload(
        sample_finding, program_id="acme-corp", severity_label="High"
    )
    assert payload["programId"] == "acme-corp"
    assert payload["title"] == "Reflected XSS in search"
    assert payload["severity"] == "High"
    assert payload["type"] == "Cross-Site Scripting"
    assert payload["endpoint"] == "https://example.com/search?q="
    assert payload["cweId"] == "CWE-79"
    assert payload["evidence"] == {"payload": "<script>1</script>"}


def test_build_payload_omits_optional_fields(stub_submitter):
    minimal = {
        "module": "sqli",
        "severity": "high",
        "title": "SQLi",
        "description": "blind sqli",
    }
    payload = stub_submitter._build_payload(minimal, "p1", "High")
    assert "endpoint" not in payload
    assert "evidence" not in payload
    assert "cweId" not in payload
    assert "cvssVector" not in payload


def test_is_stub_property():
    assert IntigritiSubmitter(token=None).is_stub is True
    assert IntigritiSubmitter(token="").is_stub is True
    assert IntigritiSubmitter(token="stub-mode").is_stub is True
    assert IntigritiSubmitter(token="real-token-abc").is_stub is False


def test_base_url_strips_trailing_slash():
    s = IntigritiSubmitter(token=None, base_url="https://api.example.com/v1/")
    assert s.base_url == "https://api.example.com/v1"
