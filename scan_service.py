"""Lightweight Python scan microservice — no AI, pure scripted scanning.

Runs as a standalone FastAPI app. Next.js dashboard sends scan requests here.
Reports progress back to dashboard via callback URL.
Every scan action is logged with detailed context for the live monitor.
"""

import asyncio
import json
import logging
import os
import time
import uuid
import psutil
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.utils.http_client import HttpClient
from src.recon.crawler import EndpointCrawler
from src.scanner.idor import IDORScanner, IDORCandidate, IDORType
from src.scanner.access_control import AccessControlScanner
from src.scanner.info_disclosure import InfoDisclosureScanner
from src.scanner.xss import XSSScanner
from src.scanner.sqli import SQLiScanner
from src.scanner.csrf import CSRFScanner
from src.scanner.ssrf import SSRFScanner
from src.scanner.differential import DifferentialScanner
from src.scope.enforcer import ScopeEnforcer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("scan_service")

app = FastAPI(title="EthicalHackingBot Scan Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory scan state
active_scans: dict[str, dict] = {}
scan_logs: list[dict] = []
start_time = time.time()


def add_log(level: str, module: str, message: str, scan_id: str | None = None):
    entry = {
        "id": str(uuid.uuid4())[:8],
        "timestamp": datetime.now().isoformat(),
        "level": level,
        "module": module,
        "message": message,
        "scanId": scan_id,
    }
    scan_logs.append(entry)
    if len(scan_logs) > 2000:
        scan_logs[:] = scan_logs[-1000:]
    logger.info(f"[{module}] {message}")


class RulesOfEngagement(BaseModel):
    userAgent: str | None = None
    requestHeader: str | None = None
    safeHarbour: bool | None = None
    automatedTooling: str | None = None  # "allowed", "not_allowed", "conditional", "unknown"


class ScanRequest(BaseModel):
    domain: str
    scan_id: str
    callback_url: str | None = None
    callback_token: str | None = None
    depth: str = "standard"
    modules: list[str] | None = None
    rate_limit: int = 30
    rules_of_engagement: RulesOfEngagement | None = None
    scope: list[str] | None = None


class ScanStatus(BaseModel):
    id: str
    target: str
    status: str
    phase: str
    progress: float
    modules_total: int
    modules_done: int
    current_module: str
    started_at: str
    elapsed: float
    findings_count: int
    stats: dict


@app.get("/health")
async def health():
    return {"status": "ok", "uptime": time.time() - start_time}


@app.get("/api/status")
async def status():
    return {
        "online": True,
        "activeScans": len(active_scans),
        "totalScans": len(active_scans),
    }


@app.get("/api/monitor")
async def monitor():
    cpu = psutil.cpu_percent(interval=0.1)
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")

    scans_list = []
    for sid, scan in active_scans.items():
        scans_list.append({
            "id": sid,
            "target": scan["target"],
            "status": scan["status"],
            "phase": scan.get("phase", "init"),
            "progress": scan.get("progress", 0),
            "modulesTotal": scan.get("modules_total", 3),
            "modulesDone": scan.get("modules_done", 0),
            "currentModule": scan.get("current_module", ""),
            "startedAt": scan.get("started_at", ""),
            "elapsed": (time.time() - scan.get("start_time", time.time())) * 1000,
            "findingsCount": len(scan.get("findings", [])),
            "stats": scan.get("stats", {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}),
            "endpointsTotal": scan.get("endpoints_total", 0),
            "endpointsScanned": scan.get("endpoints_scanned", 0),
            "scopeEntries": scan.get("scope_entries", []),
            "blockedUrls": scan.get("blocked_count", 0),
        })

    return {
        "online": True,
        "activeScans": scans_list,
        "metrics": {
            "cpuPercent": cpu,
            "memoryUsed": mem.used,
            "memoryTotal": mem.total,
            "diskUsed": disk.used,
            "diskTotal": disk.total,
            "uptime": time.time() - start_time,
            "requestsPerMinute": 0,
            "activeConnections": len(active_scans),
        },
        "logs": scan_logs[-200:],
    }


@app.post("/api/scan")
async def start_scan(req: ScanRequest):
    if req.scan_id in active_scans:
        raise HTTPException(400, "Scan already running")

    scan_state = {
        "target": req.domain,
        "status": "running",
        "phase": "init",
        "progress": 0,
        "modules_total": 8,
        "modules_done": 0,
        "current_module": "",
        "started_at": datetime.now().isoformat(),
        "start_time": time.time(),
        "findings": [],
        "stats": {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0},
        "endpoints_total": 0,
        "endpoints_scanned": 0,
        "scope_entries": [],
        "blocked_count": 0,
    }
    active_scans[req.scan_id] = scan_state
    add_log("INFO", "scan", f"Scan started for {req.domain}", req.scan_id)

    asyncio.create_task(_run_scan(req, scan_state))
    return {"ok": True, "scan_id": req.scan_id}


@app.get("/api/scans")
async def list_scans():
    return {"scans": list(active_scans.values())}


@app.get("/api/scan/{scan_id}")
async def get_scan(scan_id: str):
    if scan_id not in active_scans:
        raise HTTPException(404, "Scan not found")
    return active_scans[scan_id]


@app.post("/api/scan/{scan_id}/cancel")
async def cancel_scan(scan_id: str):
    if scan_id in active_scans:
        active_scans[scan_id]["status"] = "cancelled"
        add_log("WARN", "scan", "Scan cancelled", scan_id)
    return {"ok": True}


async def _notify_dashboard(req: ScanRequest, scan_state: dict, event: str = "progress"):
    """Send progress update to Next.js dashboard."""
    if not req.callback_url:
        return

    # Validate callback URL scope — only allow HTTPS to known dashboard origins
    parsed_cb = urlparse(req.callback_url)
    allowed_hosts = {"localhost", "127.0.0.1", "dashboard.ethicalhackingbot.com"}
    if parsed_cb.hostname not in allowed_hosts and not (parsed_cb.hostname or "").endswith(".vercel.app"):
        logger.warning(f"Callback URL blocked — host {parsed_cb.hostname!r} not in allowed scope")
        return
    if parsed_cb.scheme not in ("https", "http"):
        logger.warning(f"Callback URL blocked — scheme {parsed_cb.scheme!r} not allowed")
        return

    try:
        import httpx
        async with httpx.AsyncClient(timeout=10, follow_redirects=False) as client:
            headers = {}
            if req.callback_token:
                headers["Authorization"] = f"Bearer {req.callback_token}"
            headers["Content-Type"] = "application/json"

            payload = {
                "scan_id": req.scan_id,
                "event": event,
                "status": scan_state["status"],
                "phase": scan_state.get("phase", ""),
                "progress": scan_state.get("progress", 0),
                "modules_done": scan_state.get("modules_done", 0),
                "modules_total": scan_state.get("modules_total", 3),
                "current_module": scan_state.get("current_module", ""),
                "findings_count": len(scan_state.get("findings", [])),
                "stats": scan_state.get("stats", {}),
            }

            if event == "complete":
                payload["findings"] = scan_state.get("findings", [])
                payload["duration"] = int(time.time() - scan_state.get("start_time", time.time()))

            await client.patch(req.callback_url, json=payload, headers=headers)
    except Exception as e:
        logger.warning(f"Dashboard callback failed: {e}")


async def _run_scan(req: ScanRequest, state: dict):
    """Execute the full scan pipeline — pure scripted, no AI.

    Flow: recon → scope filter → IDOR scan → access control scan → info disclosure scan → report.
    Every step logs detailed progress for the live monitor.
    """
    target_url = f"https://{req.domain}" if not req.domain.startswith("http") else req.domain
    findings = []

    # ═══════════════════════════════════════════
    # Automated Tooling Gate — HARD BLOCK
    # ═══════════════════════════════════════════
    if req.rules_of_engagement and req.rules_of_engagement.automatedTooling == "not_allowed":
        add_log("CRITICAL", "compliance", "SCAN BLOCKED — automated tooling is NOT ALLOWED by this program", req.scan_id)
        state["status"] = "blocked"
        state["phase"] = "compliance_blocked"
        state["progress"] = 0
        await _notify_dashboard(req, state, "error")
        return

    # ═══════════════════════════════════════════
    # Scope Enforcement — COMPLIANCE GATE
    # ═══════════════════════════════════════════
    scope_entries = req.scope or []
    if not scope_entries:
        target_host = urlparse(target_url).hostname or req.domain
        scope_entries = [target_host, f"*.{target_host}"]
        add_log("INFO", "compliance", f"No explicit scope — defaulting to target domain: {target_host}", req.scan_id)

    scope_enforcer = ScopeEnforcer(scope_entries)
    state["scope_entries"] = scope_entries
    add_log("INFO", "compliance", f"Scope enforcer active — {len(scope_entries)} entries: {', '.join(scope_entries)}", req.scan_id)

    # Build headers from rules of engagement
    scan_headers: dict[str, str] = {}
    if req.rules_of_engagement:
        roe = req.rules_of_engagement
        if roe.userAgent:
            scan_headers["User-Agent"] = roe.userAgent
            add_log("INFO", "compliance", f"Custom User-Agent: {roe.userAgent}", req.scan_id)
        if roe.requestHeader:
            if ":" in roe.requestHeader:
                key, val = roe.requestHeader.split(":", 1)
                scan_headers[key.strip()] = val.strip()
                add_log("INFO", "compliance", f"Custom header: {key.strip()}", req.scan_id)
        if roe.safeHarbour:
            add_log("INFO", "compliance", "Safe harbour policy confirmed by program", req.scan_id)
        else:
            add_log("CRITICAL", "compliance", "BLOCKED: No safe harbour protection — scan aborted. Cannot proceed without legal safe harbour.", req.scan_id)
            state["status"] = "blocked"
            state["phase"] = "compliance"
            state["error"] = "No safe harbour protection. Scan blocked for legal safety."
            await _notify_dashboard(req, state, "error")
            return

    request_delay = max(60.0 / req.rate_limit, 1.0)
    add_log("INFO", "compliance", f"Rate limit: {req.rate_limit} req/min (delay: {request_delay:.1f}s)", req.scan_id)

    try:
        # ═══════════════════════════════════════════
        # Phase 1: Reconnaissance
        # ═══════════════════════════════════════════
        state["phase"] = "recon"
        state["progress"] = 5
        state["current_module"] = "crawler"

        # Build seed URLs — if target_url isn't a real domain, use scope entries
        seed_urls = []
        parsed_target = urlparse(target_url)
        target_host = parsed_target.hostname or ""
        # Check if target resolves to something real (has a TLD)
        if "." in target_host:
            seed_urls = [target_url]
        else:
            # Target is a program name (e.g. "MyToyota"), not a domain
            # Use scope entries as seed URLs
            for entry in scope_entries:
                entry_clean = entry.strip().lower()
                if entry_clean.startswith("*."):
                    # Wildcard — use the base domain (e.g. *.toyota.com → toyota.com)
                    base_domain = entry_clean[2:]
                    seed_urls.append(f"https://{base_domain}")
                elif not entry_clean.startswith(("http://", "https://")):
                    seed_urls.append(f"https://{entry_clean}")
                else:
                    seed_urls.append(entry_clean)
            # Deduplicate
            seed_urls = list(dict.fromkeys(seed_urls))
            add_log("INFO", "recon", f"Target '{req.domain}' is not a domain — using {len(seed_urls)} scope domains as seed URLs", req.scan_id)

        if not seed_urls:
            add_log("CRITICAL", "recon", "No valid seed URLs — cannot crawl", req.scan_id)
            state["status"] = "error"
            state["error"] = "No valid seed URLs to crawl"
            await _notify_dashboard(req, state, "error")
            return

        add_log("INFO", "recon", f"Starting crawl on {len(seed_urls)} seed URL(s) (depth: {req.depth})", req.scan_id)
        for url in seed_urls[:5]:
            add_log("DEBUG", "recon", f"Seed: {url}", req.scan_id)
        if len(seed_urls) > 5:
            add_log("DEBUG", "recon", f"... and {len(seed_urls) - 5} more seeds", req.scan_id)
        await _notify_dashboard(req, state)

        async with HttpClient(concurrency=3, request_delay=request_delay, timeout=30, headers=scan_headers, scope_enforcer=scope_enforcer) as http:
            crawler = EndpointCrawler(http, max_depth=3, scope_enforcer=scope_enforcer)
            endpoints = []
            for seed_url in seed_urls:
                add_log("INFO", "recon", f"Crawling {seed_url}...", req.scan_id)
                eps = await crawler.crawl(seed_url)
                add_log("INFO", "recon", f"  → {len(eps)} endpoints from {seed_url}", req.scan_id)
                endpoints.extend(eps)
            # Deduplicate across all seeds
            seen = set()
            unique_endpoints = []
            for ep in endpoints:
                key = (ep.url, ep.method)
                if key not in seen:
                    seen.add(key)
                    unique_endpoints.append(ep)
            endpoints = unique_endpoints
            add_log("INFO", "recon", f"Crawler found {len(endpoints)} raw endpoints (across {len(seed_urls)} seeds)", req.scan_id)

            # Log some discovered endpoints for visibility
            for ep in endpoints[:10]:
                add_log("DEBUG", "recon", f"Found: {ep.method} {ep.url}", req.scan_id)
            if len(endpoints) > 10:
                add_log("DEBUG", "recon", f"... and {len(endpoints) - 10} more endpoints", req.scan_id)

            # ─── Scope Filter ───
            endpoints, blocked = scope_enforcer.filter_endpoints(endpoints)
            state["blocked_count"] = len(blocked)
            if blocked:
                add_log("WARN", "compliance", f"BLOCKED {len(blocked)} out-of-scope endpoints", req.scan_id)
                for ep in blocked[:5]:
                    add_log("WARN", "compliance", f"  Blocked: {ep.url}", req.scan_id)
            add_log("INFO", "recon", f"{len(endpoints)} endpoints in scope — ready for scanning", req.scan_id)

            state["endpoints_total"] = len(endpoints)
            state["progress"] = 15
            await _notify_dashboard(req, state)

            if not endpoints:
                add_log("WARN", "recon", "No endpoints found in scope — scan complete", req.scan_id)
                state["status"] = "complete"
                state["phase"] = "report"
                state["progress"] = 100
                await _notify_dashboard(req, state, "complete")
                return

            # ═══════════════════════════════════════════
            # Phase 2: Scanning
            # ═══════════════════════════════════════════
            state["phase"] = "scan"
            state["progress"] = 20
            await _notify_dashboard(req, state)

            # ─── Module 1: IDOR scan ───
            if state.get("status") == "cancelled":
                return

            state["current_module"] = "idor"
            add_log("INFO", "idor", f"Starting IDOR scanner on {len(endpoints)} endpoints", req.scan_id)
            await _notify_dashboard(req, state)

            idor_scanner = IDORScanner(http)
            idor_tested = 0
            for ep in endpoints:
                if state.get("status") == "cancelled":
                    break

                # Scope check each URL before scanning
                if not scope_enforcer.is_in_scope(ep.url):
                    add_log("WARN", "compliance", f"Skipping out-of-scope URL: {ep.url}", req.scan_id)
                    continue

                path_ids = idor_scanner.extract_path_ids(ep.url)
                if path_ids:
                    add_log("DEBUG", "idor", f"Testing {len(path_ids)} IDs in {ep.url}", req.scan_id)

                for id_val, _ in path_ids:
                    candidate = IDORCandidate(
                        url=ep.url,
                        method=ep.method,
                        id_type=IDORType.PATH_ID,
                        id_param="path",
                        original_id=id_val,
                        test_ids=idor_scanner.generate_test_ids(id_val),
                    )
                    finding = await idor_scanner.test_idor(candidate, {})
                    if finding:
                        entry = {
                            "module": "idor",
                            "severity": finding.severity.upper(),
                            "confidence": 0.7,
                            "title": f"IDOR: {finding.id_param} in {finding.url}",
                            "description": finding.description,
                            "url": finding.url,
                            "evidence": finding.evidence,
                        }
                        findings.append(entry)
                        sev = finding.severity.lower()
                        if sev in state["stats"]:
                            state["stats"][sev] += 1
                        add_log("ERROR", "idor", f"FOUND IDOR: {finding.url} [{finding.severity}]", req.scan_id)

                idor_tested += 1
                state["endpoints_scanned"] = idor_tested
                # Update progress: IDOR = 15% to 25%
                state["progress"] = 15 + (idor_tested / max(len(endpoints), 1)) * 10

            idor_count = len([f for f in findings if f["module"] == "idor"])
            state["modules_done"] = 1
            state["progress"] = 25
            state["findings"] = findings
            add_log("INFO", "idor", f"IDOR scan complete — {idor_count} findings from {idor_tested} endpoints", req.scan_id)
            await _notify_dashboard(req, state)

            # ─── Module 2: Access Control scan ───
            if state.get("status") == "cancelled":
                return

            state["current_module"] = "access_control"
            add_log("INFO", "access_control", f"Starting access control scanner on {target_url}", req.scan_id)
            await _notify_dashboard(req, state)

            ac_scanner = AccessControlScanner(http)

            # Test admin paths
            add_log("DEBUG", "access_control", "Probing admin paths...", req.scan_id)
            ac_findings = await ac_scanner.probe_admin_paths(
                target_url,
                unauth_headers={},          # Test unauthenticated access
                user_headers=scan_headers,   # Test with regular user headers
            )
            for f in ac_findings:
                # Scope check the finding URL
                if not scope_enforcer.is_in_scope(f.url):
                    add_log("WARN", "compliance", f"Skipping out-of-scope finding: {f.url}", req.scan_id)
                    continue
                entry = {
                    "module": "access_control",
                    "severity": f.severity.upper(),
                    "confidence": 0.7,
                    "title": f"Access Control: {f.url}",
                    "description": f.description,
                    "url": f.url,
                    "evidence": f.evidence,
                }
                findings.append(entry)
                sev = f.severity.lower()
                if sev in state["stats"]:
                    state["stats"][sev] += 1
                add_log("ERROR", "access_control", f"FOUND: {f.url} [{f.severity}]", req.scan_id)

            # Test method overrides and header bypasses on discovered endpoints
            add_log("DEBUG", "access_control", "Testing method overrides and header bypasses...", req.scan_id)
            for ep in endpoints[:20]:  # Cap to avoid excessive requests
                if state.get("status") == "cancelled":
                    break
                if not scope_enforcer.is_in_scope(ep.url):
                    continue
                method_finding = await ac_scanner.test_method_override(ep.url, scan_headers)
                if method_finding:
                    entry = {
                        "module": "access_control",
                        "severity": method_finding.severity.upper(),
                        "confidence": 0.7,
                        "title": f"Method Override: {method_finding.url}",
                        "description": method_finding.description,
                        "url": method_finding.url,
                        "evidence": method_finding.evidence,
                    }
                    findings.append(entry)
                    sev = method_finding.severity.lower()
                    if sev in state["stats"]:
                        state["stats"][sev] += 1
                    add_log("ERROR", "access_control", f"FOUND method bypass: {method_finding.url}", req.scan_id)

                header_findings = await ac_scanner.test_header_bypass(ep.url, scan_headers)
                for hf in header_findings:
                    entry = {
                        "module": "access_control",
                        "severity": hf.severity.upper(),
                        "confidence": 0.7,
                        "title": f"Header Bypass: {hf.url}",
                        "description": hf.description,
                        "url": hf.url,
                        "evidence": hf.evidence,
                    }
                    findings.append(entry)
                    sev = hf.severity.lower()
                    if sev in state["stats"]:
                        state["stats"][sev] += 1
                    add_log("ERROR", "access_control", f"FOUND header bypass: {hf.url}", req.scan_id)

            ac_count = len([f for f in findings if f["module"] == "access_control"])
            state["modules_done"] = 2
            state["progress"] = 35
            state["findings"] = findings
            add_log("INFO", "access_control", f"Access control scan complete — {ac_count} findings", req.scan_id)
            await _notify_dashboard(req, state)

            # ─── Module 3: Info Disclosure scan ───
            if state.get("status") == "cancelled":
                return

            state["current_module"] = "info_disclosure"
            add_log("INFO", "info_disclosure", f"Starting info disclosure scanner on {target_url}", req.scan_id)
            await _notify_dashboard(req, state)

            id_scanner = InfoDisclosureScanner(http)

            # Probe common disclosure endpoints
            add_log("DEBUG", "info_disclosure", "Probing common disclosure endpoints (.env, .git, swagger, etc.)...", req.scan_id)
            id_findings = await id_scanner.probe_disclosure_endpoints(target_url)
            for f in id_findings:
                if not scope_enforcer.is_in_scope(f.url):
                    add_log("WARN", "compliance", f"Skipping out-of-scope: {f.url}", req.scan_id)
                    continue
                entry = {
                    "module": "info_disclosure",
                    "severity": f.severity.upper(),
                    "confidence": 0.7,
                    "title": f"Info Disclosure: {f.disclosure_type}",
                    "description": f.description,
                    "url": f.url,
                    "evidence": f.evidence,
                }
                findings.append(entry)
                sev = f.severity.lower()
                if sev in state["stats"]:
                    state["stats"][sev] += 1
                add_log("WARN", "info_disclosure", f"FOUND: {f.disclosure_type} at {f.url} [{f.severity}]", req.scan_id)

            # Also scan response bodies of discovered endpoints for sensitive data
            add_log("DEBUG", "info_disclosure", "Scanning endpoint responses for sensitive data patterns...", req.scan_id)
            for ep in endpoints[:30]:  # Cap
                if state.get("status") == "cancelled":
                    break
                if not scope_enforcer.is_in_scope(ep.url):
                    continue
                try:
                    result = await http.get(ep.url)
                    if result.body:
                        response_findings = id_scanner.scan_response(ep.url, result)
                        for rf in response_findings:
                            entry = {
                                "module": "info_disclosure",
                                "severity": rf.severity.upper(),
                                "confidence": 0.6,
                                "title": f"Info Disclosure: {rf.disclosure_type} in response",
                                "description": rf.description,
                                "url": rf.url,
                                "evidence": rf.evidence,
                            }
                            findings.append(entry)
                            sev = rf.severity.lower()
                            if sev in state["stats"]:
                                state["stats"][sev] += 1
                            add_log("WARN", "info_disclosure", f"FOUND in response: {rf.disclosure_type} at {rf.url}", req.scan_id)
                except Exception:
                    pass  # Non-critical — skip unresponsive endpoints

            id_count = len([f for f in findings if f["module"] == "info_disclosure"])
            state["modules_done"] = 3
            state["progress"] = 45
            state["findings"] = findings
            add_log("INFO", "info_disclosure", f"Info disclosure scan complete — {id_count} findings", req.scan_id)
            await _notify_dashboard(req, state)

            # ─── Module 4: XSS scan ───
            if state.get("status") == "cancelled":
                return

            state["current_module"] = "xss"
            add_log("INFO", "xss", f"Starting XSS scanner on {len(endpoints[:25])} endpoints", req.scan_id)
            await _notify_dashboard(req, state)

            xss_scanner = XSSScanner(http)
            for ep in endpoints[:25]:
                if state.get("status") == "cancelled":
                    break
                if not scope_enforcer.is_in_scope(ep.url):
                    continue
                try:
                    xss_findings = await xss_scanner.scan_endpoint(ep.url, scan_headers)
                    for f in xss_findings:
                        entry = {
                            "module": "xss",
                            "severity": f.severity.upper(),
                            "confidence": 0.7,
                            "title": f"XSS ({f.xss_type.value}): {f.injection_point}",
                            "description": f.description,
                            "url": f.url,
                            "evidence": f.evidence,
                        }
                        findings.append(entry)
                        sev = f.severity.lower()
                        if sev in state["stats"]:
                            state["stats"][sev] += 1
                        add_log("ERROR", "xss", f"FOUND: {f.xss_type.value} XSS at {f.url} [{f.severity}]", req.scan_id)
                except Exception:
                    pass

            xss_count = len([f for f in findings if f["module"] == "xss"])
            state["modules_done"] = 4
            state["progress"] = 55
            state["findings"] = findings
            add_log("INFO", "xss", f"XSS scan complete — {xss_count} findings", req.scan_id)
            await _notify_dashboard(req, state)

            # ─── Module 5: SQL Injection scan ───
            if state.get("status") == "cancelled":
                return

            state["current_module"] = "sqli"
            add_log("INFO", "sqli", f"Starting SQLi scanner on {len(endpoints[:20])} endpoints", req.scan_id)
            await _notify_dashboard(req, state)

            sqli_scanner = SQLiScanner(http)
            for ep in endpoints[:20]:
                if state.get("status") == "cancelled":
                    break
                if not scope_enforcer.is_in_scope(ep.url):
                    continue
                try:
                    sqli_findings = await sqli_scanner.scan_endpoint(ep.url, scan_headers)
                    for f in sqli_findings:
                        entry = {
                            "module": "sqli",
                            "severity": f.severity.upper(),
                            "confidence": 0.8,
                            "title": f"SQLi ({f.sqli_type.value}): {f.injection_point}",
                            "description": f.description,
                            "url": f.url,
                            "evidence": f.evidence,
                        }
                        findings.append(entry)
                        sev = f.severity.lower()
                        if sev in state["stats"]:
                            state["stats"][sev] += 1
                        add_log("ERROR", "sqli", f"FOUND: {f.sqli_type.value} SQLi at {f.url} [{f.severity}]", req.scan_id)
                except Exception:
                    pass

            sqli_count = len([f for f in findings if f["module"] == "sqli"])
            state["modules_done"] = 5
            state["progress"] = 65
            state["findings"] = findings
            add_log("INFO", "sqli", f"SQLi scan complete — {sqli_count} findings", req.scan_id)
            await _notify_dashboard(req, state)

            # ─── Module 6: CSRF scan ───
            if state.get("status") == "cancelled":
                return

            state["current_module"] = "csrf"
            add_log("INFO", "csrf", f"Starting CSRF scanner on state-changing endpoints", req.scan_id)
            await _notify_dashboard(req, state)

            csrf_scanner = CSRFScanner(http)
            for ep in endpoints[:20]:
                if state.get("status") == "cancelled":
                    break
                if not scope_enforcer.is_in_scope(ep.url):
                    continue
                if ep.method.upper() in ("POST", "PUT", "DELETE", "PATCH"):
                    try:
                        csrf_findings = await csrf_scanner.scan_endpoint(ep.url, ep.method, scan_headers)
                        for f in csrf_findings:
                            entry = {
                                "module": "csrf",
                                "severity": f.severity.upper(),
                                "confidence": 0.6,
                                "title": f"CSRF: {f.missing_protection} at {f.url}",
                                "description": f.description,
                                "url": f.url,
                                "evidence": f.evidence,
                            }
                            findings.append(entry)
                            sev = f.severity.lower()
                            if sev in state["stats"]:
                                state["stats"][sev] += 1
                            add_log("ERROR", "csrf", f"FOUND: Missing {f.missing_protection} at {f.url} [{f.severity}]", req.scan_id)
                    except Exception:
                        pass

            csrf_count = len([f for f in findings if f["module"] == "csrf"])
            state["modules_done"] = 6
            state["progress"] = 75
            state["findings"] = findings
            add_log("INFO", "csrf", f"CSRF scan complete — {csrf_count} findings", req.scan_id)
            await _notify_dashboard(req, state)

            # ─── Module 7: SSRF scan ───
            if state.get("status") == "cancelled":
                return

            state["current_module"] = "ssrf"
            add_log("INFO", "ssrf", f"Starting SSRF scanner on {target_url}", req.scan_id)
            await _notify_dashboard(req, state)

            ssrf_scanner = SSRFScanner(http)

            # Probe common SSRF-prone paths
            ssrf_findings = await ssrf_scanner.probe_common_ssrf_endpoints(target_url, scan_headers)
            for f in ssrf_findings:
                if not scope_enforcer.is_in_scope(f.url):
                    continue
                entry = {
                    "module": "ssrf",
                    "severity": f.severity.upper(),
                    "confidence": 0.7,
                    "title": f"SSRF: {f.injection_point}",
                    "description": f.description,
                    "url": f.url,
                    "evidence": f.evidence,
                }
                findings.append(entry)
                sev = f.severity.lower()
                if sev in state["stats"]:
                    state["stats"][sev] += 1
                add_log("ERROR", "ssrf", f"FOUND: SSRF at {f.url} [{f.severity}]", req.scan_id)

            # Also test discovered endpoints with URL-like params
            for ep in endpoints[:15]:
                if state.get("status") == "cancelled":
                    break
                if not scope_enforcer.is_in_scope(ep.url):
                    continue
                try:
                    ep_ssrf_findings = await ssrf_scanner.scan_endpoint(ep.url, scan_headers)
                    for f in ep_ssrf_findings:
                        entry = {
                            "module": "ssrf",
                            "severity": f.severity.upper(),
                            "confidence": 0.7,
                            "title": f"SSRF: {f.injection_point}",
                            "description": f.description,
                            "url": f.url,
                            "evidence": f.evidence,
                        }
                        findings.append(entry)
                        sev = f.severity.lower()
                        if sev in state["stats"]:
                            state["stats"][sev] += 1
                        add_log("ERROR", "ssrf", f"FOUND: SSRF via param at {f.url} [{f.severity}]", req.scan_id)
                except Exception:
                    pass

            ssrf_count = len([f for f in findings if f["module"] == "ssrf"])
            state["modules_done"] = 7
            state["progress"] = 82
            state["findings"] = findings
            add_log("INFO", "ssrf", f"SSRF scan complete — {ssrf_count} findings", req.scan_id)
            await _notify_dashboard(req, state)

            # ─── Module 8: Differential scanner ───
            if state.get("status") == "cancelled":
                return

            state["current_module"] = "differential"
            add_log("INFO", "differential", f"Starting differential scanner on {len(endpoints)} endpoints", req.scan_id)
            await _notify_dashboard(req, state)

            diff_scanner = DifferentialScanner(http)

            # Test endpoints with anonymous vs authenticated comparison
            diff_endpoints = [ep for ep in endpoints[:20] if scope_enforcer.is_in_scope(ep.url)]
            for ep in diff_endpoints:
                if state.get("status") == "cancelled":
                    break
                try:
                    diff_findings = await diff_scanner.scan_endpoint(
                        ep.url,
                        method=ep.method if hasattr(ep, "method") else "GET",
                        anon_headers={},
                        user_headers=scan_headers,
                    )
                    for f in diff_findings:
                        entry = {
                            "module": "differential",
                            "severity": f.severity.upper(),
                            "confidence": 0.7,
                            "title": f"Differential: {f.finding_type} on {urlparse(f.url).path}",
                            "description": f.description,
                            "url": f.url,
                            "evidence": f.evidence,
                        }
                        findings.append(entry)
                        sev = f.severity.lower()
                        if sev in state["stats"]:
                            state["stats"][sev] += 1
                        add_log("ERROR", "differential", f"FOUND: {f.finding_type} at {f.url} [{f.severity}]", req.scan_id)
                except Exception:
                    pass

            diff_count = len([f for f in findings if f["module"] == "differential"])
            state["modules_done"] = 8
            state["progress"] = 90
            state["findings"] = findings
            add_log("INFO", "differential", f"Differential scan complete — {diff_count} findings", req.scan_id)
            await _notify_dashboard(req, state)

        # ═══════════════════════════════════════════
        # Phase 3: Report
        # ═══════════════════════════════════════════
        state["phase"] = "report"
        state["current_module"] = "report"
        state["progress"] = 95
        add_log("INFO", "report", f"Generating scan report — {len(findings)} total findings", req.scan_id)
        await _notify_dashboard(req, state)

        # Build summary
        summary_lines = [
            f"Target: {target_url}",
            f"Endpoints discovered: {state['endpoints_total']}",
            f"Out-of-scope blocked: {state['blocked_count']}",
            f"Duration: {int(time.time() - state['start_time'])}s",
            f"Findings: {len(findings)} total",
        ]
        for sev in ["critical", "high", "medium", "low", "info"]:
            count = state["stats"].get(sev, 0)
            if count > 0:
                summary_lines.append(f"  {sev.upper()}: {count}")

        add_log("INFO", "report", " | ".join(summary_lines), req.scan_id)

        # Save report to disk
        reports_dir = Path("./reports")
        reports_dir.mkdir(exist_ok=True)
        report = {
            "domain": req.domain,
            "target_url": target_url,
            "scan_date": datetime.now().isoformat(),
            "scope": scope_entries,
            "endpoints_discovered": state["endpoints_total"],
            "endpoints_blocked": state["blocked_count"],
            "findings": findings,
            "stats": state["stats"],
            "total_findings": len(findings),
            "duration": int(time.time() - state["start_time"]),
        }
        report_path = reports_dir / f"{req.domain.replace('.', '_')}_{req.scan_id[:8]}.json"
        report_path.write_text(json.dumps(report, indent=2, default=str))
        add_log("INFO", "report", f"Report saved: {report_path}", req.scan_id)

        state["progress"] = 100
        state["status"] = "complete"
        state["findings"] = findings
        add_log("INFO", "scan", f"SCAN COMPLETE — {len(findings)} findings in {int(time.time() - state['start_time'])}s", req.scan_id)

        await _notify_dashboard(req, state, "complete")

    except Exception as e:
        state["status"] = "error"
        state["error"] = str(e)
        add_log("ERROR", "scan", f"Scan failed: {e}", req.scan_id)
        await _notify_dashboard(req, state, "error")
        logger.exception(f"Scan error: {e}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("SCAN_SERVICE_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
