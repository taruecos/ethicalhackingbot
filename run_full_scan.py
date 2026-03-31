"""Bridge module — connects dashboard_v3.py to the actual scanner (src/agent/run.py)."""

import asyncio
import json
import logging
from pathlib import Path
from datetime import datetime

logger = logging.getLogger("run_full_scan")


async def run_full_scan(
    domain: str,
    output_dir: str = "./results",
    phase_callback=None,
):
    """
    Run a full scan against a domain and return structured results.

    Args:
        domain: Target domain (e.g. "example.com")
        output_dir: Directory to store scan artifacts
        phase_callback: Optional async callback(phase_name) called when entering each phase

    Returns:
        dict with keys: findings, stats, duration
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    target_url = f"https://{domain}" if not domain.startswith("http") else domain
    findings = []
    stats = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}

    try:
        from src.agent.run import run_scan
        from src.utils.http_client import HttpClient

        # Phase: Recon
        if phase_callback:
            await phase_callback("recon")
        logger.info(f"Phase recon: crawling {target_url}")

        # Run the actual scanner
        if phase_callback:
            await phase_callback("scan")
        logger.info(f"Phase scan: running vulnerability checks on {target_url}")

        raw_findings = await run_scan(
            target_url=target_url,
            auth_headers=None,
            config={
                "scanner": {
                    "concurrency": 3,
                    "request_delay": 1.0,
                    "timeout": 30,
                    "max_crawl_depth": 3,
                },
                "reporter": {"output_dir": output_dir},
            },
        )

        # Phase: Analysis
        if phase_callback:
            await phase_callback("analysis")
        logger.info(f"Phase analysis: processing {len(raw_findings)} findings")

        # Convert findings to dashboard format
        for vuln_type, finding, analysis in raw_findings:
            severity = (analysis.severity_override or finding.severity or "INFO").upper()
            entry = {
                "module": vuln_type,
                "severity": severity,
                "confidence": analysis.confidence,
                "title": getattr(finding, "title", f"{vuln_type} finding"),
                "description": getattr(finding, "description", str(finding)),
                "url": getattr(finding, "url", target_url),
                "evidence": {
                    "request": getattr(finding, "request", None),
                    "response": getattr(finding, "response", None),
                    "details": getattr(finding, "details", None),
                },
            }
            findings.append(entry)

            sev_key = severity.lower()
            if sev_key in stats:
                stats[sev_key] += 1

        # Phase: Report
        if phase_callback:
            await phase_callback("report")
        logger.info(f"Phase report: generating report with {len(findings)} findings")

        # Save results to JSON
        report = {
            "domain": domain,
            "target_url": target_url,
            "scan_date": datetime.now().isoformat(),
            "findings": findings,
            "stats": stats,
            "total_findings": len(findings),
        }
        report_path = output_path / f"{domain.replace('.', '_')}_report.json"
        report_path.write_text(json.dumps(report, indent=2, default=str))
        logger.info(f"Report saved to {report_path}")

    except ImportError as e:
        logger.error(f"Scanner modules not available: {e}")
        raise RuntimeError(f"Scanner modules not available: {e}") from e

    except Exception as e:
        logger.error(f"Scan failed: {e}")
        raise

    return {
        "findings": findings,
        "stats": stats,
        "total_findings": len(findings),
    }
