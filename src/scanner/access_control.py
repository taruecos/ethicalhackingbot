"""Broken Access Control scanner.

Strategy:
1. Discover endpoints (crawl, API docs, common paths)
2. Categorize by expected privilege level (admin, user, public)
3. Test access with lower-privilege or unauthenticated sessions
4. Flag endpoints accessible without proper authorization
"""

import re
from dataclasses import dataclass
from enum import Enum

from src.utils.http_client import HttpClient, RequestResult


class PrivilegeLevel(str, Enum):
    PUBLIC = "public"
    USER = "user"
    ADMIN = "admin"
    SUPERADMIN = "superadmin"


@dataclass
class AccessControlFinding:
    """A confirmed broken access control vulnerability."""
    url: str
    method: str
    expected_level: PrivilegeLevel
    actual_level: PrivilegeLevel
    severity: str
    evidence: dict
    description: str


# Common admin/privileged paths to probe
ADMIN_PATHS = [
    "/admin", "/admin/", "/admin/dashboard", "/admin/users",
    "/api/admin", "/api/admin/users", "/api/admin/settings",
    "/api/v1/admin", "/api/v2/admin",
    "/dashboard/admin", "/manage", "/management",
    "/internal", "/internal/api", "/debug", "/debug/vars",
    "/graphql",  # often exposes schema with introspection
    "/.env", "/config", "/settings",
]

# HTTP methods to test for each endpoint
METHODS_TO_TEST = ["GET", "POST", "PUT", "DELETE", "PATCH"]

# Patterns indicating admin/internal content in responses
ADMIN_CONTENT_MARKERS = [
    "admin", "dashboard", "manage", "users list", "all users",
    "configuration", "settings", "internal", "debug",
    "role.*admin", "is_admin.*true", "isAdmin.*true",
]


class AccessControlScanner:
    """Scans for broken access control by testing privilege escalation."""

    def __init__(self, http_client: HttpClient):
        self._http = http_client

    async def probe_admin_paths(
        self,
        base_url: str,
        unauth_headers: dict | None = None,
        user_headers: dict | None = None,
    ) -> list[AccessControlFinding]:
        """Probe common admin paths with unauthenticated and user-level access."""
        findings = []

        for path in ADMIN_PATHS:
            url = f"{base_url.rstrip('/')}{path}"

            # Test unauthenticated access
            if unauth_headers is not None:
                result = await self._http.get(url, headers=unauth_headers)
                finding = self._analyze_response(
                    url, "GET", result,
                    expected_level=PrivilegeLevel.ADMIN,
                    actual_level=PrivilegeLevel.PUBLIC,
                )
                if finding:
                    findings.append(finding)

            # Test user-level access
            if user_headers is not None:
                result = await self._http.get(url, headers=user_headers)
                finding = self._analyze_response(
                    url, "GET", result,
                    expected_level=PrivilegeLevel.ADMIN,
                    actual_level=PrivilegeLevel.USER,
                )
                if finding:
                    findings.append(finding)

        return findings

    async def test_method_override(
        self,
        url: str,
        headers: dict,
    ) -> AccessControlFinding | None:
        """Test if HTTP method restrictions can be bypassed."""
        # Some apps only check auth for POST but not PUT/PATCH
        get_result = await self._http.get(url, headers=headers)

        for method in ["PUT", "PATCH", "DELETE"]:
            result = await self._http.request(method, url, headers=headers)
            if result.status_code in (200, 201, 204) and get_result.status_code in (401, 403):
                return AccessControlFinding(
                    url=url,
                    method=method,
                    expected_level=PrivilegeLevel.ADMIN,
                    actual_level=PrivilegeLevel.USER,
                    severity="high",
                    evidence={
                        "get_status": get_result.status_code,
                        "bypass_method": method,
                        "bypass_status": result.status_code,
                    },
                    description=(
                        f"HTTP method override bypass at {url}. "
                        f"GET returns {get_result.status_code} but {method} returns {result.status_code}. "
                        f"The server may not enforce authorization consistently across HTTP methods."
                    ),
                )

        return None

    async def test_header_bypass(
        self,
        url: str,
        base_headers: dict,
    ) -> list[AccessControlFinding]:
        """Test common header-based auth bypasses."""
        findings = []

        bypass_headers = [
            {"X-Original-URL": url},
            {"X-Rewrite-URL": url},
            {"X-Forwarded-For": "127.0.0.1"},
            {"X-Forwarded-Host": "localhost"},
            {"X-Custom-IP-Authorization": "127.0.0.1"},
            {"X-Real-IP": "127.0.0.1"},
        ]

        baseline = await self._http.get(url, headers=base_headers)

        for extra_headers in bypass_headers:
            merged = {**base_headers, **extra_headers}
            result = await self._http.get(url, headers=merged)

            if (
                baseline.status_code in (401, 403)
                and result.status_code == 200
                and len(result.body) > 50
            ):
                bypass_header = list(extra_headers.keys())[0]
                findings.append(AccessControlFinding(
                    url=url,
                    method="GET",
                    expected_level=PrivilegeLevel.ADMIN,
                    actual_level=PrivilegeLevel.PUBLIC,
                    severity="critical",
                    evidence={
                        "baseline_status": baseline.status_code,
                        "bypass_header": bypass_header,
                        "bypass_value": extra_headers[bypass_header],
                        "bypass_status": result.status_code,
                        "response_length": len(result.body),
                    },
                    description=(
                        f"Access control bypass via {bypass_header} header at {url}. "
                        f"Normal request returns {baseline.status_code}, but adding "
                        f"'{bypass_header}: {extra_headers[bypass_header]}' returns {result.status_code} "
                        f"with {len(result.body)} bytes of content."
                    ),
                ))

        return findings

    def _analyze_response(
        self,
        url: str,
        method: str,
        result: RequestResult,
        expected_level: PrivilegeLevel,
        actual_level: PrivilegeLevel,
    ) -> AccessControlFinding | None:
        """Analyze if a response indicates broken access control."""
        # Not accessible — properly protected
        if result.status_code in (401, 403, 404, 405):
            return None

        # Redirect to login — properly protected
        if result.status_code in (301, 302, 307, 308):
            location = result.headers.get("location", "")
            if "login" in location.lower() or "auth" in location.lower():
                return None

        # Got a success response — check if it has admin content
        if result.status_code == 200:
            has_admin_content = any(
                re.search(marker, result.body, re.I)
                for marker in ADMIN_CONTENT_MARKERS
            )

            if has_admin_content or len(result.body) > 500:
                severity = "critical" if actual_level == PrivilegeLevel.PUBLIC else "high"
                return AccessControlFinding(
                    url=url,
                    method=method,
                    expected_level=expected_level,
                    actual_level=actual_level,
                    severity=severity,
                    evidence={
                        "status_code": result.status_code,
                        "response_length": len(result.body),
                        "has_admin_content": has_admin_content,
                    },
                    description=(
                        f"Broken access control at {url}. "
                        f"Expected {expected_level.value}-level access, but "
                        f"{actual_level.value}-level request returned {result.status_code} "
                        f"with {len(result.body)} bytes. Admin content markers detected: {has_admin_content}."
                    ),
                )

        return None
