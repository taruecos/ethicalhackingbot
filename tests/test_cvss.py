"""Tests for the CVSS 3.1 base score calculator."""

import pytest

from src.scanner.cvss import (
    CVSS_VECTORS,
    CWE_MAP,
    CvssResult,
    calculate,
)


def test_all_known_vuln_classes_produce_valid_scores():
    """Every vuln class in CVSS_VECTORS must produce a score in (0, 10]."""
    for vuln_class in CVSS_VECTORS:
        result = calculate(vuln_class)
        assert isinstance(result, CvssResult)
        assert result.vector != "", f"{vuln_class} returned empty vector"
        assert 0.0 < result.base_score <= 10.0, (
            f"{vuln_class} produced invalid score {result.base_score}"
        )
        assert result.severity in {"critical", "high", "medium", "low"}, (
            f"{vuln_class} produced invalid severity {result.severity}"
        )
        assert result.cwe.startswith("CWE-"), (
            f"{vuln_class} produced invalid CWE {result.cwe!r}"
        )


def test_sqli_error_is_critical_9_8():
    result = calculate("sqli_error")
    assert result.base_score == 9.8
    assert result.severity == "critical"
    assert result.cwe == "CWE-89"
    assert result.vector == "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"


def test_xss_reflected_is_medium_6_1():
    result = calculate("xss_reflected")
    assert result.base_score == 6.1
    assert result.severity == "medium"
    assert result.cwe == "CWE-79"


def test_csrf_is_medium_6_5():
    result = calculate("csrf")
    assert result.base_score == 6.5
    assert result.severity == "medium"
    assert result.cwe == "CWE-352"


def test_unknown_vuln_class_returns_info():
    result = calculate("not_a_real_vuln_class_xyz")
    assert result.base_score == 0.0
    assert result.severity == "info"
    assert result.cwe == ""
    assert result.vector == ""


def test_sqli_union_is_critical_9_8():
    result = calculate("sqli_union")
    assert result.base_score == 9.8
    assert result.severity == "critical"


def test_ssrf_metadata_is_critical_10_0():
    result = calculate("ssrf_metadata")
    assert result.base_score == 10.0
    assert result.severity == "critical"
    assert result.cwe == "CWE-918"


def test_ssrf_file_is_critical_10_0():
    result = calculate("ssrf_file")
    assert result.base_score == 10.0
    assert result.severity == "critical"


def test_idor_is_high_7_1():
    result = calculate("idor")
    assert result.base_score == 7.1
    assert result.severity == "high"
    assert result.cwe == "CWE-639"


def test_xss_stored_is_high_8_7():
    result = calculate("xss_stored")
    assert result.base_score == 8.7
    assert result.severity == "high"


def test_sqli_blind_is_high_8_1():
    result = calculate("sqli_blind")
    assert result.base_score == 8.1
    assert result.severity == "high"


def test_sqli_time_is_high_8_1():
    result = calculate("sqli_time")
    assert result.base_score == 8.1
    assert result.severity == "high"


def test_ssrf_basic_is_high_8_5():
    result = calculate("ssrf_basic")
    assert result.base_score == 8.5
    assert result.severity == "high"


def test_access_control_horizontal_is_high_7_1():
    result = calculate("access_control_horizontal")
    assert result.base_score == 7.1
    assert result.severity == "high"


def test_access_control_vertical_is_high_8_8():
    result = calculate("access_control_vertical")
    assert result.base_score == 8.8
    assert result.severity == "high"


def test_info_disclosure_backup_is_high_7_5():
    result = calculate("info_disclosure_backup")
    assert result.base_score == 7.5
    assert result.severity == "high"


def test_info_disclosure_debug_is_medium_5_3():
    result = calculate("info_disclosure_debug")
    assert result.base_score == 5.3
    assert result.severity == "medium"


def test_info_disclosure_git_is_high_7_5():
    result = calculate("info_disclosure_git")
    assert result.base_score == 7.5
    assert result.severity == "high"


def test_info_disclosure_env_is_high_7_5():
    result = calculate("info_disclosure_env")
    assert result.base_score == 7.5
    assert result.severity == "high"


def test_differential_is_medium_5_3():
    result = calculate("differential")
    assert result.base_score == 5.3
    assert result.severity == "medium"
    assert result.cwe == "CWE-285"


def test_xss_dom_is_medium_6_1():
    result = calculate("xss_dom")
    assert result.base_score == 6.1
    assert result.severity == "medium"


def test_every_known_class_has_matching_cwe_entry():
    """Every CVSS_VECTORS key must have a corresponding CWE_MAP entry."""
    missing = [c for c in CVSS_VECTORS if c not in CWE_MAP]
    assert not missing, f"vuln classes missing CWE_MAP entry: {missing}"
