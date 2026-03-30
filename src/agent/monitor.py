"""Program monitor — watches bug bounty platforms for new programs.

This is the speed advantage: detect new programs within minutes,
scan them before other hunters get there.
"""

import asyncio
import logging
from datetime import datetime

from src.utils.http_client import HttpClient

logger = logging.getLogger("monitor")


class ProgramMonitor:
    """Monitors bug bounty platforms for new and updated programs."""

    def __init__(self, config: dict):
        self._config = config
        self._known_programs: set[str] = set()
        self._check_interval = 300  # 5 minutes

    async def start(self):
        """Start monitoring loop."""
        logger.info("Starting program monitor...")

        while True:
            try:
                new_programs = await self._check_all_platforms()

                for program in new_programs:
                    logger.info(f"NEW PROGRAM: {program['name']} on {program['platform']}")
                    logger.info(f"  Scope: {program.get('scope', 'unknown')}")
                    logger.info(f"  Bounty range: {program.get('bounty_range', 'unknown')}")
                    # TODO: auto-trigger scan on new programs

            except Exception as e:
                logger.error(f"Monitor error: {e}")

            await asyncio.sleep(self._check_interval)

    async def _check_all_platforms(self) -> list[dict]:
        """Check all enabled platforms for new programs."""
        new_programs = []
        platforms = self._config.get("platforms", {})

        async with HttpClient(concurrency=2, request_delay=2.0) as http:
            if platforms.get("intigriti", {}).get("enabled"):
                programs = await self._check_intigriti(http)
                new_programs.extend(programs)

            if platforms.get("hackerone", {}).get("enabled"):
                programs = await self._check_hackerone(http)
                new_programs.extend(programs)

        return new_programs

    async def _check_intigriti(self, http: HttpClient) -> list[dict]:
        """Check Intigriti for new programs."""
        new_programs = []

        # Intigriti public API endpoint for programs
        result = await http.get(
            "https://app.intigriti.com/api/core/researcher/programs",
            headers={"Accept": "application/json"},
        )

        if result.status_code == 200:
            try:
                import json
                programs = json.loads(result.body)

                for prog in programs if isinstance(programs, list) else []:
                    prog_id = prog.get("programId", prog.get("id", ""))
                    if prog_id and prog_id not in self._known_programs:
                        self._known_programs.add(prog_id)
                        new_programs.append({
                            "platform": "intigriti",
                            "id": prog_id,
                            "name": prog.get("name", "Unknown"),
                            "scope": prog.get("domains", []),
                            "bounty_range": prog.get("maxBounty", "Unknown"),
                        })
            except Exception as e:
                logger.error(f"Intigriti parse error: {e}")

        return new_programs

    async def _check_hackerone(self, http: HttpClient) -> list[dict]:
        """Check HackerOne for new programs."""
        new_programs = []
        api_config = self._config.get("platforms", {}).get("hackerone", {})

        result = await http.get(
            "https://api.hackerone.com/v1/hackers/programs",
            headers={
                "Accept": "application/json",
            },
        )

        if result.status_code == 200:
            try:
                import json
                data = json.loads(result.body)

                for prog in data.get("data", []):
                    prog_id = prog.get("id", "")
                    attrs = prog.get("attributes", {})
                    if prog_id and prog_id not in self._known_programs:
                        self._known_programs.add(prog_id)
                        new_programs.append({
                            "platform": "hackerone",
                            "id": prog_id,
                            "name": attrs.get("name", "Unknown"),
                            "scope": attrs.get("structured_scopes", []),
                            "bounty_range": attrs.get("bounty_range", "Unknown"),
                        })
            except Exception as e:
                logger.error(f"HackerOne parse error: {e}")

        return new_programs
