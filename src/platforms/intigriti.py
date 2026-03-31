"""Intigriti Researcher API Connector"""
import os
import httpx
from pathlib import Path
from typing import Optional

BASE_URL = "https://api.intigriti.com/external/researcher/v1"


def _load_token_from_config() -> str:
    """Fallback: read token from config.yaml if env var not set."""
    try:
        import yaml
        config_path = Path(__file__).parent.parent.parent / "config" / "config.yaml"
        if config_path.exists():
            data = yaml.safe_load(config_path.read_text())
            return data.get("platforms", {}).get("intigriti", {}).get("api_key", "")
    except Exception:
        pass
    return ""


class IntigritiClient:
    """Client for the Intigriti Researcher API (v1.0 Beta)."""

    def __init__(self, api_token: Optional[str] = None):
        self.token = api_token or os.environ.get("INTIGRITI_API_TOKEN", "") or _load_token_from_config()
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/json",
        }

    async def _get(self, path: str, params: Optional[dict] = None) -> dict:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{BASE_URL}{path}",
                headers=self.headers,
                params=params or {},
            )
            resp.raise_for_status()
            return resp.json()

    async def get_programs(
        self,
        status_id: Optional[int] = None,
        type_id: Optional[int] = None,
        following: Optional[bool] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> dict:
        """List all programs accessible to the researcher."""
        params = {"limit": limit, "offset": offset}
        if status_id is not None:
            params["statusId"] = status_id
        if type_id is not None:
            params["typeId"] = type_id
        if following is not None:
            params["following"] = str(following).lower()
        return await self._get("/programs", params)

    async def get_program_detail(self, program_id: str) -> dict:
        """Get full program details including scope and rules."""
        return await self._get(f"/programs/{program_id}")

    async def get_activities(
        self,
        created_since: Optional[int] = None,
        following: Optional[bool] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        """Get recent program activities (scope/rule changes)."""
        params = {"limit": limit, "offset": offset}
        if created_since is not None:
            params["createdSince"] = created_since
        if following is not None:
            params["following"] = str(following).lower()
        return await self._get("/programs/activities", params)

    async def get_payouts(
        self,
        status_id: Optional[int] = None,
        created_since: Optional[int] = None,
        paid_since: Optional[int] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> dict:
        """Get all payouts (beta)."""
        params = {"limit": limit, "offset": offset}
        if status_id is not None:
            params["statusId"] = status_id
        if created_since is not None:
            params["createdSince"] = created_since
        if paid_since is not None:
            params["paidSince"] = paid_since
        return await self._get("/payouts", params)

    async def get_program_domains(self, program_id: str, version_id: str) -> dict:
        """Get specific version of program domains/scope."""
        return await self._get(f"/programs/{program_id}/domains/{version_id}")

    async def get_program_rules(self, program_id: str, version_id: str) -> dict:
        """Get specific version of rules of engagement."""
        return await self._get(
            f"/programs/{program_id}/rules-of-engagements/{version_id}"
        )

    def extract_compliance(self, program_detail: dict) -> dict:
        """Extract compliance/rules of engagement info from program detail."""
        roe = program_detail.get("rulesOfEngagement") or {}
        # ROE uses version wrapper: {id, createdAt, content: {...}}
        content = roe.get("content") if isinstance(roe, dict) else {}
        if content is None:
            content = {}

        testing = {}
        if isinstance(content, dict):
            testing = content.get("testingRequirements") or {}

        automated = testing.get("automatedTooling")
        # automatedTooling enum: null=unspecified, 1=allowed, 0=not allowed
        if automated is None:
            tooling_status = "unknown"
        elif automated == 1:
            tooling_status = "allowed"
        elif automated == 0:
            tooling_status = "not_allowed"
        else:
            tooling_status = "conditional"

        return {
            "automated_tooling": automated,
            "automated_tooling_status": tooling_status,
            "safe_harbour": content.get("safeHarbour", False) if isinstance(content, dict) else False,
            "user_agent": testing.get("userAgent"),
            "request_header": testing.get("requestHeader"),
            "description": content.get("description", "") if isinstance(content, dict) else "",
            "intigriti_me": testing.get("intigritiMe", False),
        }

    def normalize_program(self, raw: dict) -> dict:
        """Convert Intigriti API program to our DB schema format."""
        domains = []
        if "domains" in raw and "content" in raw.get("domains", {}):
            for d in raw["domains"]["content"]:
                domains.append({
                    "id": d.get("id", ""),
                    "type": d.get("type", {}).get("value", "url"),
                    "asset": d.get("endpoint", ""),
                    "tier": d.get("tier", {}).get("value", ""),
                    "description": d.get("description", ""),
                })

        min_bounty = raw.get("minBounty", {})
        max_bounty = raw.get("maxBounty", {})

        # Extract compliance if rulesOfEngagement is present (detail endpoint)
        compliance = self.extract_compliance(raw) if raw.get("rulesOfEngagement") else None

        return {
            "platform": "INTIGRITI",
            "name": raw.get("name", ""),
            "slug": raw.get("handle", ""),
            "url": raw.get("webLinks", {}).get("detail", ""),
            "intigriti_id": raw.get("id", ""),
            "scope": domains,
            "min_bounty": min_bounty.get("value") if isinstance(min_bounty, dict) else None,
            "max_bounty": max_bounty.get("value") if isinstance(max_bounty, dict) else None,
            "currency": max_bounty.get("currency", "EUR") if isinstance(max_bounty, dict) else "EUR",
            "status": raw.get("status", {}).get("value", ""),
            "type": raw.get("type", {}).get("value", ""),
            "confidentiality": raw.get("confidentialityLevel", {}).get("value", ""),
            "following": raw.get("following", False),
            "industry": raw.get("industry", ""),
            "compliance": compliance,
        }

    async def fetch_all_programs_normalized(self) -> list[dict]:
        """Fetch all programs and normalize them."""
        all_programs = []
        offset = 0
        limit = 100
        while True:
            data = await self.get_programs(limit=limit, offset=offset)
            records = data.get("records", [])
            if not records:
                break
            for r in records:
                all_programs.append(self.normalize_program(r))
            if len(records) < limit:
                break
            offset += limit
        return all_programs
