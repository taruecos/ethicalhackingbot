"""Main agent runner — orchestrates recon, scanning, and reporting."""

import asyncio
import logging
from pathlib import Path

import click
from rich.console import Console
from rich.logging import RichHandler
from rich.panel import Panel
from rich.table import Table

from src.utils.http_client import HttpClient
from src.recon.crawler import EndpointCrawler
from src.scanner.idor import IDORScanner, IDORCandidate, IDORType
from src.scanner.access_control import AccessControlScanner
from src.scanner.info_disclosure import InfoDisclosureScanner
from src.agent.brain import AgentBrain

console = Console()
logger = logging.getLogger("agent")


async def run_scan(
    target_url: str,
    auth_headers: dict | None = None,
    config: dict | None = None,
):
    """Run a full scan against a target."""
    config = config or {}
    scanner_config = config.get("scanner", {})
    findings = []

    console.print(Panel(f"[bold]Target: {target_url}[/bold]", title="Ethical Hacking Bot"))

    # Phase 1: Reconnaissance
    console.print("\n[bold cyan]Phase 1: Reconnaissance[/bold cyan]")
    async with HttpClient(
        concurrency=scanner_config.get("concurrency", 5),
        request_delay=scanner_config.get("request_delay", 1.0),
        timeout=scanner_config.get("timeout", 30),
    ) as http:
        crawler = EndpointCrawler(http, max_depth=scanner_config.get("max_crawl_depth", 3))
        endpoints = await crawler.crawl(target_url, auth_headers)
        console.print(f"  Discovered {len(endpoints)} endpoints")

        if not endpoints:
            console.print("[yellow]  No endpoints found. Check target URL and auth.[/yellow]")
            return []

        # Phase 2: AI Analysis
        console.print("\n[bold cyan]Phase 2: AI Analysis[/bold cyan]")
        brain = AgentBrain(model=config.get("agent", {}).get("model", "claude-sonnet-4-20250514"))
        plan = brain.analyze_endpoints(endpoints, f"Target: {target_url}")
        console.print(f"  Priority endpoints: {len(plan.priority_endpoints)}")
        console.print(f"  IDOR candidates: {len(plan.idor_candidates)}")
        console.print(f"  Notes: {plan.notes}")

        # Phase 3: Scanning
        console.print("\n[bold cyan]Phase 3: Scanning[/bold cyan]")
        modules = scanner_config.get("modules", {})

        # IDOR scan
        if modules.get("idor", True):
            console.print("  [dim]Running IDOR scanner...[/dim]")
            idor_scanner = IDORScanner(http)

            # Use AI-identified candidates + auto-detected ones
            all_candidates = list(plan.idor_candidates)
            for ep in endpoints:
                path_ids = idor_scanner.extract_path_ids(ep.url)
                for id_val, _ in path_ids:
                    all_candidates.append(IDORCandidate(
                        url=ep.url,
                        method=ep.method,
                        id_type=IDORType.PATH_ID,
                        id_param="path",
                        original_id=id_val,
                        test_ids=idor_scanner.generate_test_ids(id_val),
                    ))

            for candidate in all_candidates:
                finding = await idor_scanner.test_idor(candidate, auth_headers or {})
                if finding:
                    # Validate with AI
                    analysis = brain.validate_finding(finding, {"candidate": candidate.__dict__})
                    if analysis.is_valid and analysis.confidence > 0.6:
                        findings.append(("idor", finding, analysis))
                        console.print(f"  [bold red]IDOR FOUND: {finding.url} ({finding.severity})[/bold red]")

        # Access control scan
        if modules.get("access_control", True):
            console.print("  [dim]Running access control scanner...[/dim]")
            ac_scanner = AccessControlScanner(http)
            ac_findings = await ac_scanner.probe_admin_paths(target_url, user_headers=auth_headers)

            for finding in ac_findings:
                analysis = brain.validate_finding(finding, {})
                if analysis.is_valid and analysis.confidence > 0.6:
                    findings.append(("access_control", finding, analysis))
                    console.print(f"  [bold red]ACCESS CONTROL: {finding.url} ({finding.severity})[/bold red]")

        # Info disclosure scan
        if modules.get("info_disclosure", True):
            console.print("  [dim]Running info disclosure scanner...[/dim]")
            id_scanner = InfoDisclosureScanner(http)
            id_findings = await id_scanner.probe_disclosure_endpoints(target_url)

            for finding in id_findings:
                analysis = brain.validate_finding(finding, {})
                if analysis.is_valid and analysis.confidence > 0.6:
                    findings.append(("info_disclosure", finding, analysis))
                    console.print(f"  [bold yellow]INFO DISCLOSURE: {finding.url} ({finding.severity})[/bold yellow]")

    # Phase 4: Results
    console.print(f"\n[bold cyan]Phase 4: Results[/bold cyan]")
    if findings:
        table = Table(title="Findings Summary")
        table.add_column("Type", style="cyan")
        table.add_column("URL", style="white")
        table.add_column("Severity", style="red")
        table.add_column("Confidence", style="yellow")

        for vuln_type, finding, analysis in findings:
            table.add_row(
                vuln_type,
                finding.url[:60],
                analysis.severity_override or finding.severity,
                f"{analysis.confidence:.0%}",
            )

        console.print(table)

        # Generate reports
        console.print("\n[bold cyan]Generating reports...[/bold cyan]")
        reports_dir = Path(config.get("reporter", {}).get("output_dir", "./reports"))
        reports_dir.mkdir(parents=True, exist_ok=True)

        for i, (vuln_type, finding, analysis) in enumerate(findings):
            report = brain.generate_report(finding, analysis, {"name": target_url})
            report_path = reports_dir / f"finding_{i+1}_{vuln_type}.md"
            report_path.write_text(report)
            console.print(f"  Report saved: {report_path}")
    else:
        console.print("  [green]No confirmed vulnerabilities found.[/green]")

    return findings


@click.command()
@click.option("--target", "-t", required=True, help="Target URL to scan")
@click.option("--auth-token", "-a", default=None, help="Authorization bearer token")
@click.option("--cookie", "-c", default=None, help="Session cookie")
@click.option("--config", "config_path", default="config/config.yaml", help="Config file path")
def main(target: str, auth_token: str | None, cookie: str | None, config_path: str):
    """Run the ethical hacking agent against a target."""
    import yaml

    logging.basicConfig(
        level=logging.INFO,
        handlers=[RichHandler(console=console, rich_tracebacks=True)],
    )

    # Load config
    config = {}
    config_file = Path(config_path)
    if config_file.exists():
        with open(config_file) as f:
            config = yaml.safe_load(f) or {}

    # Build auth headers
    auth_headers = {}
    if auth_token:
        auth_headers["Authorization"] = f"Bearer {auth_token}"
    if cookie:
        auth_headers["Cookie"] = cookie

    # Run
    asyncio.run(run_scan(target, auth_headers, config))


if __name__ == "__main__":
    main()
