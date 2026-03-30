"""Information Disclosure scanner.

Strategy:
1. Check API responses for leaked sensitive data (tokens, internal IPs, stack traces)
2. Probe common disclosure endpoints (.env, /debug, /status, source maps)
3. Analyze response headers for version/tech leaks
4. Check JS bundles for hardcoded secrets
"""

import re
from dataclasses import dataclass

from src.utils.http_client import HttpClient, RequestResult


@dataclass
class InfoDisclosureFinding:
    """A confirmed information disclosure vulnerability."""
    url: str
    disclosure_type: str
    severity: str
    leaked_data: str  # sanitized excerpt
    evidence: dict
    description: str


# Regex patterns for sensitive data in responses
SENSITIVE_PATTERNS = {
    "aws_key": (re.compile(r"AKIA[0-9A-Z]{16}"), "critical"),
    "aws_secret": (re.compile(r"(?i)aws.{0,20}['\"][0-9a-zA-Z/+]{40}['\"]"), "critical"),
    "github_token": (re.compile(r"gh[ps]_[0-9a-zA-Z]{36,}"), "critical"),
    "jwt_token": (re.compile(r"eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}"), "high"),
    "api_key_generic": (re.compile(r"(?i)(api[_-]?key|apikey)\s*[:=]\s*['\"]?([a-zA-Z0-9_-]{20,})['\"]?"), "high"),
    "private_key": (re.compile(r"-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----"), "critical"),
    "password_field": (re.compile(r"(?i)['\"]password['\"]\s*:\s*['\"][^'\"]+['\"]"), "critical"),
    "internal_ip": (re.compile(r"\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b"), "low"),
    "email_address": (re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"), "low"),
    "stack_trace": (re.compile(r"(?:Traceback|Exception|Error).*(?:at |in |File ).*line \d+", re.DOTALL), "medium"),
    "sql_error": (re.compile(r"(?i)(?:sql syntax|mysql|postgresql|sqlite).*(?:error|exception|warning)"), "medium"),
    "debug_info": (re.compile(r"(?i)(?:debug|stack_trace|traceback|internal_error)"), "medium"),
}

# Common disclosure endpoints
DISCLOSURE_ENDPOINTS = [
    "/.env",
    "/.git/config",
    "/.git/HEAD",
    "/robots.txt",
    "/sitemap.xml",
    "/.well-known/security.txt",
    "/api/debug",
    "/api/status",
    "/api/health",
    "/api/info",
    "/api/config",
    "/api/swagger.json",
    "/api/openapi.json",
    "/api/graphql?query={__schema{types{name}}}",
    "/server-status",
    "/server-info",
    "/.DS_Store",
    "/wp-config.php.bak",
    "/package.json",
    "/composer.json",
]

# Response headers that leak info
LEAK_HEADERS = [
    "server",
    "x-powered-by",
    "x-aspnet-version",
    "x-runtime",
    "x-debug-token",
    "x-request-id",
]


class InfoDisclosureScanner:
    """Scans for information disclosure vulnerabilities."""

    def __init__(self, http_client: HttpClient):
        self._http = http_client

    async def scan_response(self, url: str, response: RequestResult) -> list[InfoDisclosureFinding]:
        """Scan a single response for sensitive data leaks."""
        findings = []

        # Check body for sensitive patterns
        for name, (pattern, severity) in SENSITIVE_PATTERNS.items():
            matches = pattern.findall(response.body)
            if matches:
                # Sanitize — don't store full secrets
                sample = str(matches[0])[:20] + "..." if len(str(matches[0])) > 20 else str(matches[0])
                findings.append(InfoDisclosureFinding(
                    url=url,
                    disclosure_type=name,
                    severity=severity,
                    leaked_data=sample,
                    evidence={
                        "match_count": len(matches),
                        "pattern": name,
                        "sample": sample,
                        "response_status": response.status_code,
                    },
                    description=(
                        f"Information disclosure ({name}) at {url}. "
                        f"Found {len(matches)} instance(s) of {name} pattern in the response body. "
                        f"Sample (truncated): {sample}"
                    ),
                ))

        # Check headers for tech leaks
        for header in LEAK_HEADERS:
            value = response.headers.get(header)
            if value:
                findings.append(InfoDisclosureFinding(
                    url=url,
                    disclosure_type=f"header_leak_{header}",
                    severity="low",
                    leaked_data=value,
                    evidence={
                        "header": header,
                        "value": value,
                    },
                    description=(
                        f"Technology disclosure via '{header}' header at {url}. "
                        f"Value: {value}. This reveals server technology which aids attackers."
                    ),
                ))

        return findings

    async def probe_disclosure_endpoints(self, base_url: str) -> list[InfoDisclosureFinding]:
        """Probe common endpoints that often leak sensitive information."""
        findings = []

        for path in DISCLOSURE_ENDPOINTS:
            url = f"{base_url.rstrip('/')}{path}"
            result = await self._http.get(url)

            if result.status_code == 200 and len(result.body) > 0:
                # Analyze what was found
                endpoint_findings = await self.scan_response(url, result)
                findings.extend(endpoint_findings)

                # Special cases
                if path == "/.env" and "=" in result.body:
                    findings.append(InfoDisclosureFinding(
                        url=url,
                        disclosure_type="env_file_exposed",
                        severity="critical",
                        leaked_data=result.body[:100] + "...",
                        evidence={
                            "status_code": result.status_code,
                            "body_length": len(result.body),
                            "contains_env_vars": True,
                        },
                        description=(
                            f"Environment file exposed at {url}. "
                            f"The .env file is publicly accessible and may contain "
                            f"database credentials, API keys, and other secrets."
                        ),
                    ))

                if path in ("/.git/config", "/.git/HEAD"):
                    findings.append(InfoDisclosureFinding(
                        url=url,
                        disclosure_type="git_exposed",
                        severity="high",
                        leaked_data=result.body[:100],
                        evidence={
                            "status_code": result.status_code,
                            "path": path,
                        },
                        description=(
                            f"Git repository exposed at {url}. "
                            f"The .git directory is accessible, potentially allowing "
                            f"full source code download and commit history access."
                        ),
                    ))

                if "swagger" in path or "openapi" in path:
                    findings.append(InfoDisclosureFinding(
                        url=url,
                        disclosure_type="api_docs_exposed",
                        severity="medium",
                        leaked_data=f"API documentation at {url}",
                        evidence={
                            "status_code": result.status_code,
                            "body_length": len(result.body),
                        },
                        description=(
                            f"API documentation exposed at {url}. "
                            f"Public API docs reveal endpoint structure, parameters, "
                            f"and may include internal endpoints."
                        ),
                    ))

        return findings
