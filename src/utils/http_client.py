"""HTTP client with rate limiting, session management, and auth support."""

import asyncio
from dataclasses import dataclass, field

import httpx
from aiolimiter import AsyncLimiter


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
    ):
        self._concurrency = concurrency
        self._limiter = AsyncLimiter(concurrency, request_delay)
        self._timeout = timeout
        self._default_headers = headers or {}
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self):
        self._client = httpx.AsyncClient(
            timeout=self._timeout,
            headers=self._default_headers,
            follow_redirects=True,
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
        """Send a rate-limited HTTP request."""
        async with self._limiter:
            try:
                response = await self._client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    params=params,
                    json=json,
                    content=data,
                    cookies=cookies,
                )
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
