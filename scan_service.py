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
ai_insights: list[dict] = []  # AI analysis messages for dashboard
start_time = time.time()

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://ollama:11434")
AI_MODEL = os.environ.get("AI_MODEL", "qwen2:0.5b")


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


def add_ai_insight(scan_id: str, phase: str, analysis: str, recommendations: list[str] | None = None):
    """Store an AI analysis insight for real-time dashboard display."""
    entry = {
        "id": str(uuid.uuid4())[:8],
        "timestamp": datetime.now().isoformat(),
        "scanId": scan_id,
        "phase": phase,
        "analysis": analysis,
        "recommendations": recommendations or [],
    }
    ai_insights.append(entry)
    if len(ai_insights) > 500:
        ai_insights[:] = ai_insights[-250:]
    # Also add to regular logs for visibility
    add_log("INFO", "ai-analyst", f"[{phase}] {analysis[:200]}", scan_id)


async def ask_ai(prompt: str, scan_id: str) -> str:
    """Send scan results to Ollama for analysis. Returns the AI's analysis text."""
    import httpx

    system_prompt = """You are an expert penetration tester and security analyst. You are analyzing scan results from an automated security scanner in real-time.

Your job:
1. Analyze the scan results provided
2. Identify the most interesting/critical findings
3. Suggest what to scan next based on what was found
4. Explain your reasoning concisely

Be direct, technical, and actionable. Focus on:
- What vulnerabilities were found and their severity
- Patterns that suggest deeper issues
- Which endpoints or services deserve more investigation
- Attack chains that could be constructed from multiple findings

Format your response as:
ANALYSIS: [your analysis of current findings]
NEXT_SCAN: [what to scan next and why]
PRIORITY_TARGETS: [comma-separated list of URLs or endpoints to investigate deeper]"""

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{OLLAMA_URL}/api/chat",
                json={
                    "model": AI_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt},
                    ],
                    "stream": False,
                },
            )
            if response.status_code == 200:
                data = response.json()
                return data.get("message", {}).get("content", "No analysis available")
            else:
                logger.warning(f"Ollama returned {response.status_code}")
                return f"AI analysis unavailable (HTTP {response.status_code})"
    except Exception as e:
        logger.warning(f"AI analysis failed: {e}")
        return f"AI analysis unavailable: {e}"


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
            "aiInsights": [i for i in ai_insights if i.get("scanId") == sid],
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
        "aiInsights": ai_insights[-50:],
    }


@app.get("/api/ai-insights")
async def get_ai_insights(scan_id: str | None = None):
    """Get AI analysis insights, optionally filtered by scan ID."""
    if scan_id:
        filtered = [i for i in ai_insights if i.get("scanId") == scan_id]
        return {"insights": filtered}
    return {"insights": ai_insights[-50:]}


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
    """Execute the scan with AI-powered analysis loop.

    Flow: scan phase → send results to AI → AI analyzes and recommends next scan → repeat.
    The AI acts as an analyst, not an operator — it reads results and guides the scan strategy.
    """
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
            if ":" in roe.requestHeader:
                key, val = roe.requestHeader.split(":", 1)
                scan_headers[key.strip()] = val.strip()
                add_log("INFO", "compliance", f"Using custom header: {key.strip()}", req.scan_id)

    request_delay = max(1.0, 1.0)

    try:
        # ═══════════════════════════════════════════
        # Phase 1: Reconnaissance
        # ═══════════════════════════════════════════
        state["phase"] = "recon"
        state["progress"] = 5
        state["current_module"] = "crawler"
        add_log("INFO", "recon", f"Crawling {target_url}", req.scan_id)
        await _notify_dashboard(req, state)

        async with HttpClient(concurrency=3, request_delay=request_delay, timeout=30, headers=scan_headers) as http:
            crawler = EndpointCrawler(http, max_depth=3)
            endpoints = await crawler.crawl(target_url)
            add_log("INFO", "recon", f"Discovered {len(endpoints)} endpoints", req.scan_id)
            state["progress"] = 15

            if not endpoints:
                add_log("WARN", "recon", "No endpoints found", req.scan_id)
                state["status"] = "complete"
                state["phase"] = "report"
                state["progress"] = 100
                await _notify_dashboard(req, state, "complete")
                return

            # ─── AI Analysis: Post-Recon ───
            add_log("INFO", "ai-analyst", "Analyzing discovered endpoints...", req.scan_id)
            endpoint_summary = "\n".join([
                f"- {ep.method} {ep.url} (params: {ep.params})"
                for ep in endpoints[:50]  # Cap at 50 to fit in context
            ])
            recon_prompt = f"""Target: {target_url}
Reconnaissance phase complete. Discovered {len(endpoints)} endpoints.

Endpoints found:
{endpoint_summary}

Analyze these endpoints:
1. Which ones look most interesting for vulnerability testing?
2. Any patterns suggesting admin panels, APIs, or sensitive data?
3. What should the scanner focus on first?"""

            ai_response = await ask_ai(recon_prompt, req.scan_id)
            add_ai_insight(req.scan_id, "recon", ai_response,
                           _extract_recommendations(ai_response))
            state["progress"] = 20
            await _notify_dashboard(req, state)

            # ═══════════════════════════════════════════
            # Phase 2: Scanning (AI-guided)
            # ═══════════════════════════════════════════
            state["phase"] = "scan"
            state["progress"] = 25
            await _notify_dashboard(req, state)

            # ─── Module 1: IDOR scan ───
            if state.get("status") == "cancelled":
                return

            state["current_module"] = "idor"
            add_log("INFO", "idor", "Running IDOR scanner", req.scan_id)
            await _notify_dashboard(req, state)

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
            state["progress"] = 40
            state["findings"] = findings
            await _notify_dashboard(req, state)

            # ─── AI Analysis: Post-IDOR ───
            if findings:
                idor_findings_text = "\n".join([
                    f"- [{f['severity']}] {f['title']} at {f['url']}"
                    for f in findings if f["module"] == "idor"
                ])
                idor_prompt = f"""Target: {target_url}
IDOR scan complete. Found {len([f for f in findings if f['module'] == 'idor'])} IDOR vulnerabilities.

Findings:
{idor_findings_text or "No IDOR vulnerabilities found."}

Total endpoints scanned: {len(endpoints)}

Based on these results:
1. How severe are these IDOR findings?
2. Could these be chained with other vulnerabilities?
3. What should the access control scan focus on next?"""
            else:
                idor_prompt = f"""Target: {target_url}
IDOR scan complete. No IDOR vulnerabilities found across {len(endpoints)} endpoints.

This could mean:
- Proper authorization is in place
- IDs are non-guessable (UUIDs)
- The application doesn't expose direct object references

What should the access control scan focus on?"""

            ai_response = await ask_ai(idor_prompt, req.scan_id)
            add_ai_insight(req.scan_id, "idor-analysis", ai_response,
                           _extract_recommendations(ai_response))
            state["progress"] = 45
            await _notify_dashboard(req, state)

            # ─── Module 2: Access Control scan ───
            if state.get("status") != "cancelled":
                state["current_module"] = "access_control"
                add_log("INFO", "access_control", "Running access control scanner", req.scan_id)
                await _notify_dashboard(req, state)

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
            state["progress"] = 60
            state["findings"] = findings
            await _notify_dashboard(req, state)

            # ─── AI Analysis: Post-Access Control ───
            ac_findings_text = "\n".join([
                f"- [{f['severity']}] {f['title']} at {f['url']}"
                for f in findings if f["module"] == "access_control"
            ])
            ac_prompt = f"""Target: {target_url}
Access control scan complete.

Access Control findings:
{ac_findings_text or "No access control issues found."}

Previous IDOR findings: {len([f for f in findings if f['module'] == 'idor'])}
Total findings so far: {len(findings)}

Analyze:
1. Any exposed admin panels or sensitive endpoints?
2. Can these be combined with IDOR findings for an attack chain?
3. What patterns should the info disclosure scan look for?"""

            ai_response = await ask_ai(ac_prompt, req.scan_id)
            add_ai_insight(req.scan_id, "access-control-analysis", ai_response,
                           _extract_recommendations(ai_response))
            state["progress"] = 65
            await _notify_dashboard(req, state)

            # ─── Module 3: Info Disclosure scan ───
            if state.get("status") != "cancelled":
                state["current_module"] = "info_disclosure"
                add_log("INFO", "info_disclosure", "Running info disclosure scanner", req.scan_id)
                await _notify_dashboard(req, state)

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
            state["progress"] = 80
            state["findings"] = findings
            await _notify_dashboard(req, state)

        # ═══════════════════════════════════════════
        # Phase 3: AI Final Analysis
        # ═══════════════════════════════════════════
        state["phase"] = "analysis"
        state["current_module"] = "ai-analyst"
        add_log("INFO", "ai-analyst", f"Running final AI analysis on {len(findings)} findings", req.scan_id)
        state["progress"] = 85
        await _notify_dashboard(req, state)

        # Build comprehensive findings summary for final analysis
        findings_by_module: dict[str, list] = {}
        for f in findings:
            findings_by_module.setdefault(f["module"], []).append(f)

        findings_summary = ""
        for module, module_findings in findings_by_module.items():
            findings_summary += f"\n### {module.upper()} ({len(module_findings)} findings)\n"
            for f in module_findings:
                findings_summary += f"- [{f['severity']}] {f['title']} at {f.get('url', 'N/A')}\n"
                if f.get('description'):
                    findings_summary += f"  Description: {f['description'][:150]}\n"

        if not findings:
            findings_summary = "No vulnerabilities were found during this scan."

        final_prompt = f"""Target: {target_url}
FULL SCAN COMPLETE — Final Analysis Required

Stats: {json.dumps(state['stats'])}
Total findings: {len(findings)}
Endpoints scanned: {len(endpoints)}
Scan duration: {int(time.time() - state['start_time'])} seconds

{findings_summary}

Provide a comprehensive final analysis:
1. EXECUTIVE SUMMARY: Overall security posture of the target
2. CRITICAL CHAINS: Any attack chains that combine multiple findings
3. BLIND SPOTS: What the scanner might have missed
4. RECOMMENDATIONS: Top 3 actionable next steps for manual testing
5. RISK RATING: Overall risk level (Critical/High/Medium/Low)"""

        ai_response = await ask_ai(final_prompt, req.scan_id)
        add_ai_insight(req.scan_id, "final-analysis", ai_response,
                       _extract_recommendations(ai_response))
        state["progress"] = 95
        await _notify_dashboard(req, state)

        # ═══════════════════════════════════════════
        # Phase 4: Report
        # ═══════════════════════════════════════════
        state["phase"] = "report"
        state["current_module"] = "report"
        state["progress"] = 100
        state["status"] = "complete"
        state["findings"] = findings
        # Attach AI insights to scan state for persistence
        state["ai_insights"] = [i for i in ai_insights if i.get("scanId") == req.scan_id]
        add_log("INFO", "report", f"Scan complete: {len(findings)} findings with AI analysis", req.scan_id)

        # Save report to disk (now includes AI insights)
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
            "ai_insights": state.get("ai_insights", []),
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


def _extract_recommendations(ai_text: str) -> list[str]:
    """Extract actionable recommendations from AI analysis text."""
    recommendations = []
    lines = ai_text.split("\n")
    for line in lines:
        line = line.strip()
        if line.startswith("NEXT_SCAN:"):
            recommendations.append(line[10:].strip())
        elif line.startswith("PRIORITY_TARGETS:"):
            targets = line[17:].strip().split(",")
            recommendations.extend([t.strip() for t in targets if t.strip()])
        elif line.startswith("- ") and any(kw in line.lower() for kw in ["scan", "test", "check", "probe", "investigate"]):
            recommendations.append(line[2:].strip())
    return recommendations[:10]  # Cap at 10


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("SCAN_SERVICE_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
