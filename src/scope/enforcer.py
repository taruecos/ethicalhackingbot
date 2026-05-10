"""Scope enforcer — ensures all scan targets are within the authorized scope.

This is the compliance gate. Every URL must pass through here before being scanned.
If it's not in scope, it doesn't get touched. Period.

Scope entry syntax:
  - `example.com`              → exact hostname, any path
  - `*.example.com`            → wildcard hostname, any path
  - `example.com/api/*`        → hostname + path glob (fnmatch syntax)
  - `*.example.com/admin/*`    → wildcard hostname + path glob
  - `!example.com/admin/*`     → DENY entry (exclusion); denies always win over allows
  - `192.168.0.1`              → exact IP
"""

import fnmatch
import re
import logging
from urllib.parse import urlparse
from dataclasses import dataclass

logger = logging.getLogger("scope_enforcer")


@dataclass
class ScopeEntry:
    """A single scope entry — hostname pattern, optional path glob, optional deny flag."""
    pattern: str       # hostname pattern, e.g. "*.example.com", "api.example.com"
    entry_type: str    # "web", "api", "ip", "wildcard"
    path_glob: str | None = None  # path glob (fnmatch), None = any path
    exclude: bool = False         # True = deny entry (overrides allows)

    @classmethod
    def from_string(cls, raw: str) -> "ScopeEntry":
        """Parse a scope string into a ScopeEntry."""
        raw = raw.strip().lower()

        # Detect deny prefix
        exclude = False
        if raw.startswith("!"):
            exclude = True
            raw = raw[1:].strip()

        # Remove protocol if present
        raw = re.sub(r'^https?://', '', raw)

        # Split host vs path
        path_glob: str | None = None
        if '/' in raw:
            host_part, path_part = raw.split('/', 1)
            # Normalize path glob to start with '/'
            path_glob = '/' + path_part if path_part else '/*'
        else:
            host_part = raw

        # Strip port from host
        host_part = host_part.split(':')[0]

        if host_part.startswith("*."):
            entry_type = "wildcard"
        elif re.match(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$', host_part):
            entry_type = "ip"
        elif "api" in host_part:
            entry_type = "api"
        else:
            entry_type = "web"

        return cls(pattern=host_part, entry_type=entry_type, path_glob=path_glob, exclude=exclude)

    def _hostname_matches(self, hostname: str) -> bool:
        hostname = hostname.lower().split(':')[0]
        if self.entry_type == "wildcard":
            base = self.pattern[2:]  # remove "*."
            return hostname == base or hostname.endswith(f".{base}")
        return hostname == self.pattern

    def matches(self, hostname: str, path: str = "/") -> bool:
        """Check if a (hostname, path) pair matches this scope entry."""
        if not self._hostname_matches(hostname):
            return False
        if self.path_glob is None:
            return True
        return fnmatch.fnmatchcase(path or "/", self.path_glob)


class ScopeEnforcer:
    """Enforces scan scope — the compliance gate between discovery and scanning.

    Semantics:
      - Allow-listed by default (fail-closed): if no allow entries, everything is blocked.
      - Deny entries (prefixed with `!`) are checked first and always win.
      - At least one allow entry must match for a URL to be in scope.
    """

    def __init__(self, scope_entries: list[str]):
        """Initialize with a list of scope strings.

        Args:
            scope_entries: List of authorized domains/patterns.
                           e.g. ["*.example.com", "api.target.com", "!*.example.com/admin/*"]
        """
        self._entries = [ScopeEntry.from_string(s) for s in scope_entries if s.strip()]
        self._allow_entries = [e for e in self._entries if not e.exclude]
        self._deny_entries = [e for e in self._entries if e.exclude]
        self._blocked_count = 0
        self._allowed_count = 0

        if self._allow_entries:
            allow_desc = [f"{e.pattern}{e.path_glob or ''}" for e in self._allow_entries]
            deny_desc = [f"!{e.pattern}{e.path_glob or ''}" for e in self._deny_entries]
            logger.info(
                f"Scope enforcer initialized — {len(self._allow_entries)} allow, "
                f"{len(self._deny_entries)} deny. Allow: {allow_desc}. Deny: {deny_desc}"
            )
        else:
            logger.warning("Scope enforcer initialized with EMPTY allow scope — all URLs will be blocked")

    @property
    def stats(self) -> dict:
        return {
            "allowed": self._allowed_count,
            "blocked": self._blocked_count,
            "scope_entries": len(self._entries),
            "allow_entries": len(self._allow_entries),
            "deny_entries": len(self._deny_entries),
        }

    def is_in_scope(self, url: str) -> bool:
        """Check if a URL is within the authorized scope.

        Returns True only if:
          1. URL hostname matches at least one allow entry (with matching path glob), AND
          2. URL does not match any deny entry.

        If allow scope is empty, returns False (fail-closed).
        """
        if not self._allow_entries:
            self._blocked_count += 1
            return False

        try:
            parsed = urlparse(url if '://' in url else f'https://{url}')
            hostname = parsed.hostname
            path = parsed.path or "/"
            if not hostname:
                self._blocked_count += 1
                return False
        except Exception:
            self._blocked_count += 1
            return False

        # Deny entries always win
        for entry in self._deny_entries:
            if entry.matches(hostname, path):
                self._blocked_count += 1
                logger.debug(f"BLOCKED (deny rule: {entry.pattern}{entry.path_glob or ''}): {url}")
                return False

        # Must match at least one allow entry
        for entry in self._allow_entries:
            if entry.matches(hostname, path):
                self._allowed_count += 1
                return True

        self._blocked_count += 1
        logger.debug(f"BLOCKED (no allow match): {url}")
        return False

    def filter_urls(self, urls: list[str]) -> tuple[list[str], list[str]]:
        """Filter a list of URLs, returning (in_scope, out_of_scope)."""
        in_scope = []
        out_of_scope = []
        for url in urls:
            if self.is_in_scope(url):
                in_scope.append(url)
            else:
                out_of_scope.append(url)
        return in_scope, out_of_scope

    def filter_endpoints(self, endpoints: list) -> tuple[list, list]:
        """Filter Endpoint objects by their URL. Returns (in_scope, out_of_scope)."""
        in_scope = []
        out_of_scope = []
        for ep in endpoints:
            url = ep.url if hasattr(ep, 'url') else str(ep)
            if self.is_in_scope(url):
                in_scope.append(ep)
            else:
                out_of_scope.append(ep)
        return in_scope, out_of_scope
