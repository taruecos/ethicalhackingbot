"""Cross-Site Request Forgery (CSRF) scanner.

Strategy:
1. Identify state-changing endpoints (POST, PUT, DELETE, PATCH)
2. Check for CSRF protection mechanisms:
   - CSRF tokens in forms / headers
   - SameSite cookie attributes
   - Origin/Referer header validation
3. Flag endpoints missing CSRF protection
"""

import re
from dataclasses import dataclass

from src.utils.http_client import HttpClient, RequestResult


@dataclass
class CSRFFinding:
    """A confirmed CSRF vulnerability."""
    url: str
    method: str
    missing_protection: str
    severity: str
    evidence: dict
    description: str


# CSRF token patterns in HTML forms
CSRF_TOKEN_PATTERNS = [
    re.compile(r'name=["\']?csrf[_-]?token["\']?', re.I),
    re.compile(r'name=["\']?_token["\']?', re.I),
    re.compile(r'name=["\']?authenticity_token["\']?', re.I),
    re.compile(r'name=["\']?__RequestVerificationToken["\']?', re.I),
    re.compile(r'name=["\']?csrfmiddlewaretoken["\']?', re.I),
    re.compile(r'name=["\']?_csrf["\']?', re.I),
    re.compile(r'name=["\']?XSRF-TOKEN["\']?', re.I),
    re.compile(r'X-CSRF-TOKEN', re.I),
    re.compile(r'X-XSRF-TOKEN', re.I),
]

# Headers that indicate CSRF protection
CSRF_HEADERS = [
    "x-csrf-token",
    "x-xsrf-token",
    "x-requested-with",
]

# State-changing HTTP methods that need CSRF protection
STATE_CHANGING_METHODS = ["POST", "PUT", "DELETE", "PATCH"]


class CSRFScanner:
    """Scans for missing CSRF protection on state-changing endpoints."""

    def __init__(self, http_client: HttpClient):
        self._http = http_client

    async def scan_endpoint(
        self,
        url: str,
        method: str = "POST",
        headers: dict | None = None,
    ) -> list[CSRFFinding]:
        """Scan an endpoint for CSRF vulnerabilities."""
        findings = []

        if method.upper() not in STATE_CHANGING_METHODS:
            return findings

        # Step 1: GET the page to check for CSRF tokens in forms
        page_result = await self._http.get(url, headers=headers or {})
        has_form_token = self._has_csrf_token_in_body(page_result.body)

        # Step 2: Check if cookies have SameSite attribute
        has_samesite = self._has_samesite_cookies(page_result)

        # Step 3: Test if the endpoint accepts requests without CSRF token
        # Send a state-changing request without any CSRF token
        no_csrf_headers = dict(headers or {})
        # Remove any CSRF headers
        for h in CSRF_HEADERS:
            no_csrf_headers.pop(h, None)
            no_csrf_headers.pop(h.upper(), None)

        result = await self._http.request(
            method.upper(), url,
            headers=no_csrf_headers,
            json={"test": "csrf_probe"},
        )

        # Step 4: Analyze results
        if not has_form_token and not has_samesite:
            # No CSRF token in form AND no SameSite cookies
            if result.status_code in (200, 201, 204, 302):
                severity = "high" if method.upper() in ("POST", "DELETE") else "medium"
                findings.append(CSRFFinding(
                    url=url,
                    method=method.upper(),
                    missing_protection="csrf_token + samesite_cookie",
                    severity=severity,
                    evidence={
                        "has_form_token": False,
                        "has_samesite_cookie": False,
                        "no_token_status": result.status_code,
                        "response_length": len(result.body),
                    },
                    description=(
                        f"Missing CSRF protection at {url} ({method.upper()}). "
                        f"No CSRF token found in HTML forms, no SameSite cookie attribute detected, "
                        f"and the endpoint accepts {method.upper()} requests without a CSRF token "
                        f"(returned {result.status_code}). An attacker could forge requests on behalf of authenticated users."
                    ),
                ))

        elif not has_form_token and has_samesite:
            # SameSite protects modern browsers but not older ones
            if result.status_code in (200, 201, 204, 302):
                findings.append(CSRFFinding(
                    url=url,
                    method=method.upper(),
                    missing_protection="csrf_token",
                    severity="medium",
                    evidence={
                        "has_form_token": False,
                        "has_samesite_cookie": True,
                        "no_token_status": result.status_code,
                    },
                    description=(
                        f"Partial CSRF protection at {url} ({method.upper()}). "
                        f"SameSite cookie attribute is set (protects modern browsers), "
                        f"but no CSRF token was found. Older browsers without SameSite support remain vulnerable."
                    ),
                ))

        # Step 5: Test Origin header validation
        origin_finding = await self._test_origin_bypass(url, method, headers or {})
        if origin_finding:
            findings.append(origin_finding)

        return findings

    async def _test_origin_bypass(
        self,
        url: str,
        method: str,
        headers: dict,
    ) -> CSRFFinding | None:
        """Test if the server validates the Origin header."""
        # Send request with a spoofed Origin
        spoofed_headers = dict(headers)
        spoofed_headers["Origin"] = "https://evil-attacker.com"
        spoofed_headers["Referer"] = "https://evil-attacker.com/attack"

        result = await self._http.request(
            method.upper(), url,
            headers=spoofed_headers,
            json={"test": "origin_bypass"},
        )

        if result.status_code in (200, 201, 204):
            return CSRFFinding(
                url=url,
                method=method.upper(),
                missing_protection="origin_validation",
                severity="medium",
                evidence={
                    "spoofed_origin": "https://evil-attacker.com",
                    "accepted_status": result.status_code,
                    "response_length": len(result.body),
                },
                description=(
                    f"Missing Origin header validation at {url} ({method.upper()}). "
                    f"The server accepted a request with Origin: https://evil-attacker.com "
                    f"and returned {result.status_code}. This suggests the server does not "
                    f"validate the request origin, enabling cross-origin request forgery."
                ),
            )

        return None

    def _has_csrf_token_in_body(self, body: str) -> bool:
        """Check if the HTML body contains CSRF token inputs."""
        for pattern in CSRF_TOKEN_PATTERNS:
            if pattern.search(body):
                return True
        return False

    def _has_samesite_cookies(self, result: RequestResult) -> bool:
        """Check if any Set-Cookie headers include SameSite attribute."""
        for key, value in result.headers.items():
            if key.lower() == "set-cookie":
                if "samesite" in value.lower():
                    return True
        return False
