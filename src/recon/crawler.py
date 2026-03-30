"""Endpoint crawler — discovers API endpoints and their parameters."""

import re
import json
from urllib.parse import urljoin, urlparse, parse_qs
from dataclasses import dataclass, field
from collections import deque

from bs4 import BeautifulSoup

from src.utils.http_client import HttpClient


@dataclass
class Endpoint:
    """A discovered API endpoint."""
    url: str
    method: str = "GET"
    params: dict = field(default_factory=dict)
    headers: dict = field(default_factory=dict)
    body: dict | None = None
    source: str = ""  # where we found this endpoint (page, js, api docs)
    requires_auth: bool = False


class EndpointCrawler:
    """Crawls a target to discover API endpoints."""

    def __init__(self, http_client: HttpClient, max_depth: int = 3):
        self._http = http_client
        self._max_depth = max_depth
        self._visited: set[str] = set()
        self._endpoints: list[Endpoint] = []

    async def crawl(self, base_url: str, auth_headers: dict | None = None) -> list[Endpoint]:
        """Crawl starting from base_url, discovering endpoints."""
        self._visited.clear()
        self._endpoints.clear()

        queue: deque[tuple[str, int]] = deque([(base_url, 0)])
        domain = urlparse(base_url).netloc

        while queue:
            url, depth = queue.popleft()

            if url in self._visited or depth > self._max_depth:
                continue
            self._visited.add(url)

            # Only crawl same domain
            if urlparse(url).netloc != domain:
                continue

            result = await self._http.get(url, headers=auth_headers or {})
            if result.error or result.status_code >= 400:
                continue

            content_type = result.headers.get("content-type", "")

            if "html" in content_type:
                links, api_urls = self._extract_from_html(url, result.body)
                for link in links:
                    if link not in self._visited:
                        queue.append((link, depth + 1))
                for api_url in api_urls:
                    self._endpoints.append(Endpoint(
                        url=api_url, source=f"html:{url}"
                    ))

            elif "javascript" in content_type or url.endswith(".js"):
                api_urls = self._extract_from_js(url, result.body)
                for api_url in api_urls:
                    self._endpoints.append(Endpoint(
                        url=api_url, source=f"js:{url}"
                    ))

            elif "json" in content_type:
                api_urls = self._extract_from_json(url, result.body)
                for api_url in api_urls:
                    self._endpoints.append(Endpoint(
                        url=api_url, source=f"json:{url}"
                    ))

            # Check for API-like paths
            if "/api/" in url or "/v1/" in url or "/v2/" in url:
                self._endpoints.append(Endpoint(
                    url=url,
                    params=dict(parse_qs(urlparse(url).query)),
                    source="crawl",
                ))

        return self._deduplicate(self._endpoints)

    def _extract_from_html(self, base_url: str, html: str) -> tuple[list[str], list[str]]:
        """Extract links and API URLs from HTML."""
        soup = BeautifulSoup(html, "lxml")
        links = []
        api_urls = []

        # Regular links
        for tag in soup.find_all(["a", "link"], href=True):
            href = urljoin(base_url, tag["href"])
            links.append(href)

        # Forms
        for form in soup.find_all("form", action=True):
            action = urljoin(base_url, form["action"])
            method = form.get("method", "GET").upper()
            self._endpoints.append(Endpoint(
                url=action, method=method, source=f"form:{base_url}"
            ))

        # Script sources
        for script in soup.find_all("script", src=True):
            src = urljoin(base_url, script["src"])
            links.append(src)

        # Inline scripts
        for script in soup.find_all("script"):
            if script.string:
                api_urls.extend(self._extract_api_patterns(base_url, script.string))

        # Data attributes that might contain API URLs
        for tag in soup.find_all(attrs={"data-url": True}):
            api_urls.append(urljoin(base_url, tag["data-url"]))

        return links, api_urls

    def _extract_from_js(self, base_url: str, js_content: str) -> list[str]:
        """Extract API URLs from JavaScript files."""
        return self._extract_api_patterns(base_url, js_content)

    def _extract_from_json(self, base_url: str, json_str: str) -> list[str]:
        """Extract API URLs from JSON responses."""
        urls = []
        try:
            data = json.loads(json_str)
            self._walk_json(data, base_url, urls)
        except json.JSONDecodeError:
            pass
        return urls

    def _walk_json(self, obj, base_url: str, urls: list[str]):
        """Recursively walk JSON to find URL-like values."""
        if isinstance(obj, str):
            if obj.startswith(("http://", "https://", "/api/", "/v1/", "/v2/")):
                urls.append(urljoin(base_url, obj))
        elif isinstance(obj, dict):
            for v in obj.values():
                self._walk_json(v, base_url, urls)
        elif isinstance(obj, list):
            for item in obj:
                self._walk_json(item, base_url, urls)

    def _extract_api_patterns(self, base_url: str, text: str) -> list[str]:
        """Extract API endpoint patterns from text content."""
        urls = []

        # Match common API URL patterns in JS/text
        patterns = [
            re.compile(r'["\'](/api/[a-zA-Z0-9/_.-]+)["\']'),
            re.compile(r'["\'](/v[12]/[a-zA-Z0-9/_.-]+)["\']'),
            re.compile(r'fetch\(["\']([^"\']+)["\']'),
            re.compile(r'axios\.[a-z]+\(["\']([^"\']+)["\']'),
            re.compile(r'url:\s*["\']([^"\']+)["\']'),
            re.compile(r'endpoint:\s*["\']([^"\']+)["\']'),
            re.compile(r'href:\s*["\']([^"\']+/api/[^"\']+)["\']'),
        ]

        for pattern in patterns:
            for match in pattern.finditer(text):
                url = match.group(1)
                urls.append(urljoin(base_url, url))

        return urls

    def _deduplicate(self, endpoints: list[Endpoint]) -> list[Endpoint]:
        """Remove duplicate endpoints."""
        seen = set()
        unique = []
        for ep in endpoints:
            key = (ep.url, ep.method)
            if key not in seen:
                seen.add(key)
                unique.append(ep)
        return unique
