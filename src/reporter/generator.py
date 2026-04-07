"""Scan report generator — produces structured reports from scan findings."""

from datetime import datetime, timezone
from typing import Any


def generate_scan_report(
    scan_id: str,
    target: str,
    findings: list[dict[str, Any]],
    duration: float | None = None,
    modules: list[str] | None = None,
    scope: list[str] | None = None,
) -> dict[str, Any]:
    """Generate a structured scan report from findings.

    Returns a dict with summary stats and formatted findings,
    suitable for JSON export or markdown rendering.
    """
    severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}
    sorted_findings = sorted(
        findings,
        key=lambda f: severity_order.get(f.get("severity", "INFO").upper(), 99),
    )

    stats = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0, "total": len(findings)}
    for f in findings:
        sev = f.get("severity", "INFO").lower()
        if sev in stats:
            stats[sev] += 1

    return {
        "meta": {
            "scan_id": scan_id,
            "target": target,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "duration_seconds": duration,
            "modules_run": modules or [],
            "scope": scope or [],
        },
        "stats": stats,
        "findings": [
            {
                "severity": f.get("severity", "INFO"),
                "module": f.get("module", "unknown"),
                "title": f.get("title", "Untitled"),
                "description": f.get("description", ""),
                "url": f.get("url"),
                "confidence": f.get("confidence", 0.5),
                "evidence": f.get("evidence"),
                "cwe_id": f.get("cwe_id"),
            }
            for f in sorted_findings
        ],
    }


def render_markdown(report: dict[str, Any]) -> str:
    """Render a scan report as markdown text."""
    meta = report["meta"]
    stats = report["stats"]
    lines = [
        f"# Scan Report — {meta['target']}",
        f"**Scan ID:** `{meta['scan_id']}`  ",
        f"**Generated:** {meta['generated_at']}  ",
    ]
    if meta["duration_seconds"]:
        lines.append(f"**Duration:** {meta['duration_seconds']:.1f}s  ")
    if meta["modules_run"]:
        lines.append(f"**Modules:** {', '.join(meta['modules_run'])}  ")

    lines.append("")
    lines.append("## Summary")
    lines.append(f"| Severity | Count |")
    lines.append(f"|----------|-------|")
    for sev in ["critical", "high", "medium", "low", "info"]:
        if stats[sev] > 0:
            lines.append(f"| {sev.upper()} | {stats[sev]} |")
    lines.append(f"| **Total** | **{stats['total']}** |")

    lines.append("")
    lines.append("## Findings")

    for i, f in enumerate(report["findings"], 1):
        lines.append(f"### {i}. [{f['severity']}] {f['title']}")
        lines.append(f"**Module:** {f['module']} | **Confidence:** {f['confidence']:.0%}")
        if f.get("url"):
            lines.append(f"**URL:** `{f['url']}`")
        if f.get("cwe_id"):
            lines.append(f"**CWE:** {f['cwe_id']}")
        lines.append("")
        lines.append(f.get("description", ""))
        lines.append("")

    return "\n".join(lines)
