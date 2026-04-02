"""Differential scanner — tests the same endpoint with different auth levels.

Sends identical requests as anonymous, regular user, and (if available) admin,
then compares responses.  Response divergence reveals access-control bugs that
no template-based scanner can catch.

Example: if an anonymous request returns the same data as an authenticated one,
the endpoint leaks data.  If a user request returns admin data, it's an IDOR or
privilege escalation.
"""

import logging
from dataclasses import dataclass
from difflib import SequenceMatcher
from urllib.parse import urlparse

from src.utils.http_client import HttpClient

logger = logging.getLogger("differential")


@dataclass
class DiffFinding:
    """A differential analysis finding."""
    url: str
    method: str
    finding_type: str  # "anon_leak", "privilege_escalation", "inconsistent_auth"
    severity: str      # "critical", "high", "medium", "low", "info"
    description: str
    evidence: dict


class DifferentialScanner:
    """Compare responses across auth levels to find access control bugs."""

    def __init__(self, http_client: HttpClient):
        self._http = http_client

    async def scan_endpoint(
        self,
        url: str,
        method: str = "GET",
        anon_headers: dict | None = None,
        user_headers: dict | None = None,
        admin_headers: dict | None = None,
    ) -> list[DiffFinding]:
        """Test a single endpoint with up to 3 auth levels."""
        findings: list[DiffFinding] = []
        anon_headers = anon_headers or {}
        user_headers = user_headers or {}

        # ── Request as anonymous ──
        anon_result = await self._http.request(method, url, headers=anon_headers)

        # ── Request as regular user ──
        user_result = await self._http.request(method, url, headers=user_headers)

        # ── Request as admin (if headers provided) ──
        admin_result = None
        if admin_headers:
            admin_result = await self._http.request(method, url, headers=admin_headers)

        # ── Compare: anonymous vs user ──
        if not anon_result.error and not user_result.error:
            finding = self._compare_responses(
                url, method, "anonymous", "user",
                anon_result.status_code, anon_result.body,
                user_result.status_code, user_result.body,
            )
            if finding:
                findings.append(finding)

        # ── Compare: user vs admin ──
        if admin_result and not user_result.error and not admin_result.error:
            finding = self._compare_responses(
                url, method, "user", "admin",
                user_result.status_code, user_result.body,
                admin_result.status_code, admin_result.body,
            )
            if finding:
                findings.append(finding)

        # ── Check: anonymous gets 200 on what should be protected ──
        if not anon_result.error and anon_result.status_code == 200:
            if self._looks_like_protected_endpoint(url):
                # Anonymous shouldn't get 200 on admin/user/account paths
                findings.append(DiffFinding(
                    url=url,
                    method=method,
                    finding_type="anon_leak",
                    severity="high",
                    description=f"Anonymous access returns 200 on protected-looking path: {urlparse(url).path}",
                    evidence={
                        "anon_status": anon_result.status_code,
                        "anon_body_length": len(anon_result.body),
                        "anon_body_preview": anon_result.body[:500],
                    },
                ))

        # ── Check: method override (GET endpoint accepts DELETE/PUT) ──
        if method == "GET":
            method_findings = await self._test_method_override(url, user_headers or anon_headers)
            findings.extend(method_findings)

        return findings

    async def scan_endpoints(
        self,
        endpoints: list,
        anon_headers: dict | None = None,
        user_headers: dict | None = None,
        admin_headers: dict | None = None,
    ) -> list[DiffFinding]:
        """Run differential analysis on a list of endpoints."""
        all_findings: list[DiffFinding] = []
        for ep in endpoints:
            url = ep.url if hasattr(ep, "url") else str(ep)
            method = ep.method if hasattr(ep, "method") else "GET"
            findings = await self.scan_endpoint(
                url, method, anon_headers, user_headers, admin_headers
            )
            all_findings.extend(findings)
        return all_findings

    def _compare_responses(
        self,
        url: str,
        method: str,
        role_a: str,
        role_b: str,
        status_a: int,
        body_a: str,
        status_b: int,
        body_b: str,
    ) -> DiffFinding | None:
        """Compare two responses from different auth levels."""

        # Both got errors or empty — nothing to compare
        if not body_a and not body_b:
            return None

        # ── Same status, very similar body = potential data leak ──
        if status_a == status_b == 200:
            similarity = self._body_similarity(body_a, body_b)

            if similarity > 0.90 and len(body_b) > 100:
                # Lower-priv role sees basically the same data as higher-priv
                return DiffFinding(
                    url=url,
                    method=method,
                    finding_type="anon_leak" if role_a == "anonymous" else "privilege_escalation",
                    severity="high" if role_a == "anonymous" else "medium",
                    description=(
                        f"{role_a} response is {similarity:.0%} similar to {role_b} response "
                        f"({len(body_a)} vs {len(body_b)} bytes). "
                        f"Data may be leaking to lower-privilege users."
                    ),
                    evidence={
                        f"{role_a}_status": status_a,
                        f"{role_b}_status": status_b,
                        "similarity": round(similarity, 3),
                        f"{role_a}_body_length": len(body_a),
                        f"{role_b}_body_length": len(body_b),
                        f"{role_a}_preview": body_a[:300],
                        f"{role_b}_preview": body_b[:300],
                    },
                )

        # ── Lower-priv gets 200 but higher-priv gets 403/401 = weird ──
        if status_a == 200 and status_b in (401, 403):
            return DiffFinding(
                url=url,
                method=method,
                finding_type="inconsistent_auth",
                severity="medium",
                description=(
                    f"{role_a} gets 200 but {role_b} gets {status_b}. "
                    f"Auth logic may be inverted or inconsistent."
                ),
                evidence={
                    f"{role_a}_status": status_a,
                    f"{role_b}_status": status_b,
                    f"{role_a}_body_preview": body_a[:300],
                },
            )

        return None

    async def _test_method_override(self, url: str, headers: dict) -> list[DiffFinding]:
        """Test if a GET endpoint also accepts state-changing methods."""
        findings: list[DiffFinding] = []
        dangerous_methods = ["PUT", "DELETE", "PATCH"]

        for method in dangerous_methods:
            result = await self._http.request(method, url, headers=headers)
            if not result.error and result.status_code in (200, 201, 204):
                findings.append(DiffFinding(
                    url=url,
                    method=method,
                    finding_type="method_override",
                    severity="medium",
                    description=f"Endpoint accepts {method} method (returned {result.status_code}). May allow unintended state changes.",
                    evidence={
                        "method": method,
                        "status_code": result.status_code,
                        "body_preview": result.body[:300],
                    },
                ))

        return findings

    def _body_similarity(self, body_a: str, body_b: str) -> float:
        """Calculate similarity ratio between two response bodies."""
        # For very large bodies, compare a sample
        max_len = 5000
        a = body_a[:max_len]
        b = body_b[:max_len]
        return SequenceMatcher(None, a, b).ratio()

    def _looks_like_protected_endpoint(self, url: str) -> bool:
        """Check if a URL path suggests it should be auth-protected."""
        path = urlparse(url).path.lower()
        protected_patterns = [
            "/admin", "/user", "/account", "/profile", "/settings",
            "/dashboard", "/manage", "/internal", "/private",
            "/api/me", "/api/user", "/api/admin",
        ]
        return any(pattern in path for pattern in protected_patterns)
