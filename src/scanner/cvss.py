"""CVSS 3.1 base score calculator for finding severity justification.

Maps vulnerability class + context to CVSS vector -> base score -> severity.
Reference: https://www.first.org/cvss/v3.1/specification-document
"""

from dataclasses import dataclass
from typing import Literal

# CVE/CWE references per vuln class
CWE_MAP: dict[str, str] = {
    "idor": "CWE-639",
    "xss_reflected": "CWE-79",
    "xss_stored": "CWE-79",
    "xss_dom": "CWE-79",
    "sqli_error": "CWE-89",
    "sqli_blind": "CWE-89",
    "sqli_time": "CWE-89",
    "sqli_union": "CWE-89",
    "ssrf_basic": "CWE-918",
    "ssrf_metadata": "CWE-918",
    "ssrf_file": "CWE-918",
    "csrf": "CWE-352",
    "access_control_horizontal": "CWE-639",
    "access_control_vertical": "CWE-285",
    "info_disclosure_backup": "CWE-530",
    "info_disclosure_debug": "CWE-489",
    "info_disclosure_git": "CWE-527",
    "info_disclosure_env": "CWE-200",
    "differential": "CWE-285",
}

# Pre-computed CVSS 3.1 vectors per vuln class
# Format: AV (N/A/L/P) / AC (L/H) / PR (N/L/H) / UI (N/R) / S (U/C) / C (N/L/H) / I (N/L/H) / A (N/L/H)
CVSS_VECTORS: dict[str, str] = {
    "idor": "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:L/A:N",                  # 7.1 High
    "xss_reflected": "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N",         # 6.1 Medium
    "xss_stored": "CVSS:3.1/AV:N/AC:L/PR:L/UI:R/S:C/C:H/I:H/A:N",            # 8.7 High
    "xss_dom": "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N",               # 6.1 Medium
    "sqli_error": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",            # 9.8 Critical
    "sqli_blind": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H",            # 8.1 High
    "sqli_time": "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H",             # 8.1 High
    "sqli_union": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",            # 9.8 Critical
    "ssrf_basic": "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:L/A:N",            # 8.5 High
    "ssrf_metadata": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",         # 10.0 Critical
    "ssrf_file": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",             # 10.0 Critical
    "csrf": "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:H/A:N",                  # 6.5 Medium
    "access_control_horizontal": "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:L/A:N",  # 7.1 High
    "access_control_vertical": "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",    # 8.8 High
    "info_disclosure_backup": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",     # 7.5 High
    "info_disclosure_debug": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N",      # 5.3 Medium
    "info_disclosure_git": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",        # 7.5 High
    "info_disclosure_env": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",        # 7.5 High
    "differential": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N",               # 5.3 Medium
}


@dataclass
class CvssResult:
    vector: str
    base_score: float
    severity: str  # critical / high / medium / low / info
    cwe: str


def calculate(vuln_class: str) -> CvssResult:
    """Return CVSS vector, base score, severity, and CWE for a vuln class."""
    if vuln_class not in CVSS_VECTORS:
        # Fallback: unknown vuln -> info
        return CvssResult(vector="", base_score=0.0, severity="info", cwe="")
    vector = CVSS_VECTORS[vuln_class]
    score = _compute_base_score(vector)
    severity = _score_to_severity(score)
    cwe = CWE_MAP.get(vuln_class, "")
    return CvssResult(vector=vector, base_score=score, severity=severity, cwe=cwe)


def _compute_base_score(vector: str) -> float:
    """Compute CVSS 3.1 base score from vector string."""
    # Parse vector
    parts = {}
    for token in vector.split("/")[1:]:
        k, _, v = token.partition(":")
        parts[k] = v

    # Metric values per CVSS 3.1 spec
    av = {"N": 0.85, "A": 0.62, "L": 0.55, "P": 0.2}[parts["AV"]]
    ac = {"L": 0.77, "H": 0.44}[parts["AC"]]
    ui = {"N": 0.85, "R": 0.62}[parts["UI"]]
    scope_changed = parts["S"] == "C"

    # PR depends on scope
    pr_map_u = {"N": 0.85, "L": 0.62, "H": 0.27}
    pr_map_c = {"N": 0.85, "L": 0.68, "H": 0.5}
    pr = (pr_map_c if scope_changed else pr_map_u)[parts["PR"]]

    cia = {"N": 0.0, "L": 0.22, "H": 0.56}
    c = cia[parts["C"]]
    i = cia[parts["I"]]
    a = cia[parts["A"]]

    iss = 1 - ((1 - c) * (1 - i) * (1 - a))
    if scope_changed:
        impact = 7.52 * (iss - 0.029) - 3.25 * (iss - 0.02) ** 15
    else:
        impact = 6.42 * iss

    exploitability = 8.22 * av * ac * pr * ui

    if impact <= 0:
        return 0.0

    if scope_changed:
        base = min(1.08 * (impact + exploitability), 10)
    else:
        base = min(impact + exploitability, 10)

    # Round up to one decimal per CVSS 3.1 rules
    import math
    return math.ceil(base * 10) / 10


def _score_to_severity(score: float) -> str:
    if score >= 9.0:
        return "critical"
    if score >= 7.0:
        return "high"
    if score >= 4.0:
        return "medium"
    if score > 0.0:
        return "low"
    return "info"
