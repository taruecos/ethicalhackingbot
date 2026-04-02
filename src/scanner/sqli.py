"""SQL Injection scanner.

Strategy:
1. Identify injectable parameters (query params, path segments)
2. Inject SQL probe payloads (error-based, boolean-based, time-based)
3. Analyze responses for SQL error messages or behavioral differences
4. Never use destructive payloads (DROP, DELETE, UPDATE, INSERT)
"""

import re
import time
from dataclasses import dataclass
from enum import Enum
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

from src.utils.http_client import HttpClient, RequestResult


class SQLiType(str, Enum):
    ERROR_BASED = "error_based"
    BOOLEAN_BASED = "boolean_based"
    TIME_BASED = "time_based"


@dataclass
class SQLiFinding:
    """A confirmed SQL injection vulnerability."""
    url: str
    method: str
    sqli_type: SQLiType
    injection_point: str
    payload: str
    severity: str
    evidence: dict
    description: str


# Error-based detection: payloads that trigger SQL errors
ERROR_PAYLOADS = [
    "' OR '1'='1",
    "\" OR \"1\"=\"1",
    "' OR 1=1--",
    "\" OR 1=1--",
    "1' AND '1'='1",
    "' UNION SELECT NULL--",
    "1; SELECT 1--",
    "' AND EXTRACTVALUE(1, CONCAT(0x7e, VERSION()))--",
]

# Boolean-based detection: true vs false condition
BOOLEAN_PAIRS = [
    ("' AND '1'='1", "' AND '1'='2"),
    ("\" AND \"1\"=\"1", "\" AND \"1\"=\"2"),
    (" AND 1=1", " AND 1=2"),
    (" OR 1=1", " OR 1=2"),
]

# Time-based detection: payloads that cause delay
TIME_PAYLOADS = [
    ("' OR SLEEP(3)--", 3),
    ("\" OR SLEEP(3)--", 3),
    ("'; WAITFOR DELAY '0:0:3'--", 3),   # MSSQL
    ("' OR pg_sleep(3)--", 3),             # PostgreSQL
]

# SQL error patterns in responses
SQL_ERROR_PATTERNS = [
    re.compile(r"(?i)you have an error in your sql syntax"),
    re.compile(r"(?i)mysql_fetch|mysql_query|mysqli"),
    re.compile(r"(?i)pg_query|pg_exec|postgresql"),
    re.compile(r"(?i)sqlite3?\.\w+error"),
    re.compile(r"(?i)microsoft.*odbc.*driver"),
    re.compile(r"(?i)oracle.*error|ora-\d{5}"),
    re.compile(r"(?i)sql server.*error|mssql"),
    re.compile(r"(?i)unclosed quotation mark"),
    re.compile(r"(?i)syntax error.*sql|sql.*syntax error"),
    re.compile(r"(?i)warning.*\Wmysql_|warning.*\Wpg_"),
    re.compile(r"(?i)jdbc\..*exception"),
    re.compile(r"(?i)quoted string not properly terminated"),
    re.compile(r"(?i)sqlstate\["),
    re.compile(r"(?i)sql command not properly ended"),
]


class SQLiScanner:
    """Scans for SQL injection vulnerabilities using safe, read-only probes."""

    def __init__(self, http_client: HttpClient):
        self._http = http_client

    async def scan_endpoint(
        self,
        url: str,
        headers: dict | None = None,
    ) -> list[SQLiFinding]:
        """Scan a single endpoint for SQL injection."""
        findings = []
        parsed = urlparse(url)
        params = parse_qs(parsed.query, keep_blank_values=True)

        if not params:
            return findings

        for param_name in params:
            # Error-based detection
            error_finding = await self._test_error_based(url, param_name, params, parsed, headers or {})
            if error_finding:
                findings.append(error_finding)
                continue  # Skip other tests for this param

            # Boolean-based detection
            bool_finding = await self._test_boolean_based(url, param_name, params, parsed, headers or {})
            if bool_finding:
                findings.append(bool_finding)
                continue

            # Time-based detection (slower, use as last resort)
            time_finding = await self._test_time_based(url, param_name, params, parsed, headers or {})
            if time_finding:
                findings.append(time_finding)

        return findings

    async def _test_error_based(
        self, url: str, param_name: str, params: dict, parsed, headers: dict,
    ) -> SQLiFinding | None:
        """Test for error-based SQL injection."""
        original_value = params[param_name][0] if isinstance(params[param_name], list) else params[param_name]

        # Get baseline response
        baseline = await self._http.get(url, headers=headers)

        for payload in ERROR_PAYLOADS:
            test_params = {k: v[0] if isinstance(v, list) else v for k, v in params.items()}
            test_params[param_name] = original_value + payload
            test_url = urlunparse((
                parsed.scheme, parsed.netloc, parsed.path,
                parsed.params, urlencode(test_params), parsed.fragment,
            ))

            result = await self._http.get(test_url, headers=headers)

            if result.error:
                continue

            # Check for SQL error patterns in response
            for pattern in SQL_ERROR_PATTERNS:
                if pattern.search(result.body):
                    # Verify it's not in the baseline
                    if not pattern.search(baseline.body):
                        return SQLiFinding(
                            url=url,
                            method="GET",
                            sqli_type=SQLiType.ERROR_BASED,
                            injection_point=f"query_param:{param_name}",
                            payload=payload,
                            severity="critical",
                            evidence={
                                "param": param_name,
                                "error_pattern": pattern.pattern,
                                "status_code": result.status_code,
                                "baseline_status": baseline.status_code,
                            },
                            description=(
                                f"Error-based SQL injection via '{param_name}' at {url}. "
                                f"Payload '{payload}' triggered a database error message in the response. "
                                f"This confirms the parameter is directly interpolated into SQL queries."
                            ),
                        )

        return None

    async def _test_boolean_based(
        self, url: str, param_name: str, params: dict, parsed, headers: dict,
    ) -> SQLiFinding | None:
        """Test for boolean-based blind SQL injection."""
        original_value = params[param_name][0] if isinstance(params[param_name], list) else params[param_name]

        for true_payload, false_payload in BOOLEAN_PAIRS:
            # Test TRUE condition
            true_params = {k: v[0] if isinstance(v, list) else v for k, v in params.items()}
            true_params[param_name] = original_value + true_payload
            true_url = urlunparse((
                parsed.scheme, parsed.netloc, parsed.path,
                parsed.params, urlencode(true_params), parsed.fragment,
            ))
            true_result = await self._http.get(true_url, headers=headers)

            # Test FALSE condition
            false_params = {k: v[0] if isinstance(v, list) else v for k, v in params.items()}
            false_params[param_name] = original_value + false_payload
            false_url = urlunparse((
                parsed.scheme, parsed.netloc, parsed.path,
                parsed.params, urlencode(false_params), parsed.fragment,
            ))
            false_result = await self._http.get(false_url, headers=headers)

            if true_result.error or false_result.error:
                continue

            # If TRUE and FALSE produce significantly different responses, likely SQLi
            if self._responses_differ_significantly(true_result, false_result):
                return SQLiFinding(
                    url=url,
                    method="GET",
                    sqli_type=SQLiType.BOOLEAN_BASED,
                    injection_point=f"query_param:{param_name}",
                    payload=true_payload,
                    severity="high",
                    evidence={
                        "param": param_name,
                        "true_status": true_result.status_code,
                        "false_status": false_result.status_code,
                        "true_body_length": len(true_result.body),
                        "false_body_length": len(false_result.body),
                        "length_diff": abs(len(true_result.body) - len(false_result.body)),
                    },
                    description=(
                        f"Boolean-based blind SQL injection via '{param_name}' at {url}. "
                        f"TRUE condition ('{true_payload}') produces a {len(true_result.body)}-byte response, "
                        f"while FALSE condition ('{false_payload}') produces {len(false_result.body)} bytes. "
                        f"This behavioral difference indicates SQL injection."
                    ),
                )

        return None

    async def _test_time_based(
        self, url: str, param_name: str, params: dict, parsed, headers: dict,
    ) -> SQLiFinding | None:
        """Test for time-based blind SQL injection."""
        original_value = params[param_name][0] if isinstance(params[param_name], list) else params[param_name]

        # Get baseline timing
        baseline_start = time.monotonic()
        await self._http.get(url, headers=headers)
        baseline_time = time.monotonic() - baseline_start

        for payload, expected_delay in TIME_PAYLOADS:
            test_params = {k: v[0] if isinstance(v, list) else v for k, v in params.items()}
            test_params[param_name] = original_value + payload
            test_url = urlunparse((
                parsed.scheme, parsed.netloc, parsed.path,
                parsed.params, urlencode(test_params), parsed.fragment,
            ))

            start = time.monotonic()
            result = await self._http.get(test_url, headers=headers)
            elapsed = time.monotonic() - start

            if result.error:
                continue

            # If response took significantly longer than baseline + expected delay
            if elapsed >= baseline_time + expected_delay - 0.5:
                return SQLiFinding(
                    url=url,
                    method="GET",
                    sqli_type=SQLiType.TIME_BASED,
                    injection_point=f"query_param:{param_name}",
                    payload=payload,
                    severity="high",
                    evidence={
                        "param": param_name,
                        "baseline_time_ms": round(baseline_time * 1000),
                        "injected_time_ms": round(elapsed * 1000),
                        "expected_delay_s": expected_delay,
                        "status_code": result.status_code,
                    },
                    description=(
                        f"Time-based blind SQL injection via '{param_name}' at {url}. "
                        f"Baseline response: {round(baseline_time * 1000)}ms. "
                        f"With SLEEP payload: {round(elapsed * 1000)}ms "
                        f"(expected {expected_delay}s delay). "
                        f"The time difference confirms the SQL payload is executed server-side."
                    ),
                )

        return None

    def _responses_differ_significantly(self, r1: RequestResult, r2: RequestResult) -> bool:
        """Check if two responses differ enough to indicate boolean-based SQLi."""
        # Different status codes
        if r1.status_code != r2.status_code:
            if r1.status_code == 200 and r2.status_code in (404, 500, 403):
                return True

        # Significant body length difference (>30%)
        len1, len2 = len(r1.body), len(r2.body)
        if len1 > 0 and len2 > 0:
            ratio = min(len1, len2) / max(len1, len2)
            if ratio < 0.7:
                return True

        # Same status but very different content
        if r1.status_code == r2.status_code == 200:
            if r1.body != r2.body and abs(len1 - len2) > 100:
                return True

        return False
