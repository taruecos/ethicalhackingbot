"""Lightweight Python scan microservice — no AI, pure scripted scanning.

Runs as a standalone FastAPI app. Next.js dashboard sends scan requests here.
Reports progress back to dashboard via callback URL.
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

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.utils.http_client import HttpClient
from src.recon.crawler import EndpointCrawler
from src.scanner.idor import IDORScanner, IDORCandidate, IDORType
from src.scanner.access_control import AccessControlScanner
from src.scanner.info_disclosure import InfoDisclosureScanner

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
    if len(scan_logs) > 1000:
        scan_logs[:] = scan_logs[-500:]
    logger.info(f"[{module}] {message}")


class RulesOfEngagement(BaseModel):
    userAgent: str | None = None
    requestHeader: str | None = None
    safeHarbour: bool | None = None


class ScanRequest(BaseModel):
    domain: str
    scan_id: str
    callback_url: str | None = None
    callback_token: str | None = None
    depth: str = "standard"
    modules: list[str] | None = None
    rate_limit: int = 30
    rules_of_engagement: RulesOfEngagement | None = None


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
        "logs": scan_logs[-100:],
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
        "modules_total": 3,
        "modules_done": 0,
        "current_module": "",
        "started_at": datetime.now().isoformat(),
        "start_time": time.time(),
        "findings": [],
        "stats": {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0},
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
        add_log("WARN", "scan", f"Scan cancelled", scan_id)
    return {"ok": True}


async def _notify_dashboard(req: ScanRequest, scan_state: dict, event: str = "progress"):
    """Send progress update to Next.js dashboard."""
    if not req.callback_url:
        return
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
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
    """Execute the actual scan — pure Python, no AI."""
    target_url = f"https://{req.domain}" if not req.domain.startswith("http") else req.domain
    findings = []

    # Build headers from rules of engagement
    scan_headers: dict[str, str] = {}
    if req.rules_of_engagement:
        roe = req.rules_of_engagement
        if roe.userAgent:
            scan_headers["User-Agent"] = roe.userAgent
            add_log("INFO", "compliance", f"Using custom User-Agent: {roe.userAgent}", req.scan_id)
        if roe.requestHeader:
            # Format: "X-Header-Name: value" or "X-Header: {username}"
            if ":" in roe.requestHeader:
                key, val = roe.requestHeader.split(":", 1)
                scan_headers[key.strip()] = val.strip()
                add_log("INFO", "compliance", f"Using custom header: {key.strip()}", req.scan_id)

    # Use program-specific rate limit (default 1 req/s for compliance)
    request_delay = max(1.0, 1.0)

    try:
        # Phase 1: Reconnaissance
        state["phase"] = "recon"
        state["progress"] = 5
        state["current_module"] = "crawler"
        add_log("INFO", "recon", f"Crawling {target_url}", req.scan_id)
        await _notify_dashboard(req, state)

        async with HttpClient(concurrency=3, request_delay=request_delay, timeout=30, headers=scan_headers) as http:
            crawler = EndpointCrawler(http, max_depth=3)
            endpoints = await crawler.crawl(target_url)
            add_log("INFO", "recon", f"Discovered {len(endpoints)} endpoints", req.scan_id)
            state["progress"] = 20

            if not endpoints:
                add_log("WARN", "recon", "No endpoints found", req.scan_id)
                state["status"] = "complete"
                state["phase"] = "report"
                state["progress"] = 100
                await _notify_dashboard(req, state, "complete")
                return

            # Phase 2: Scanning
            state["phase"] = "scan"
            state["progress"] = 25
            await _notify_dashboard(req, state)

            # IDOR scan
            state["current_module"] = "idor"
            add_log("INFO", "idor", "Running IDOR scanner", req.scan_id)
            await _notify_dashboard(req, state)

            if state.get("status") == "cancelled":
                return

            idor_scanner = IDORScanner(http)
            for ep in endpoints:
                if state.get("status") == "cancelled":
                    break
                path_ids = idor_scanner.extract_path_ids(ep.url)
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
                        add_log("ERROR", "idor", f"IDOR found: {finding.url}", req.scan_id)

            state["modules_done"] = 1
            state["progress"] = 45
            state["findings"] = findings
            await _notify_dashboard(req, state)

            # Access Control scan
            state["current_module"] = "access_control"
            add_log("INFO", "access_control", "Running access control scanner", req.scan_id)
            await _notify_dashboard(req, state)

            if state.get("status") != "cancelled":
                ac_scanner = AccessControlScanner(http)
                ac_findings = await ac_scanner.probe_admin_paths(target_url)
                for f in ac_findings:
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
                    add_log("ERROR", "access_control", f"Finding: {f.url}", req.scan_id)

            state["modules_done"] = 2
            state["progress"] = 70
            state["findings"] = findings
            await _notify_dashboard(req, state)

            # Info Disclosure scan
            state["current_module"] = "info_disclosure"
            add_log("INFO", "info_disclosure", "Running info disclosure scanner", req.scan_id)
            await _notify_dashboard(req, state)

            if state.get("status") != "cancelled":
                id_scanner = InfoDisclosureScanner(http)
                id_findings = await id_scanner.probe_disclosure_endpoints(target_url)
                for f in id_findings:
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
                    add_log("WARN", "info_disclosure", f"Finding: {f.url}", req.scan_id)

            state["modules_done"] = 3
            state["progress"] = 90

        # Phase 3: Analysis (deterministic — no AI)
        state["phase"] = "analysis"
        state["current_module"] = "analysis"
        add_log("INFO", "analysis", f"Analyzing {len(findings)} findings", req.scan_id)
        state["progress"] = 95

        # Phase 4: Report
        state["phase"] = "report"
        state["current_module"] = "report"
        state["progress"] = 100
        state["status"] = "complete"
        state["findings"] = findings
        add_log("INFO", "report", f"Scan complete: {len(findings)} findings", req.scan_id)

        # Save report to disk
        reports_dir = Path("./reports")
        reports_dir.mkdir(exist_ok=True)
        report = {
            "domain": req.domain,
            "target_url": target_url,
            "scan_date": datetime.now().isoformat(),
            "findings": findings,
            "stats": state["stats"],
            "total_findings": len(findings),
            "duration": int(time.time() - state["start_time"]),
        }
        report_path = reports_dir / f"{req.domain.replace('.', '_')}_{req.scan_id[:8]}.json"
        report_path.write_text(json.dumps(report, indent=2, default=str))

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
