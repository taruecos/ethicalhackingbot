"""Cross-Site Scripting (XSS) scanner.

Strategy:
1. Identify injection points (query params, form fields, path segments)
2. Inject harmless XSS probe payloads
3. Check if payload is reflected unescaped in the response
4. Classify as reflected XSS when payload appears in response body
"""

import re
from dataclasses import dataclass
from enum import Enum
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

from src.utils.http_client import HttpClient, RequestResult


class XSSType(str, Enum):
    REFLECTED = "reflected"
    DOM_BASED = "dom_based"


@dataclass
class XSSFinding:
    """A confirmed XSS vulnerability."""
    url: str
    method: str
    xss_type: XSSType
    injection_point: str
    payload: str
    severity: str
    evidence: dict
    description: str


# Probe payloads — designed to detect reflection without causing harm
# Each tuple: (payload, detection_pattern)
XSS_PROBES = [
    # Basic script injection
    ('<script>alert("XSS")</script>', r'<script>alert\("XSS"\)</script>'),
    # Event handler injection
    ('" onmouseover="alert(1)" x="', r'onmouseover="alert\(1\)"'),
    # Image tag injection
    ('<img src=x onerror=alert(1)>', r'<img src=x onerror=alert\(1\)>'),
    # SVG injection
    ('<svg onload=alert(1)>', r'<svg onload=alert\(1\)>'),
    # Simple tag injection (checks if HTML is rendered)
    ("<b>xss_probe_12345</b>", r"<b>xss_probe_12345</b>"),
    # Template literal injection
    ("${alert(1)}", r"\$\{alert\(1\)\}"),
    # URL-encoded payload
    ("%3Cscript%3Ealert(1)%3C/script%3E", r"<script>alert\(1\)</script>"),
]

# Patterns that indicate the app escapes output (not vulnerable)
ESCAPE_INDICATORS = [
    "&lt;script&gt;",
    "&lt;img",
    "&lt;svg",
    "&#60;",
    "\\u003c",
]

# DOM-based XSS sinks in JavaScript
DOM_SINKS = [
    r"\.innerHTML\s*=",
    r"\.outerHTML\s*=",
    r"document\.write\s*\(",
    r"document\.writeln\s*\(",
    r"eval\s*\(",
    r"setTimeout\s*\(\s*['\"]",
    r"setInterval\s*\(\s*['\"]",
    r"\.insertAdjacentHTML\s*\(",
]


class XSSScanner:
    """Scans for Cross-Site Scripting vulnerabilities."""

    def __init__(self, http_client: HttpClient):
        self._http = http_client

    async def scan_endpoint(
        self,
        url: str,
        headers: dict | None = None,
    ) -> list[XSSFinding]:
        """Scan a single endpoint for XSS vulnerabilities."""
        findings = []

        # Test reflected XSS via query parameters
        reflected = await self._test_reflected_xss(url, headers or {})
        findings.extend(reflected)

        # Check for DOM-based XSS patterns in response
        dom = await self._check_dom_xss(url, headers or {})
        findings.extend(dom)

        return findings

    async def _test_reflected_xss(
        self,
        url: str,
        headers: dict,
    ) -> list[XSSFinding]:
        """Test for reflected XSS by injecting payloads into query parameters."""
        findings = []
        parsed = urlparse(url)
        params = parse_qs(parsed.query, keep_blank_values=True)

        if not params:
            # No query params — try injecting a test param
            params = {"q": ["test"], "search": ["test"], "input": ["test"]}

        for param_name, param_values in params.items():
            for payload, detection_pattern in XSS_PROBES:
                # Build URL with injected payload
                test_params = {k: v[0] if isinstance(v, list) else v for k, v in params.items()}
                test_params[param_name] = payload
                test_url = urlunparse((
                    parsed.scheme, parsed.netloc, parsed.path,
                    parsed.params, urlencode(test_params), parsed.fragment,
                ))

                result = await self._http.get(test_url, headers=headers)

                if result.error or result.status_code >= 500:
                    continue

                # Check if payload is reflected unescaped
                if self._is_reflected(result.body, payload, detection_pattern):
                    severity = self._assess_severity(payload, result)
                    findings.append(XSSFinding(
                        url=url,
                        method="GET",
                        xss_type=XSSType.REFLECTED,
                        injection_point=f"query_param:{param_name}",
                        payload=payload,
                        severity=severity,
                        evidence={
                            "param": param_name,
                            "status_code": result.status_code,
                            "payload_reflected": True,
                            "response_length": len(result.body),
                        },
                        description=(
                            f"Reflected XSS via '{param_name}' parameter at {url}. "
                            f"Payload '{payload[:30]}...' is reflected unescaped in the response body. "
                            f"An attacker could craft a malicious URL to execute JavaScript in a victim's browser."
                        ),
                    ))
                    break  # One finding per param is enough

        return findings

    async def _check_dom_xss(
        self,
        url: str,
        headers: dict,
    ) -> list[XSSFinding]:
        """Check response body for DOM-based XSS sink patterns."""
        findings = []
        result = await self._http.get(url, headers=headers)

        if result.error or not result.body:
            return findings

        for sink_pattern in DOM_SINKS:
            matches = re.findall(sink_pattern, result.body)
            if matches:
                findings.append(XSSFinding(
                    url=url,
                    method="GET",
                    xss_type=XSSType.DOM_BASED,
                    injection_point="javascript_sink",
                    payload=matches[0],
                    severity="medium",
                    evidence={
                        "sink_pattern": sink_pattern,
                        "match_count": len(matches),
                        "status_code": result.status_code,
                    },
                    description=(
                        f"Potential DOM-based XSS at {url}. "
                        f"Found {len(matches)} dangerous JavaScript sink(s) matching '{sink_pattern}'. "
                        f"If user-controlled data flows into these sinks, XSS is possible."
                    ),
                ))
                break  # One DOM finding per URL

        return findings

    def _is_reflected(self, body: str, payload: str, detection_pattern: str) -> bool:
        """Check if the payload is reflected unescaped in the response."""
        # Check if any escape indicator is present (means it's sanitized)
        for indicator in ESCAPE_INDICATORS:
            if indicator in body:
                return False

        # Check exact payload match
        if payload in body:
            return True

        # Check regex detection pattern
        if re.search(detection_pattern, body):
            return True

        return False

    def _assess_severity(self, payload: str, result: RequestResult) -> str:
        """Assess XSS severity based on context."""
        # Script tags that execute = high
        if "<script" in payload.lower():
            return "high"
        # Event handlers = high
        if "onerror" in payload.lower() or "onload" in payload.lower() or "onmouseover" in payload.lower():
            return "high"
        # HTML injection without script execution = medium
        if "<" in payload:
            return "medium"
        return "low"
