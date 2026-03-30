"""IDOR (Insecure Direct Object Reference) scanner.

Strategy:
1. Crawl API endpoints and identify ID parameters (path, query, body)
2. Authenticate as User A, record responses for their resources
3. Swap IDs to User B's resources, compare responses
4. If User A can access User B's data → IDOR finding
"""

import re
import json
from dataclasses import dataclass
from enum import Enum

from src.utils.http_client import HttpClient, RequestResult


class IDORType(str, Enum):
    PATH_ID = "path_id"          # /api/users/123/profile
    QUERY_ID = "query_id"        # /api/profile?user_id=123
    BODY_ID = "body_id"          # POST body with {"user_id": 123}


@dataclass
class IDORCandidate:
    """A potential IDOR vulnerability to test."""
    url: str
    method: str
    id_type: IDORType
    id_param: str
    original_id: str
    test_ids: list[str]


@dataclass
class IDORFinding:
    """A confirmed IDOR vulnerability."""
    url: str
    method: str
    id_type: IDORType
    id_param: str
    original_id: str
    swapped_id: str
    severity: str  # low, medium, high, critical
    evidence: dict  # original vs swapped response comparison
    description: str


# Patterns that look like IDs in URLs
ID_PATTERNS = [
    re.compile(r"/(\d{1,10})(?:/|$|\?)"),                    # numeric IDs
    re.compile(r"/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})", re.I),  # UUIDs
    re.compile(r"/([0-9a-f]{24})", re.I),                    # MongoDB ObjectIDs
]

# Query/body params that commonly hold IDs
ID_PARAM_NAMES = [
    "id", "user_id", "userId", "account_id", "accountId",
    "profile_id", "profileId", "order_id", "orderId",
    "doc_id", "docId", "file_id", "fileId", "item_id", "itemId",
    "project_id", "projectId", "org_id", "orgId", "team_id", "teamId",
]


class IDORScanner:
    """Scans for IDOR vulnerabilities by swapping object references."""

    def __init__(self, http_client: HttpClient):
        self._http = http_client

    def extract_path_ids(self, url: str) -> list[tuple[str, str]]:
        """Extract potential IDs from URL path. Returns (id_value, pattern_match) pairs."""
        found = []
        for pattern in ID_PATTERNS:
            for match in pattern.finditer(url):
                found.append((match.group(1), match.group(0)))
        return found

    def extract_param_ids(self, params: dict) -> list[tuple[str, str]]:
        """Extract potential IDs from query/body params. Returns (param_name, id_value) pairs."""
        found = []
        for key, value in params.items():
            key_lower = key.lower()
            if any(name.lower() == key_lower for name in ID_PARAM_NAMES):
                found.append((key, str(value)))
            elif isinstance(value, (int, str)) and re.match(r"^\d{1,10}$", str(value)):
                found.append((key, str(value)))
        return found

    def generate_test_ids(self, original_id: str, count: int = 5) -> list[str]:
        """Generate test IDs based on the original ID format."""
        test_ids = []

        if re.match(r"^\d+$", original_id):
            num = int(original_id)
            for offset in [1, -1, 2, -2, 0]:
                candidate = str(num + offset)
                if candidate != original_id and candidate not in test_ids:
                    test_ids.append(candidate)
                if len(test_ids) >= count:
                    break

        elif re.match(r"^[0-9a-f]{8}-", original_id, re.I):
            # UUID — increment last segment
            parts = original_id.split("-")
            last = int(parts[-1], 16)
            for offset in [1, -1, 2]:
                parts_copy = parts[:]
                parts_copy[-1] = format(last + offset, "012x")
                candidate = "-".join(parts_copy)
                if candidate != original_id:
                    test_ids.append(candidate)
                if len(test_ids) >= count:
                    break

        return test_ids[:count]

    async def test_idor(self, candidate: IDORCandidate, auth_headers: dict) -> IDORFinding | None:
        """Test a single IDOR candidate. Returns a finding if vulnerable."""
        # First, get the original (authorized) response
        original_response = await self._http.get(candidate.url, headers=auth_headers)

        if original_response.status_code != 200:
            return None

        # Now swap the ID and test each variant
        for test_id in candidate.test_ids:
            if candidate.id_type == IDORType.PATH_ID:
                test_url = candidate.url.replace(candidate.original_id, test_id)
            else:
                test_url = candidate.url

            swapped_response = await self._http.get(test_url, headers=auth_headers)

            # Analyze: if we get 200 with different data, it's likely IDOR
            if self._is_idor(original_response, swapped_response, candidate.original_id, test_id):
                severity = self._assess_severity(original_response, swapped_response)
                return IDORFinding(
                    url=candidate.url,
                    method=candidate.method,
                    id_type=candidate.id_type,
                    id_param=candidate.id_param,
                    original_id=candidate.original_id,
                    swapped_id=test_id,
                    severity=severity,
                    evidence={
                        "original_status": original_response.status_code,
                        "swapped_status": swapped_response.status_code,
                        "original_body_length": len(original_response.body),
                        "swapped_body_length": len(swapped_response.body),
                        "data_differs": original_response.body != swapped_response.body,
                    },
                    description=self._generate_description(candidate, test_id, swapped_response),
                )

        return None

    def _is_idor(
        self,
        original: RequestResult,
        swapped: RequestResult,
        original_id: str,
        swapped_id: str,
    ) -> bool:
        """Determine if the swapped response indicates an IDOR."""
        # Must get a success response
        if swapped.status_code not in (200, 201):
            return False

        # Response must contain different data (not just the same default/error page)
        if original.body == swapped.body:
            return False

        # Response should contain the swapped ID (we're seeing someone else's data)
        if swapped_id in swapped.body:
            return True

        # Different body with success status — likely IDOR
        if len(swapped.body) > 50 and swapped.status_code == 200:
            return True

        return False

    def _assess_severity(self, original: RequestResult, swapped: RequestResult) -> str:
        """Assess the severity of the IDOR finding."""
        body_lower = swapped.body.lower()

        # Critical: PII, auth tokens, financial data
        critical_markers = ["password", "token", "secret", "ssn", "credit_card", "bank"]
        if any(marker in body_lower for marker in critical_markers):
            return "critical"

        # High: personal data, user profiles
        high_markers = ["email", "phone", "address", "name", "profile"]
        if any(marker in body_lower for marker in high_markers):
            return "high"

        # Medium: internal data, non-PII
        if len(swapped.body) > 200:
            return "medium"

        return "low"

    def _generate_description(
        self, candidate: IDORCandidate, test_id: str, response: RequestResult
    ) -> str:
        """Generate a human-readable description for the finding."""
        return (
            f"IDOR vulnerability found at {candidate.url}. "
            f"By changing the {candidate.id_type.value} parameter '{candidate.id_param}' "
            f"from '{candidate.original_id}' to '{test_id}', "
            f"the server returned a {response.status_code} response with {len(response.body)} bytes "
            f"of data belonging to another user/object. "
            f"This indicates that the application does not properly verify object ownership."
        )
