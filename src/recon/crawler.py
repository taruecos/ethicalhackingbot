"""Endpoint crawler — discovers API endpoints and their parameters.

Enhanced recon: robots.txt, sitemap.xml, deep JS mining, HTML comment
extraction, tech-stack fingerprinting, and hidden parameter discovery.
"""

import re
import json
import logging
from urllib.parse import urljoin, urlparse, parse_qs
from dataclasses import dataclass, field
from collections import deque

from bs4 import BeautifulSoup, Comment

from src.utils.http_client import HttpClient
from src.scope.enforcer import ScopeEnforcer

logger = logging.getLogger("crawler")


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


# ── Tech-stack fingerprint → known paths ──────────────────────────
TECH_FINGERPRINTS: dict[str, list[str]] = {
    "spring": [
        "/actuator/health", "/actuator/env", "/actuator/info",
        "/actuator/metrics", "/actuator/mappings", "/actuator/beans",
        "/actuator/configprops", "/actuator/threaddump",
        "/swagger-ui.html", "/v2/api-docs", "/v3/api-docs",
    ],
    "django": [
        "/admin/", "/api/schema/", "/api/docs/",
        "/__debug__/", "/static/rest_framework/",
    ],
    "rails": [
        "/rails/info/routes", "/rails/info/properties",
        "/sidekiq/", "/admin/",
    ],
    "express": [
        "/api-docs", "/swagger.json", "/graphql",
        "/.well-known/openapi.json",
    ],
    "nextjs": [
        "/_next/data/", "/api/auth/session", "/api/auth/providers",
        "/api/auth/csrf",
    ],
    "laravel": [
        "/telescope", "/horizon", "/nova-api/",
        "/_debugbar/open",
    ],
    "aspnet": [
        "/swagger/v1/swagger.json", "/_configuration/",
        "/api/values", "/elmah.axd",
    ],
    "wordpress": [
        "/wp-json/wp/v2/users", "/wp-json/wp/v2/posts",
        "/wp-json/", "/xmlrpc.php",
    ],
    "graphql": [
        "/graphql", "/graphiql", "/playground",
        "/api/graphql", "/v1/graphql",
    ],
}

# Headers/body patterns that reveal the tech stack
TECH_DETECTION: dict[str, list[str]] = {
    "spring": ["x-application-context", "whitelabel error page", "actuator"],
    "django": ["csrfmiddlewaretoken", "django", "x-frame-options: deny"],
    "rails": ["x-request-id", "x-runtime", "action_dispatch"],
    "express": ["x-powered-by: express", "connect.sid"],
    "nextjs": ["x-nextjs", "__next", "_next/static"],
    "laravel": ["laravel_session", "xsrf-token", "x-powered-by: php"],
    "aspnet": ["x-aspnet-version", "x-powered-by: asp.net", "__requestverificationtoken"],
    "wordpress": ["wp-", "wordpress", "wp-json"],
    "graphql": ["graphql", "__schema", "__typename"],
}


class EndpointCrawler:
    """Crawls a target to discover API endpoints."""

    def __init__(self, http_client: HttpClient, max_depth: int = 3, scope_enforcer: ScopeEnforcer | None = None):
        self._http = http_client
        self._max_depth = max_depth
        self._scope = scope_enforcer
        self._visited: set[str] = set()
        self._endpoints: list[Endpoint] = []
        self._detected_techs: set[str] = set()

    async def crawl(self, base_url: str, auth_headers: dict | None = None) -> list[Endpoint]:
        """Crawl starting from base_url, discovering endpoints."""
        self._visited.clear()
        self._endpoints.clear()
        self._detected_techs.clear()

        domain = urlparse(base_url).netloc
        origin = f"{urlparse(base_url).scheme}://{domain}"

        # ── Pre-crawl recon (robots.txt, sitemap, well-known) ──
        extra_seeds = await self._pre_crawl_recon(origin, auth_headers)

        queue: deque[tuple[str, int]] = deque([(base_url, 0)])
        for seed in extra_seeds:
            if seed not in self._visited:
                queue.append((seed, 1))

        while queue:
            url, depth = queue.popleft()

            if url in self._visited or depth > self._max_depth:
                continue
            self._visited.add(url)

            # Only crawl same domain
            if urlparse(url).netloc != domain:
                continue

            # Scope check BEFORE making any request
            if self._scope and not self._scope.is_in_scope(url):
                continue

            result = await self._http.get(url, headers=auth_headers)
            if result.error or result.status_code >= 400:
                continue

            content_type = result.headers.get("content-type", "")

            # ── Tech-stack fingerprinting from headers ──
            self._fingerprint_headers(result.headers)

            if "html" in content_type:
                links, api_urls = self._extract_from_html(url, result.body)
                for link in links:
                    if link not in self._visited:
                        queue.append((link, depth + 1))
                for api_url in api_urls:
                    self._endpoints.append(Endpoint(
                        url=api_url, source=f"html:{url}"
                    ))

                # ── HTML comment mining ──
                comment_urls = self._extract_from_comments(url, result.body)
                for api_url in comment_urls:
                    self._endpoints.append(Endpoint(
                        url=api_url, source=f"comment:{url}"
                    ))

                # ── Tech fingerprint from body ──
                self._fingerprint_body(result.body)

            elif "javascript" in content_type or url.endswith(".js"):
                api_urls = self._extract_from_js(url, result.body)
                for api_url in api_urls:
                    self._endpoints.append(Endpoint(
                        url=api_url, source=f"js:{url}"
                    ))

                # ── Deep JS mining (configs, hidden params, GraphQL) ──
                deep_endpoints = self._deep_js_mine(url, result.body)
                self._endpoints.extend(deep_endpoints)

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

        # ── Post-crawl: probe tech-stack-specific paths ──
        tech_endpoints = await self._probe_tech_paths(origin, auth_headers)
        self._endpoints.extend(tech_endpoints)

        return self._deduplicate(self._endpoints)

    # ═════════════════════════════════════════════════════════════
    # Pre-crawl recon
    # ═════════════════════════════════════════════════════════════

    async def _pre_crawl_recon(self, origin: str, auth_headers: dict | None = None) -> list[str]:
        """Fetch robots.txt, sitemap.xml, security.txt for extra seed URLs."""
        seeds: list[str] = []

        # ── robots.txt ──
        robots_result = await self._http.get(f"{origin}/robots.txt", headers=auth_headers)
        if not robots_result.error and robots_result.status_code == 200:
            seeds.extend(self._parse_robots_txt(origin, robots_result.body))

        # ── sitemap.xml ──
        sitemap_result = await self._http.get(f"{origin}/sitemap.xml", headers=auth_headers)
        if not sitemap_result.error and sitemap_result.status_code == 200:
            seeds.extend(self._parse_sitemap(origin, sitemap_result.body))

        # ── .well-known/security.txt ──
        sec_result = await self._http.get(f"{origin}/.well-known/security.txt", headers=auth_headers)
        if not sec_result.error and sec_result.status_code == 200:
            # Just log it — confirms the target has a security policy
            logger.info(f"Found security.txt at {origin}")

        logger.info(f"Pre-crawl recon: {len(seeds)} extra seed URLs from robots.txt/sitemap")
        return seeds

    def _parse_robots_txt(self, origin: str, body: str) -> list[str]:
        """Extract paths from robots.txt — both Allowed and Disallowed are interesting."""
        paths: list[str] = []
        sitemap_urls: list[str] = []

        for line in body.splitlines():
            line = line.strip()
            if line.startswith("#") or not line:
                continue

            if ":" not in line:
                continue

            directive, _, value = line.partition(":")
            value = value.strip()
            directive = directive.strip().lower()

            if directive in ("disallow", "allow") and value and value != "/":
                # Disallowed paths are gold — they're hidden for a reason
                full_url = urljoin(origin, value)
                paths.append(full_url)
            elif directive == "sitemap":
                sitemap_urls.append(value)

        # TODO: fetch additional sitemaps from robots.txt
        return paths

    def _parse_sitemap(self, origin: str, body: str) -> list[str]:
        """Extract URLs from sitemap.xml (handles both index and urlset)."""
        urls: list[str] = []
        # Simple regex extraction — works for both sitemap index and urlset
        loc_pattern = re.compile(r'<loc>\s*(.*?)\s*</loc>', re.IGNORECASE)
        for match in loc_pattern.finditer(body):
            url = match.group(1).strip()
            if url:
                urls.append(url)
        # Cap at 200 to avoid crawling enormous sitemaps
        return urls[:200]

    # ═════════════════════════════════════════════════════════════
    # Tech-stack fingerprinting
    # ═════════════════════════════════════════════════════════════

    def _fingerprint_headers(self, headers: dict):
        """Detect tech stack from response headers."""
        headers_lower = {k.lower(): v.lower() for k, v in headers.items()}
        all_headers_str = " ".join(f"{k}: {v}" for k, v in headers_lower.items())

        for tech, patterns in TECH_DETECTION.items():
            for pattern in patterns:
                if pattern.lower() in all_headers_str:
                    if tech not in self._detected_techs:
                        logger.info(f"Tech detected from headers: {tech}")
                    self._detected_techs.add(tech)

    def _fingerprint_body(self, body: str):
        """Detect tech stack from response body content."""
        body_lower = body.lower()[:10000]  # Only check first 10KB
        for tech, patterns in TECH_DETECTION.items():
            for pattern in patterns:
                if pattern.lower() in body_lower:
                    if tech not in self._detected_techs:
                        logger.info(f"Tech detected from body: {tech}")
                    self._detected_techs.add(tech)

    async def _probe_tech_paths(self, origin: str, auth_headers: dict | None = None) -> list[Endpoint]:
        """Probe known paths based on detected tech stack."""
        endpoints: list[Endpoint] = []

        # Always probe common paths (graphql, swagger, etc.)
        always_probe = ["/graphql", "/api-docs", "/swagger.json", "/v3/api-docs", "/openapi.json"]

        paths_to_probe: set[str] = set(always_probe)

        for tech in self._detected_techs:
            if tech in TECH_FINGERPRINTS:
                paths_to_probe.update(TECH_FINGERPRINTS[tech])

        for path in paths_to_probe:
            url = urljoin(origin, path)
            if self._scope and not self._scope.is_in_scope(url):
                continue
            result = await self._http.get(url, headers=auth_headers)
            if not result.error and result.status_code < 400:
                endpoints.append(Endpoint(
                    url=url, source=f"tech_probe:{','.join(self._detected_techs) or 'default'}"
                ))
                # If it's a swagger/openapi doc, extract endpoints from it
                if "json" in result.headers.get("content-type", ""):
                    api_urls = self._extract_from_openapi(url, result.body)
                    for api_url in api_urls:
                        endpoints.append(Endpoint(url=api_url, source=f"openapi:{url}"))

        if self._detected_techs:
            logger.info(f"Tech-stack probing: detected {self._detected_techs}, probed {len(paths_to_probe)} paths, found {len(endpoints)} endpoints")

        return endpoints

    def _extract_from_openapi(self, base_url: str, json_str: str) -> list[str]:
        """Extract API endpoints from OpenAPI/Swagger JSON docs."""
        urls: list[str] = []
        origin = f"{urlparse(base_url).scheme}://{urlparse(base_url).netloc}"
        try:
            doc = json.loads(json_str)
            # OpenAPI 3.x
            if "paths" in doc:
                for path in doc["paths"]:
                    urls.append(urljoin(origin, path))
            # Swagger 2.x with basePath
            base_path = doc.get("basePath", "")
            if base_path and "paths" in doc:
                for path in doc["paths"]:
                    urls.append(urljoin(origin, base_path.rstrip("/") + path))
        except (json.JSONDecodeError, TypeError):
            pass
        return urls

    # ═════════════════════════════════════════════════════════════
    # HTML comment mining
    # ═════════════════════════════════════════════════════════════

    def _extract_from_comments(self, base_url: str, html: str) -> list[str]:
        """Extract API URLs from HTML comments — devs leave gold in comments."""
        urls: list[str] = []
        soup = BeautifulSoup(html, "lxml")
        for comment in soup.find_all(string=lambda t: isinstance(t, Comment)):
            text = str(comment)
            # Extract any URL-like patterns from comments
            found = self._extract_api_patterns(base_url, text)
            urls.extend(found)
            # Also look for full URLs in comments
            full_url_pattern = re.compile(r'https?://[^\s"\'<>]+')
            for match in full_url_pattern.finditer(text):
                urls.append(match.group(0))
        return urls

    # ═════════════════════════════════════════════════════════════
    # Deep JS mining
    # ═════════════════════════════════════════════════════════════

    def _deep_js_mine(self, base_url: str, js_content: str) -> list[Endpoint]:
        """Deep analysis of JavaScript for hidden endpoints, configs, params."""
        endpoints: list[Endpoint] = []
        origin = f"{urlparse(base_url).scheme}://{urlparse(base_url).netloc}"

        # ── Config objects (API_URL, BASE_URL, etc.) ──
        config_patterns = [
            re.compile(r'(?:API_URL|BASE_URL|API_BASE|API_ENDPOINT|BACKEND_URL|SERVER_URL)\s*[=:]\s*["\']([^"\']+)["\']', re.IGNORECASE),
            re.compile(r'baseURL\s*[=:]\s*["\']([^"\']+)["\']'),
            re.compile(r'apiUrl\s*[=:]\s*["\']([^"\']+)["\']'),
        ]
        for pattern in config_patterns:
            for match in pattern.finditer(js_content):
                url = match.group(1)
                if url.startswith(("http://", "https://")):
                    endpoints.append(Endpoint(url=url, source=f"js_config:{base_url}"))
                elif url.startswith("/"):
                    endpoints.append(Endpoint(url=urljoin(origin, url), source=f"js_config:{base_url}"))

        # ── GraphQL queries/mutations ──
        gql_patterns = [
            re.compile(r'(?:query|mutation)\s+(\w+)', re.IGNORECASE),
            re.compile(r'gql\s*`[^`]*(?:query|mutation)\s+(\w+)', re.IGNORECASE),
        ]
        for pattern in gql_patterns:
            for match in pattern.finditer(js_content):
                # If we find GraphQL operations, add the graphql endpoint
                gql_url = urljoin(origin, "/graphql")
                endpoints.append(Endpoint(
                    url=gql_url, method="POST",
                    source=f"graphql_op:{match.group(1)}:{base_url}"
                ))

        # ── WebSocket URLs ──
        ws_pattern = re.compile(r'["\']wss?://([^"\']+)["\']')
        for match in ws_pattern.finditer(js_content):
            ws_url = f"https://{match.group(1)}"
            endpoints.append(Endpoint(url=ws_url, source=f"websocket:{base_url}"))

        # ── Route definitions (React Router, Vue Router, Angular) ──
        route_patterns = [
            re.compile(r'path\s*:\s*["\'](/[^"\']*)["\']'),
            re.compile(r'Route\s+path=["\'](/[^"\']*)["\']'),
            re.compile(r'router\.\w+\(["\'](/[^"\']*)["\']'),
        ]
        for pattern in route_patterns:
            for match in pattern.finditer(js_content):
                path = match.group(1)
                if not path.endswith(("*", ":")):  # Skip wildcards/params
                    endpoints.append(Endpoint(
                        url=urljoin(origin, path), source=f"route:{base_url}"
                    ))

        # ── Hidden form fields and parameter names ──
        param_pattern = re.compile(r'["\'](\w+(?:_id|Id|_key|Key|_token|Token|_secret|Secret|_hash|password|email|username|role|admin|debug|test))["\']')
        hidden_params: dict[str, str] = {}
        for match in param_pattern.finditer(js_content):
            param = match.group(1)
            hidden_params[param] = ""
        if hidden_params:
            logger.info(f"JS parameter mining: found {len(hidden_params)} interesting params in {base_url}")

        # ── Template string URLs (backtick interpolation) ──
        template_pattern = re.compile(r'`(/(?:api|v[12])/[^`]+)`')
        for match in template_pattern.finditer(js_content):
            template_url = match.group(1)
            # Replace ${...} with a placeholder
            clean_url = re.sub(r'\$\{[^}]+\}', '1', template_url)
            endpoints.append(Endpoint(
                url=urljoin(origin, clean_url), source=f"js_template:{base_url}"
            ))

        return endpoints

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
