"""AI Agent brain — uses LLM to analyze targets and make scanning decisions."""

import json
from dataclasses import dataclass

import anthropic

from src.recon.crawler import Endpoint
from src.scanner.idor import IDORCandidate, IDORFinding, IDORType
from src.scanner.access_control import AccessControlFinding
from src.scanner.info_disclosure import InfoDisclosureFinding


@dataclass
class ScanPlan:
    """Agent's plan for scanning a target."""
    target_url: str
    priority_endpoints: list[Endpoint]
    idor_candidates: list[IDORCandidate]
    notes: str


@dataclass
class FindingAnalysis:
    """Agent's analysis of a potential finding."""
    is_valid: bool
    confidence: float  # 0-1
    severity_override: str | None
    report_text: str
    reasoning: str


class AgentBrain:
    """LLM-powered decision engine for the scanning agent."""

    def __init__(self, model: str = "claude-sonnet-4-20250514"):
        self._client = anthropic.Anthropic()
        self._model = model

    def analyze_endpoints(self, endpoints: list[Endpoint], target_context: str) -> ScanPlan:
        """Analyze discovered endpoints and create a scan plan."""
        endpoint_list = "\n".join(
            f"- {ep.method} {ep.url} (source: {ep.source})"
            for ep in endpoints[:100]  # cap to avoid token limits
        )

        response = self._client.messages.create(
            model=self._model,
            max_tokens=4096,
            system=(
                "You are an expert bug bounty hunter AI assistant. "
                "Analyze the discovered endpoints and identify the most promising targets "
                "for IDOR, broken access control, and information disclosure vulnerabilities. "
                "Focus on endpoints that handle user data, have ID parameters, or seem like admin routes."
            ),
            messages=[{
                "role": "user",
                "content": (
                    f"Target context: {target_context}\n\n"
                    f"Discovered endpoints:\n{endpoint_list}\n\n"
                    "Respond in JSON format:\n"
                    "{\n"
                    '  "priority_endpoints": [{"url": "...", "reason": "...", "vuln_type": "idor|access|disclosure"}],\n'
                    '  "idor_candidates": [{"url": "...", "id_param": "...", "id_type": "path_id|query_id|body_id"}],\n'
                    '  "notes": "overall assessment"\n'
                    "}"
                ),
            }],
        )

        return self._parse_scan_plan(response.content[0].text, endpoints)

    def validate_finding(
        self,
        finding: IDORFinding | AccessControlFinding | InfoDisclosureFinding,
        raw_evidence: dict,
    ) -> FindingAnalysis:
        """Use LLM to validate a finding and reduce false positives."""
        response = self._client.messages.create(
            model=self._model,
            max_tokens=2048,
            system=(
                "You are an expert bug bounty triage specialist. "
                "Analyze the potential vulnerability finding and determine: "
                "1. Is this a true positive or false positive? "
                "2. What is the real severity? "
                "3. Draft a clear, professional bug report description. "
                "Be conservative — false reports damage reputation on platforms."
            ),
            messages=[{
                "role": "user",
                "content": (
                    f"Finding type: {type(finding).__name__}\n"
                    f"Description: {finding.description}\n"
                    f"Severity claimed: {finding.severity}\n"
                    f"Evidence: {json.dumps(finding.evidence, indent=2)}\n"
                    f"Raw data: {json.dumps(raw_evidence, indent=2)}\n\n"
                    "Respond in JSON:\n"
                    "{\n"
                    '  "is_valid": true/false,\n'
                    '  "confidence": 0.0-1.0,\n'
                    '  "severity_override": null or "low"/"medium"/"high"/"critical",\n'
                    '  "report_text": "professional bug report description",\n'
                    '  "reasoning": "why you think this is/isn\'t valid"\n'
                    "}"
                ),
            }],
        )

        return self._parse_finding_analysis(response.content[0].text)

    def generate_report(
        self,
        finding: IDORFinding | AccessControlFinding | InfoDisclosureFinding,
        analysis: FindingAnalysis,
        target_info: dict,
    ) -> str:
        """Generate a professional bug report ready for submission."""
        response = self._client.messages.create(
            model=self._model,
            max_tokens=4096,
            system=(
                "You are a professional bug bounty report writer. "
                "Write clear, concise, and professional vulnerability reports "
                "following the standard format: Summary, Impact, Steps to Reproduce, "
                "Proof of Concept, Remediation. Use markdown formatting."
            ),
            messages=[{
                "role": "user",
                "content": (
                    f"Vulnerability type: {type(finding).__name__}\n"
                    f"Target: {target_info.get('name', 'Unknown')}\n"
                    f"Platform: {target_info.get('platform', 'Unknown')}\n"
                    f"URL: {finding.url}\n"
                    f"Severity: {analysis.severity_override or finding.severity}\n"
                    f"Analysis: {analysis.report_text}\n"
                    f"Evidence: {json.dumps(finding.evidence, indent=2)}\n\n"
                    "Write a professional bug bounty report in markdown. "
                    "Include: Summary, Severity, Impact, Steps to Reproduce, "
                    "Expected vs Actual Behavior, Proof of Concept, Remediation Suggestions."
                ),
            }],
        )

        return response.content[0].text

    def _parse_scan_plan(self, llm_response: str, endpoints: list[Endpoint]) -> ScanPlan:
        """Parse LLM response into a ScanPlan."""
        try:
            # Extract JSON from response (handle markdown code blocks)
            json_str = llm_response
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0]
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0]

            data = json.loads(json_str.strip())

            priority_eps = []
            for ep_data in data.get("priority_endpoints", []):
                matching = [e for e in endpoints if ep_data["url"] in e.url]
                priority_eps.extend(matching[:1])

            idor_candidates = []
            for cand_data in data.get("idor_candidates", []):
                idor_candidates.append(IDORCandidate(
                    url=cand_data["url"],
                    method="GET",
                    id_type=IDORType(cand_data.get("id_type", "path_id")),
                    id_param=cand_data.get("id_param", "id"),
                    original_id="1",
                    test_ids=["2", "3", "0", "999"],
                ))

            return ScanPlan(
                target_url=endpoints[0].url if endpoints else "",
                priority_endpoints=priority_eps,
                idor_candidates=idor_candidates,
                notes=data.get("notes", ""),
            )
        except (json.JSONDecodeError, KeyError, IndexError):
            # Fallback — scan all endpoints
            return ScanPlan(
                target_url=endpoints[0].url if endpoints else "",
                priority_endpoints=endpoints[:20],
                idor_candidates=[],
                notes="LLM parse failed — scanning all endpoints",
            )

    def _parse_finding_analysis(self, llm_response: str) -> FindingAnalysis:
        """Parse LLM response into a FindingAnalysis."""
        try:
            json_str = llm_response
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0]
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0]

            data = json.loads(json_str.strip())
            return FindingAnalysis(
                is_valid=data.get("is_valid", False),
                confidence=data.get("confidence", 0.0),
                severity_override=data.get("severity_override"),
                report_text=data.get("report_text", ""),
                reasoning=data.get("reasoning", ""),
            )
        except (json.JSONDecodeError, KeyError):
            return FindingAnalysis(
                is_valid=False,
                confidence=0.0,
                severity_override=None,
                report_text="",
                reasoning="Failed to parse LLM analysis",
            )
