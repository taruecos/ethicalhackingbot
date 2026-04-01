"""Scope enforcer — ensures all scan targets are within the authorized scope.

This is the compliance gate. Every URL must pass through here before being scanned.
If it's not in scope, it doesn't get touched. Period.
"""

import re
import logging
from urllib.parse import urlparse
from dataclasses import dataclass

logger = logging.getLogger("scope_enforcer")


@dataclass
class ScopeEntry:
    """A single scope entry — a domain or pattern that is authorized for scanning."""
    pattern: str       # e.g. "*.example.com", "api.example.com", "example.com"
    entry_type: str    # "web", "api", "ip", "wildcard"

    @classmethod
    def from_string(cls, raw: str) -> "ScopeEntry":
        """Parse a scope string into a ScopeEntry."""
        raw = raw.strip().lower()
        # Remove protocol if present
        raw = re.sub(r'^https?://', '', raw)
        # Remove trailing slash/path
        raw = raw.split('/')[0]
        # Remove port
        raw = raw.split(':')[0]

        if raw.startswith("*."):
            return cls(pattern=raw, entry_type="wildcard")
        elif re.match(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$', raw):
            return cls(pattern=raw, entry_type="ip")
        elif "api" in raw:
            return cls(pattern=raw, entry_type="api")
        else:
            return cls(pattern=raw, entry_type="web")

    def matches(self, hostname: str) -> bool:
        """Check if a hostname matches this scope entry."""
        hostname = hostname.lower().split(':')[0]

        if self.entry_type == "wildcard":
            # *.example.com matches sub.example.com and example.com
            base = self.pattern[2:]  # remove "*."
            return hostname == base or hostname.endswith(f".{base}")
        else:
            # Exact match
            return hostname == self.pattern


class ScopeEnforcer:
    """Enforces scan scope — the compliance gate between discovery and scanning."""

    def __init__(self, scope_entries: list[str]):
        """Initialize with a list of scope strings.

        Args:
            scope_entries: List of authorized domains/patterns.
                           e.g. ["*.example.com", "api.target.com"]
        """
        self._entries = [ScopeEntry.from_string(s) for s in scope_entries if s.strip()]
        self._blocked_count = 0
        self._allowed_count = 0

        if self._entries:
            logger.info(f"Scope enforcer initialized with {len(self._entries)} entries: "
                        f"{[e.pattern for e in self._entries]}")
        else:
            logger.warning("Scope enforcer initialized with EMPTY scope — all URLs will be blocked")

    @property
    def stats(self) -> dict:
        return {
            "allowed": self._allowed_count,
            "blocked": self._blocked_count,
            "scope_entries": len(self._entries),
        }

    def is_in_scope(self, url: str) -> bool:
        """Check if a URL is within the authorized scope.

        Returns True only if the URL's hostname matches at least one scope entry.
        If scope is empty, returns False (fail-closed).
        """
        if not self._entries:
            self._blocked_count += 1
            return False

        try:
            parsed = urlparse(url if '://' in url else f'https://{url}')
            hostname = parsed.hostname
            if not hostname:
                self._blocked_count += 1
                return False
        except Exception:
            self._blocked_count += 1
            return False

        for entry in self._entries:
            if entry.matches(hostname):
                self._allowed_count += 1
                return True

        self._blocked_count += 1
        logger.debug(f"BLOCKED (out of scope): {url}")
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
