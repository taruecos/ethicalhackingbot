"""HTTP client with rate limiting, session management, and auth support."""

import asyncio
import logging
from dataclasses import dataclass, field
from urllib.parse import urlparse

import httpx
from aiolimiter import AsyncLimiter

logger = logging.getLogger("http_client")

MAX_REDIRECTS = 10


@dataclass
class RequestResult:
    url: str
    method: str
    status_code: int
    headers: dict
    body: str
    elapsed_ms: float
    error: str | None = None


class HttpClient:
    """Rate-limited async HTTP client for scanning targets."""

    def __init__(
        self,
        concurrency: int = 5,
        request_delay: float = 1.0,
        timeout: float = 30.0,
        headers: dict | None = None,
        scope_enforcer=None,
    ):
        self._concurrency = concurrency
        self._limiter = AsyncLimiter(concurrency, request_delay)
        self._timeout = timeout
        self._default_headers = headers or {}
        self._client: httpx.AsyncClient | None = None
        self._scope_enforcer = scope_enforcer

    async def __aenter__(self):
        self._client = httpx.AsyncClient(
            timeout=self._timeout,
            headers=self._default_headers,
            follow_redirects=False,
            http2=True,
        )
        return self

    async def __aexit__(self, *args):
        if self._client:
            await self._client.aclose()

    async def request(
        self,
        method: str,
        url: str,
        headers: dict | None = None,
        params: dict | None = None,
        json: dict | None = None,
        data: str | None = None,
        cookies: dict | None = None,
    ) -> RequestResult:
        """Send a rate-limited HTTP request with scope-safe redirect handling."""
        # Merge per-request headers with defaults — compliance headers (User-Agent, etc.)
        # from _default_headers always win and cannot be overridden by per-request headers
        merged_headers = dict(headers) if headers else {}
        merged_headers.update(self._default_headers)

        async with self._limiter:
            try:
                response = await self._client.request(
                    method=method,
                    url=url,
                    headers=merged_headers,
                    params=params,
                    json=json,
                    content=data,
                    cookies=cookies,
                )

                # Manually follow redirects with scope validation
                redirect_count = 0
                while response.is_redirect and redirect_count < MAX_REDIRECTS:
                    redirect_url = str(response.next_request.url) if response.next_request else None
                    if not redirect_url:
                        break

                    # Scope check on redirect destination
                    if self._scope_enforcer and not self._scope_enforcer.is_in_scope(redirect_url):
                        logger.warning(f"BLOCKED redirect to out-of-scope URL: {url} → {redirect_url}")
                        return RequestResult(
                            url=url,
                            method=method,
                            status_code=response.status_code,
                            headers=dict(response.headers),
                            body="",
                            elapsed_ms=response.elapsed.total_seconds() * 1000,
                            error=f"Redirect blocked — destination out of scope: {redirect_url}",
                        )

                    response = await self._client.request(
                        method="GET",
                        url=redirect_url,
                        headers=merged_headers,
                    )
                    redirect_count += 1

                return RequestResult(
                    url=str(response.url),
                    method=method,
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    body=response.text,
                    elapsed_ms=response.elapsed.total_seconds() * 1000,
                )
            except Exception as e:
                return RequestResult(
                    url=url,
                    method=method,
                    status_code=0,
                    headers={},
                    body="",
                    elapsed_ms=0,
                    error=str(e),
                )

    async def get(self, url: str, **kwargs) -> RequestResult:
        return await self.request("GET", url, **kwargs)

    async def post(self, url: str, **kwargs) -> RequestResult:
        return await self.request("POST", url, **kwargs)

    async def put(self, url: str, **kwargs) -> RequestResult:
        return await self.request("PUT", url, **kwargs)

    async def delete(self, url: str, **kwargs) -> RequestResult:
        return await self.request("DELETE", url, **kwargs)
