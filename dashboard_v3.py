"""Bug Bounty Bot — Dashboard v3 (Professional)"""
import asyncio
import json
import os
import sys
import uuid
import hmac
import time
import shutil
import psutil
from datetime import datetime
from pathlib import Path
from collections import defaultdict

from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware

sys.path.insert(0, os.path.dirname(__file__))

AUTH_TOKEN = os.environ.get("DASHBOARD_TOKEN")
if not AUTH_TOKEN:
    raise RuntimeError("DASHBOARD_TOKEN environment variable is required")
security = HTTPBearer(auto_error=False)

app = FastAPI(title="BugBountyBot Dashboard")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

active_scans: dict = {}
scan_queue: list = []
queue_running: bool = False
queue_task = None
RESULTS_DIR = Path("/root/ethicalhackingbot/results")
BOT_START_TIME = time.time()
bot_logs: list = []
MAX_LOGS = 500
compliance_cache: dict = {}  # program_id -> compliance info

def add_bot_log(level: str, module: str, message: str, scan_id: str = ""):
    entry = {
        "id": str(uuid.uuid4())[:12],
        "timestamp": datetime.now().isoformat(),
        "level": level,
        "module": module,
        "message": message,
    }
    if scan_id:
        entry["scanId"] = scan_id
    bot_logs.append(entry)
    if len(bot_logs) > MAX_LOGS:
        del bot_logs[:len(bot_logs) - MAX_LOGS]

def verify_token(token: str) -> bool:
    return hmac.compare_digest(token, AUTH_TOKEN)

async def check_auth_flexible(request: Request):
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
        if verify_token(token):
            return token
    token = request.query_params.get("token", "")
    if token and verify_token(token):
        return token
    raise HTTPException(status_code=401, detail="Unauthorized")

# ── API Routes ──────────────────────────────────────────

@app.get("/api/auth")
async def auth_check(token: str = ""):
    if not token or not verify_token(token):
        return JSONResponse({"ok": False}, status_code=401)
    return {"ok": True}

@app.get("/api/status")
async def get_status(token: str = Depends(check_auth_flexible)):
    return {
        "status": "online",
        "active_scans": len([s for s in active_scans.values() if s["status"] == "running"]),
        "total_scans": len(active_scans),
        "uptime": datetime.now().isoformat(),
    }

@app.get("/api/monitor")
async def get_monitor(token: str = Depends(check_auth_flexible)):
    cpu = psutil.cpu_percent(interval=0.1)
    mem = psutil.virtual_memory()
    disk = shutil.disk_usage("/")
    uptime_seconds = int(time.time() - BOT_START_TIME)
    running = [s for s in active_scans.values() if s["status"] == "running"]
    return {
        "metrics": {
            "cpuPercent": cpu,
            "memoryUsed": mem.used,
            "memoryTotal": mem.total,
            "diskUsed": disk.used,
            "diskTotal": disk.total,
            "uptime": uptime_seconds,
            "requestsPerMinute": 0,
            "activeConnections": len(running),
        },
        "logs": bot_logs[-100:],
    }

DASHBOARD_CALLBACK_URL = os.environ.get("DASHBOARD_CALLBACK_URL", "http://localhost:8080")

async def notify_dashboard(scan_id: str, update: dict):
    """Call back to dashboard to update scan status in PostgreSQL."""
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            await client.patch(
                f"{DASHBOARD_CALLBACK_URL}/api/scans/{scan_id}/progress",
                json=update,
                headers={"Authorization": f"Bearer {AUTH_TOKEN}"},
            )
    except Exception as e:
        add_bot_log("WARN", "callback", f"Failed to notify dashboard: {e}", scan_id)

@app.post("/api/scan")
async def start_scan(request: Request, token: str = Depends(check_auth_flexible)):
    body = await request.json()
    domain = body.get("domain", "").strip().replace("https://", "").replace("http://", "").strip("/")
    if not domain:
        return JSONResponse({"error": "Domain required"}, status_code=400)
    scan_id = body.get("scan_id", str(uuid.uuid4())[:8])
    active_scans[scan_id] = {
        "id": scan_id, "domain": domain, "status": "running",
        "started": datetime.now().isoformat(), "phases": [], "result": None,
    }
    asyncio.create_task(_run_scan(scan_id, domain))
    return {"scan_id": scan_id, "domain": domain, "status": "started"}

async def _resolve_scan_targets(domain: str, scan_id: str) -> list[str]:
    """Resolve domain to actual scan targets. If domain has no TLD (program name), extract scope domains."""
    from urllib.parse import urlparse
    # Check if it's a real domain (has a TLD)
    test_url = f"https://{domain}" if not domain.startswith("http") else domain
    parsed = urlparse(test_url)
    host = parsed.hostname or ""
    if "." in host:
        return [domain]  # Real domain, use as-is

    # It's a program name (e.g. "MyToyota") — resolve from cached programs
    add_bot_log("INFO", "scanner", f"'{domain}' is a program name, resolving scope domains...", scan_id)
    cache_dir = Path("/root/ethicalhackingbot/cache")
    targets = []
    if cache_dir.exists():
        for f in cache_dir.glob("*.json"):
            try:
                data = json.loads(f.read_text())
                programs = data if isinstance(data, list) else [data]
                for prog in programs:
                    prog_name = (prog.get("name") or prog.get("title") or "").strip()
                    if prog_name.lower() == domain.lower() or prog_name.replace(" ", "").lower() == domain.lower():
                        # Found the program — extract scope domains
                        dom_data = prog.get("domains", {})
                        entries = dom_data.get("content", []) if isinstance(dom_data, dict) else (dom_data if isinstance(dom_data, list) else [])
                        for entry in entries:
                            endpoint = entry.get("endpoint", "") if isinstance(entry, dict) else str(entry)
                            if endpoint and endpoint.strip():
                                ep = endpoint.strip()
                                if ep.startswith("*."):
                                    ep = ep[2:]  # Wildcard → base domain
                                targets.append(ep)
                        # Also check 'scope' field
                        for s in prog.get("scope", []):
                            ep = s.get("endpoint", "") if isinstance(s, dict) else str(s)
                            if ep and ep.strip():
                                ep = ep.strip()
                                if ep.startswith("*."):
                                    ep = ep[2:]
                                targets.append(ep)
                        break
            except Exception:
                pass

    # Deduplicate
    targets = list(dict.fromkeys(targets))
    if targets:
        add_bot_log("INFO", "scanner", f"Resolved '{domain}' to {len(targets)} scope domains", scan_id)
    else:
        add_bot_log("WARN", "scanner", f"Could not resolve '{domain}' to any scope domains", scan_id)
    return targets


async def _run_scan(scan_id: str, domain: str):
    scan = active_scans[scan_id]
    add_bot_log("INFO", "scanner", f"Starting scan for {domain}", scan_id)
    try:
        from run_full_scan import run_full_scan

        # Phase 1: Init
        scan["phases"].append({"name": "init", "time": datetime.now().isoformat(), "status": "done"})
        await notify_dashboard(scan_id, {
            "status": "RUNNING",
            "phases": scan["phases"],
        })
        add_bot_log("INFO", "scanner", f"Initializing modules for {domain}", scan_id)

        # Resolve program names to actual domains
        targets = await _resolve_scan_targets(domain, scan_id)
        if not targets:
            scan["status"] = "error"
            scan["error"] = f"No scannable domains found for '{domain}'"
            scan["finished"] = datetime.now().isoformat()
            await notify_dashboard(scan_id, {"status": "ERROR", "error": scan["error"]})
            add_bot_log("ERROR", "scanner", scan["error"], scan_id)
            return

        output_dir = str(RESULTS_DIR / f"dashboard_{scan_id}")
        # Run scan on each resolved target and merge results
        all_findings = []
        all_stats = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
        for target in targets:
            add_bot_log("INFO", "scanner", f"Scanning target: {target}", scan_id)
            result = await run_full_scan(
                target,
                output_dir=output_dir,
                phase_callback=lambda phase_name: _on_phase(scan_id, phase_name),
            )
            if result and isinstance(result, dict):
                all_findings.extend(result.get("findings", []))
                for sev in all_stats:
                    all_stats[sev] += result.get("stats", {}).get(sev, 0)

        result = {"findings": all_findings, "stats": all_stats, "duration": 0}

        scan["status"] = "complete"
        scan["result"] = result
        scan["finished"] = datetime.now().isoformat()

        # Build findings for dashboard
        findings = []
        if result and isinstance(result, dict):
            for f in result.get("findings", []):
                findings.append({
                    "module": f.get("module", "unknown"),
                    "severity": f.get("severity", "INFO"),
                    "confidence": f.get("confidence", 0.5),
                    "title": f.get("title", "Finding"),
                    "description": f.get("description", ""),
                    "url": f.get("url", domain),
                    "evidence": f.get("evidence", {}),
                })

        await notify_dashboard(scan_id, {
            "status": "COMPLETE",
            "phases": scan["phases"],
            "findings": findings,
            "duration": int((datetime.fromisoformat(scan["finished"]) - datetime.fromisoformat(scan["started"])).total_seconds() * 1000),
        })
        add_bot_log("INFO", "scanner", f"Scan complete for {domain} — {len(findings)} findings", scan_id)

    except Exception as e:
        scan["status"] = "error"
        scan["error"] = str(e)
        scan["finished"] = datetime.now().isoformat()
        await notify_dashboard(scan_id, {
            "status": "ERROR",
            "error": str(e),
        })
        add_bot_log("ERROR", "scanner", f"Scan failed for {domain}: {e}", scan_id)

async def _on_phase(scan_id: str, phase_name: str):
    """Called by run_full_scan when entering a new phase."""
    scan = active_scans.get(scan_id)
    if scan:
        scan["phases"].append({"name": phase_name, "time": datetime.now().isoformat(), "status": "done"})
        await notify_dashboard(scan_id, {
            "status": "RUNNING",
            "phases": scan["phases"],
        })

@app.get("/api/scans")
async def list_scans(token: str = Depends(check_auth_flexible)):
    return {"scans": list(active_scans.values())}

@app.delete("/api/scan/{scan_id}")
async def delete_scan(scan_id: str, token: str = Depends(check_auth_flexible)):
    if scan_id in active_scans:
        active_scans[scan_id]["status"] = "cancelled"
        del active_scans[scan_id]
        add_bot_log("INFO", "scanner", f"Scan {scan_id} deleted", scan_id)
        return {"ok": True}
    return JSONResponse({"error": "Scan not found"}, status_code=404)

@app.get("/api/scan/{scan_id}")
async def get_scan(scan_id: str, token: str = Depends(check_auth_flexible)):
    scan = active_scans.get(scan_id)
    if not scan:
        return JSONResponse({"error": "Scan not found"}, status_code=404)
    return scan

@app.get("/api/results")
async def list_results(token: str = Depends(check_auth_flexible)):
    results = []
    if RESULTS_DIR.exists():
        for item in sorted(RESULTS_DIR.iterdir(), reverse=True):
            if item.is_dir():
                for rfile in item.glob("*_report.json"):
                    try:
                        data = json.loads(rfile.read_text())
                        results.append({
                            "dir": item.name,
                            "file": rfile.name,
                            "target": data.get("target", "?"),
                            "timestamp": data.get("timestamp", "?"),
                            "stats": data.get("stats", {}),
                        })
                    except Exception:
                        pass
    return {"results": results[:50]}

@app.get("/api/results/{dir_name}/{file_name}")
async def get_result_detail(dir_name: str, file_name: str, token: str = Depends(check_auth_flexible)):
    fpath = RESULTS_DIR / dir_name / file_name
    if not fpath.exists():
        return JSONResponse({"error": "Not found"}, status_code=404)
    try:
        data = json.loads(fpath.read_text())
        return data
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/api/programs")
async def list_programs(token: str = Depends(check_auth_flexible)):
    cache_dir = Path("/root/ethicalhackingbot/cache")
    programs = []
    if cache_dir.exists():
        for f in cache_dir.glob("*.json"):
            try:
                data = json.loads(f.read_text())
                if isinstance(data, list):
                    programs.extend(data)
                elif isinstance(data, dict):
                    programs.append(data)
            except Exception:
                pass
    return {"programs": programs[:100], "total": len(programs)}

@app.post("/api/bounty/fetch")
async def fetch_programs(request: Request, token: str = Depends(check_auth_flexible)):
    body = await request.json() if request.headers.get("content-type", "").startswith("application/json") else {}
    platform = body.get("platform", "").upper() if isinstance(body, dict) else ""

    if platform == "INTIGRITI" or not platform:
        try:
            from src.platforms.intigriti import IntigritiClient
            client = IntigritiClient()
            programs = await client.fetch_all_programs_normalized()
            # Cache for /api/programs
            cache_dir = Path("/root/ethicalhackingbot/cache")
            cache_dir.mkdir(exist_ok=True)
            cache_file = cache_dir / "intigriti_programs.json"
            cache_file.write_text(json.dumps(programs, default=str))
            add_bot_log("info", "intigriti", f"Synced {len(programs)} programs from Intigriti")
            return {"status": "ok", "fetched": len(programs), "platform": "INTIGRITI"}
        except Exception as e:
            add_bot_log("error", "intigriti", f"Sync failed: {e}")
            return JSONResponse({"error": str(e)}, status_code=500)

    return JSONResponse({"error": f"Platform {platform} not yet supported"}, status_code=400)


@app.get("/api/intigriti/programs")
async def intigriti_programs(
    token: str = Depends(check_auth_flexible),
    limit: int = 100,
    offset: int = 0,
    following: str = "",
):
    """Proxy to Intigriti API — list programs."""
    from src.platforms.intigriti import IntigritiClient
    client = IntigritiClient()
    follow_bool = True if following == "true" else (False if following == "false" else None)
    data = await client.get_programs(limit=limit, offset=offset, following=follow_bool)
    return data


@app.get("/api/intigriti/programs/{program_id}")
async def intigriti_program_detail(program_id: str, token: str = Depends(check_auth_flexible)):
    """Get full program details from Intigriti."""
    from src.platforms.intigriti import IntigritiClient
    client = IntigritiClient()
    data = await client.get_program_detail(program_id)
    return data


@app.get("/api/intigriti/activities")
async def intigriti_activities(
    token: str = Depends(check_auth_flexible),
    limit: int = 50,
    offset: int = 0,
    following: str = "",
    created_since: int = 0,
):
    """Get recent program activities (scope/rule changes)."""
    from src.platforms.intigriti import IntigritiClient
    client = IntigritiClient()
    follow_bool = True if following == "true" else None
    since = created_since if created_since > 0 else None
    data = await client.get_activities(limit=limit, offset=offset, following=follow_bool, created_since=since)
    return data


@app.get("/api/intigriti/payouts")
async def intigriti_payouts(
    token: str = Depends(check_auth_flexible),
    limit: int = 100,
    offset: int = 0,
):
    """Get payout history from Intigriti."""
    from src.platforms.intigriti import IntigritiClient
    client = IntigritiClient()
    data = await client.get_payouts(limit=limit, offset=offset)
    return data


@app.get("/api/intigriti/programs/{program_id}/compliance")
async def intigriti_compliance(program_id: str, token: str = Depends(check_auth_flexible)):
    """Get compliance/rules of engagement for a specific program."""
    global compliance_cache
    if program_id in compliance_cache:
        return compliance_cache[program_id]
    from src.platforms.intigriti import IntigritiClient
    client = IntigritiClient()
    detail = await client.get_program_detail(program_id)
    comp = client.extract_compliance(detail)
    # Add scope info
    domains = []
    dom_data = detail.get("domains", {})
    if isinstance(dom_data, dict) and "content" in dom_data:
        for d in dom_data["content"]:
            domains.append({
                "id": d.get("id", ""),
                "endpoint": d.get("endpoint", ""),
                "type": d.get("type", {}).get("value", "url") if isinstance(d.get("type"), dict) else str(d.get("type", "")),
                "tier": d.get("tier", {}).get("value", "") if isinstance(d.get("tier"), dict) else str(d.get("tier", "")),
                "description": d.get("description", ""),
            })
    comp["domains"] = domains
    comp["program_name"] = detail.get("name", "")
    comp["program_id"] = program_id
    compliance_cache[program_id] = comp
    return comp


# ── Scan Queue ─────────────────────────────────────────

@app.get("/api/queue")
async def queue_list(token: str = Depends(check_auth_flexible)):
    """List all items in the scan queue."""
    return {"queue": scan_queue, "running": queue_running}


@app.post("/api/queue/add")
async def queue_add(request: Request, token: str = Depends(check_auth_flexible)):
    """Add target(s) to the scan queue."""
    body = await request.json()
    targets = body.get("targets", [])
    program_name = body.get("program_name", "")
    program_id = body.get("program_id", "")
    compliance = body.get("compliance", {})
    added = []
    for t in targets:
        url = t if isinstance(t, str) else t.get("url", t.get("endpoint", ""))
        if not url:
            continue
        item_id = str(uuid.uuid4())[:8]
        item = {
            "id": item_id,
            "target": url.strip(),
            "program_name": program_name,
            "program_id": program_id,
            "status": "queued",
            "phases": [],
            "findings_count": 0,
            "findings": [],
            "error": None,
            "added_at": datetime.now().isoformat(),
            "started_at": None,
            "finished_at": None,
            "report": None,
            "compliance": compliance,
        }
        scan_queue.append(item)
        added.append(item_id)
    return {"added": len(added), "ids": added, "queue_size": len(scan_queue)}


@app.post("/api/queue/start")
async def queue_start(token: str = Depends(check_auth_flexible)):
    """Start processing the scan queue."""
    global queue_running, queue_task
    if queue_running:
        return {"status": "already_running"}
    pending = [q for q in scan_queue if q["status"] == "queued"]
    if not pending:
        return {"status": "empty", "message": "No queued items"}
    queue_running = True
    queue_task = asyncio.create_task(_process_queue())
    return {"status": "started", "pending": len(pending)}


@app.post("/api/queue/stop")
async def queue_stop(token: str = Depends(check_auth_flexible)):
    """Stop queue processing after current scan finishes."""
    global queue_running
    queue_running = False
    return {"status": "stopping"}


@app.delete("/api/queue/{item_id}")
async def queue_remove(item_id: str, token: str = Depends(check_auth_flexible)):
    """Remove an item from the queue."""
    global scan_queue
    scan_queue = [q for q in scan_queue if q["id"] != item_id]
    return {"status": "removed"}


@app.post("/api/queue/clear")
async def queue_clear(request: Request, token: str = Depends(check_auth_flexible)):
    """Clear completed/errored items from queue."""
    global scan_queue
    body = await request.json() if request.headers.get("content-type", "").startswith("application/json") else {}
    clear_type = body.get("type", "finished")  # finished, all
    if clear_type == "all":
        scan_queue = [q for q in scan_queue if q["status"] == "scanning"]
    else:
        scan_queue = [q for q in scan_queue if q["status"] in ("queued", "scanning")]
    return {"status": "cleared", "remaining": len(scan_queue)}


async def _process_queue():
    """Process scan queue items one by one."""
    global queue_running
    add_bot_log("INFO", "queue", "Queue processing started")
    try:
        while queue_running:
            pending = [q for q in scan_queue if q["status"] == "queued"]
            if not pending:
                break
            item = pending[0]
            item["status"] = "scanning"
            item["started_at"] = datetime.now().isoformat()
            add_bot_log("INFO", "queue", f"Scanning {item['target']} ({item['program_name']})", item["id"])

            try:
                # Build auth headers from compliance (user-agent, request header)
                auth_headers = {}
                comp = item.get("compliance", {})
                if comp.get("user_agent"):
                    auth_headers["User-Agent"] = comp["user_agent"]
                if comp.get("request_header"):
                    # Format: "Header-Name: value"
                    parts = comp["request_header"].split(":", 1)
                    if len(parts) == 2:
                        auth_headers[parts[0].strip()] = parts[1].strip()

                # Phase tracking
                def phase_update(phase_name):
                    item["phases"].append({
                        "name": phase_name,
                        "time": datetime.now().isoformat(),
                    })

                from run_full_scan import run_full_scan
                output_dir = str(RESULTS_DIR / f"queue_{item['id']}")
                result = await run_full_scan(
                    item["target"],
                    output_dir=output_dir,
                    phase_callback=lambda pn: phase_update(pn),
                    auth_headers=auth_headers,
                )

                item["status"] = "complete"
                item["finished_at"] = datetime.now().isoformat()
                if result and isinstance(result, dict):
                    findings = result.get("findings", [])
                    item["findings"] = findings
                    item["findings_count"] = len(findings)
                    # Generate report
                    item["report"] = _generate_report(item, findings)
                add_bot_log("INFO", "queue", f"Scan complete: {item['target']} — {item['findings_count']} findings", item["id"])

            except Exception as e:
                item["status"] = "error"
                item["error"] = str(e)
                item["finished_at"] = datetime.now().isoformat()
                add_bot_log("ERROR", "queue", f"Scan failed: {item['target']} — {e}", item["id"])

            # Small delay between scans
            await asyncio.sleep(2)

    finally:
        queue_running = False
        add_bot_log("INFO", "queue", "Queue processing stopped")


def _generate_report(item: dict, findings: list) -> dict:
    """Generate a formatted report for Intigriti submission."""
    target = item["target"]
    program = item.get("program_name", "Unknown")
    severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}
    sorted_findings = sorted(findings, key=lambda f: severity_order.get(f.get("severity", "INFO"), 5))

    reports = []
    for i, f in enumerate(sorted_findings):
        sev = f.get("severity", "INFO")
        module = f.get("module", "unknown")
        url = f.get("url", target)
        title = f.get("title", f"{module} — {sev}")
        desc = f.get("description", "")
        evidence = f.get("evidence", {})

        report = {
            "index": i + 1,
            "title": title,
            "severity": sev,
            "url": url,
            "module": module,
            "steps": [
                f"1. Navigate to {url}",
                f"2. The {module.replace('_', ' ')} scanner detected a {sev.lower()} severity issue",
                f"3. {desc}" if desc else f"3. Vulnerability confirmed via automated analysis",
            ],
            "impact": f"This {sev.lower()} severity {module.replace('_', ' ')} vulnerability could allow an attacker to compromise the target.",
            "evidence": evidence,
            "description": desc,
        }
        reports.append(report)

    return {
        "target": target,
        "program": program,
        "generated_at": datetime.now().isoformat(),
        "total_findings": len(findings),
        "reports": reports,
        "summary": {
            "critical": len([f for f in findings if f.get("severity") == "CRITICAL"]),
            "high": len([f for f in findings if f.get("severity") == "HIGH"]),
            "medium": len([f for f in findings if f.get("severity") == "MEDIUM"]),
            "low": len([f for f in findings if f.get("severity") == "LOW"]),
            "info": len([f for f in findings if f.get("severity") == "INFO"]),
        },
    }


@app.get("/api/queue/{item_id}/report")
async def queue_report(item_id: str, token: str = Depends(check_auth_flexible)):
    """Get the formatted report for a completed queue item."""
    item = next((q for q in scan_queue if q["id"] == item_id), None)
    if not item:
        return JSONResponse({"error": "Item not found"}, status_code=404)
    if not item.get("report"):
        return JSONResponse({"error": "No report available"}, status_code=404)
    return item["report"]


# ── Dashboard HTML ──────────────────────────────────────

HTML_PAGE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>BugBountyBot</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#0b0d11;--surface:#131620;--surface2:#1a1e2b;--border:#252a3a;
  --accent:#22d97a;--accent-dim:#22d97a30;--accent-glow:#22d97a18;
  --red:#ef4444;--red-dim:#ef444425;
  --orange:#f59e0b;--orange-dim:#f59e0b25;
  --blue:#3b82f6;--blue-dim:#3b82f625;
  --purple:#a855f7;--purple-dim:#a855f725;
  --cyan:#06b6d4;--cyan-dim:#06b6d425;
  --text:#e2e8f0;--dim:#64748b;--dimmer:#475569;
  --font:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  --mono:'SF Mono','Fira Code','Cascadia Code',monospace;
}
body{font-family:var(--font);background:var(--bg);color:var(--text);min-height:100vh;font-size:14px;-webkit-font-smoothing:antialiased}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}

/* ── Login ── */
.login-wrap{display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}
.login-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:40px 32px;width:360px;text-align:center}
.login-icon{width:56px;height:56px;background:var(--accent-dim);border-radius:14px;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:28px}
.login-title{font-size:1.5rem;font-weight:700;margin-bottom:4px}
.login-sub{color:var(--dim);font-size:0.85rem;margin-bottom:24px}
.login-input{width:100%;padding:12px 16px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.95rem;font-family:var(--mono);transition:border .2s}
.login-input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-glow)}
.login-btn{width:100%;padding:12px;border:none;border-radius:10px;background:var(--accent);color:#000;font-weight:700;font-size:0.95rem;cursor:pointer;margin-top:12px;transition:opacity .2s}
.login-btn:hover{opacity:.9}
.login-btn:disabled{opacity:.4;cursor:not-allowed}
.login-msg{font-size:0.8rem;min-height:24px;margin:8px 0}
.login-msg.err{color:var(--red)}

/* ── Shell ── */
.shell{display:none;min-height:100vh}
.topbar{position:sticky;top:0;z-index:100;background:var(--surface);border-bottom:1px solid var(--border);padding:0 24px;height:56px;display:flex;align-items:center;gap:16px;backdrop-filter:blur(12px)}
.topbar-logo{display:flex;align-items:center;gap:10px;font-weight:700;font-size:1.1rem}
.topbar-logo .dot{width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 8px var(--accent)}
.topbar-nav{display:flex;gap:2px;margin-left:32px}
.topbar-nav button{background:none;border:none;color:var(--dim);padding:8px 16px;border-radius:8px;cursor:pointer;font-size:0.85rem;font-weight:500;transition:all .15s}
.topbar-nav button:hover{color:var(--text);background:var(--surface2)}
.topbar-nav button.active{color:var(--accent);background:var(--accent-dim)}
.topbar-right{margin-left:auto;display:flex;align-items:center;gap:12px}
.topbar-status{display:flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--dim)}
.topbar-status .dot{width:6px;height:6px;border-radius:50%}
.topbar-status .dot.on{background:var(--accent)}
.topbar-status .dot.off{background:var(--red)}
.btn-logout{background:var(--surface2);border:1px solid var(--border);color:var(--dim);padding:6px 14px;border-radius:8px;cursor:pointer;font-size:0.8rem;transition:all .15s}
.btn-logout:hover{color:var(--text);border-color:var(--dimmer)}

.main{max-width:1200px;margin:0 auto;padding:24px}

/* ── Cards ── */
.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:16px}
.card-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.card-title{font-size:0.75rem;text-transform:uppercase;letter-spacing:1.5px;color:var(--dim);font-weight:600}
.card-action{font-size:0.8rem;color:var(--accent);cursor:pointer;background:none;border:none;font-weight:500}

/* ── Stats Grid ── */
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px}
.stat-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center}
.stat-val{font-size:2rem;font-weight:800;line-height:1}
.stat-label{font-size:0.7rem;color:var(--dim);text-transform:uppercase;letter-spacing:1px;margin-top:6px}
.stat-val.critical{color:var(--red)}
.stat-val.high{color:var(--orange)}
.stat-val.medium{color:var(--purple)}
.stat-val.low{color:var(--blue)}
.stat-val.info{color:var(--cyan)}
.stat-val.total{color:var(--text)}
.stat-val.online{color:var(--accent)}

/* ── Severity Bar ── */
.sev-bar{display:flex;height:8px;border-radius:4px;overflow:hidden;margin:12px 0}
.sev-bar div{transition:width .3s}
.sev-bar .critical{background:var(--red)}
.sev-bar .high{background:var(--orange)}
.sev-bar .medium{background:var(--purple)}
.sev-bar .low{background:var(--blue)}
.sev-bar .info{background:var(--cyan)}

/* ── Module Breakdown ── */
.module-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)}
.module-row:last-child{border-bottom:none}
.module-icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
.module-name{font-weight:600;font-size:0.9rem;flex:1}
.module-count{font-family:var(--mono);font-weight:700;font-size:0.95rem}
.module-bar{flex:2;height:6px;background:var(--bg);border-radius:3px;overflow:hidden}
.module-bar-fill{height:100%;border-radius:3px;transition:width .3s}

/* ── Scan Input ── */
.scan-input-row{display:flex;gap:8px}
.scan-input{flex:1;padding:12px 16px;background:var(--bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.95rem;font-family:var(--mono)}
.scan-input:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-glow)}
.scan-btn{padding:12px 24px;border:none;border-radius:10px;background:var(--accent);color:#000;font-weight:700;cursor:pointer;font-size:0.9rem;transition:opacity .15s;white-space:nowrap}
.scan-btn:hover{opacity:.9}
.scan-btn:disabled{opacity:.4;cursor:not-allowed}

/* ── Scan List ── */
.scan-item{display:flex;align-items:center;gap:12px;padding:14px;background:var(--bg);border-radius:10px;margin-bottom:8px;border-left:3px solid var(--border);cursor:pointer;transition:background .15s}
.scan-item:hover{background:var(--surface2)}
.scan-item.running{border-left-color:var(--accent)}
.scan-item.complete{border-left-color:var(--accent)}
.scan-item.error{border-left-color:var(--red)}
.scan-domain{font-weight:700;font-size:0.95rem}
.scan-time{font-size:0.75rem;color:var(--dim);font-family:var(--mono)}
.scan-badge{font-size:0.7rem;padding:4px 10px;border-radius:6px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-left:auto;flex-shrink:0}
.scan-badge.running{background:var(--accent-dim);color:var(--accent)}
.scan-badge.complete{background:var(--accent-dim);color:var(--accent)}
.scan-badge.error{background:var(--red-dim);color:var(--red)}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
.scan-item.running .scan-badge{animation:pulse 2s infinite}
.scan-action{background:none;border:none;color:var(--dim);cursor:pointer;padding:4px 8px;font-size:1rem;opacity:.5;transition:opacity .15s}
.scan-action:hover{opacity:1;color:var(--red)}

/* ── Findings Table ── */
.findings-controls{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.filter-btn{background:var(--bg);border:1px solid var(--border);color:var(--dim);padding:6px 14px;border-radius:8px;cursor:pointer;font-size:0.8rem;font-weight:500;transition:all .15s}
.filter-btn:hover{color:var(--text);border-color:var(--dimmer)}
.filter-btn.active{border-color:var(--accent);color:var(--accent);background:var(--accent-glow)}
.filter-count{font-family:var(--mono);font-size:0.7rem;margin-left:4px;opacity:.7}

.finding-row{display:grid;grid-template-columns:80px 1fr 120px 80px;gap:12px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--border);font-size:0.85rem;cursor:pointer;transition:background .1s}
.finding-row:hover{background:var(--surface2)}
.finding-row.header{color:var(--dim);font-weight:600;font-size:0.7rem;text-transform:uppercase;letter-spacing:1px;cursor:default;border-bottom:2px solid var(--border)}
.finding-row.header:hover{background:transparent}
.sev-tag{padding:3px 8px;border-radius:5px;font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;text-align:center;display:inline-block}
.sev-tag.CRITICAL{background:var(--red-dim);color:var(--red)}
.sev-tag.HIGH{background:var(--orange-dim);color:var(--orange)}
.sev-tag.MEDIUM{background:var(--purple-dim);color:var(--purple)}
.sev-tag.LOW{background:var(--blue-dim);color:var(--blue)}
.sev-tag.INFO{background:var(--cyan-dim);color:var(--cyan)}
.finding-url{font-family:var(--mono);font-size:0.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.finding-module{color:var(--dim);font-size:0.8rem}
.finding-status{font-family:var(--mono);font-size:0.8rem;text-align:center}

/* ── Finding Detail Modal ── */
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:200;display:flex;justify-content:center;align-items:flex-start;padding:40px 20px;overflow-y:auto;backdrop-filter:blur(4px)}
.modal{background:var(--surface);border:1px solid var(--border);border-radius:16px;width:100%;max-width:700px;padding:28px;animation:slideUp .2s ease}
@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.modal-close{float:right;background:var(--surface2);border:1px solid var(--border);color:var(--dim);width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:1.1rem;display:flex;align-items:center;justify-content:center;transition:all .15s}
.modal-close:hover{color:var(--text);border-color:var(--dimmer)}
.modal h2{font-size:1.1rem;margin-bottom:16px;padding-right:40px}
.modal-section{margin-bottom:16px}
.modal-section h3{font-size:0.7rem;text-transform:uppercase;letter-spacing:1.5px;color:var(--dim);margin-bottom:8px}
.modal-field{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;font-family:var(--mono);font-size:0.8rem;word-break:break-all;white-space:pre-wrap;max-height:200px;overflow-y:auto;line-height:1.5}

/* ── Results List ── */
.result-card{background:var(--bg);border-radius:10px;padding:16px;margin-bottom:8px;cursor:pointer;transition:background .15s;border:1px solid transparent}
.result-card:hover{background:var(--surface2);border-color:var(--border)}
.result-target{font-weight:700;font-size:1rem;margin-bottom:4px}
.result-time{font-size:0.75rem;color:var(--dim);font-family:var(--mono)}
.result-stats{display:flex;gap:8px;margin-top:8px}
.result-sev{font-size:0.7rem;font-weight:700;padding:2px 6px;border-radius:4px}

/* ── Programs ── */
.program-card{display:flex;flex-direction:column;gap:4px;padding:12px;background:var(--bg);border-radius:10px;margin-bottom:6px;cursor:pointer;transition:border .15s;border:1px solid transparent}
.program-card:hover{border-color:var(--accent);background:var(--accent-glow)}
.program-name{font-weight:600;font-size:0.9rem;flex:1}
.program-meta{font-size:0.75rem;color:var(--dim)}

/* ── Compliance Badges ── */
.badge{display:inline-flex;align-items:center;gap:4px;font-size:0.7rem;font-weight:600;padding:3px 8px;border-radius:5px;letter-spacing:.3px}
.badge.allowed{background:#22d97a20;color:#22d97a}
.badge.not-allowed{background:#ef444420;color:#ef4444}
.badge.unknown{background:#f59e0b20;color:#f59e0b}
.badge.safe{background:#3b82f620;color:#3b82f6}

/* ── Queue ── */
.queue-item{display:flex;align-items:center;gap:12px;padding:14px;background:var(--bg);border-radius:10px;margin-bottom:8px;border-left:3px solid var(--border);transition:background .15s}
.queue-item.queued{border-left-color:var(--dim)}
.queue-item.scanning{border-left-color:var(--accent);animation:pulse 2s infinite}
.queue-item.complete{border-left-color:var(--accent)}
.queue-item.error{border-left-color:var(--red)}
.queue-target{font-weight:700;font-size:0.9rem;font-family:var(--mono)}
.queue-program{font-size:0.75rem;color:var(--dim)}
.queue-phases{display:flex;gap:4px;flex-wrap:wrap;margin-top:6px}
.phase-tag{font-size:0.65rem;padding:2px 6px;border-radius:4px;background:var(--accent-dim);color:var(--accent);font-family:var(--mono)}
.queue-actions{margin-left:auto;display:flex;gap:6px;flex-shrink:0}
.btn-sm{padding:5px 10px;border:1px solid var(--border);background:var(--surface2);color:var(--dim);border-radius:6px;cursor:pointer;font-size:0.75rem;transition:all .15s}
.btn-sm:hover{color:var(--text);border-color:var(--dimmer)}
.btn-sm.danger:hover{color:var(--red);border-color:var(--red)}
.btn-sm.accent{background:var(--accent);color:#000;border-color:var(--accent);font-weight:600}
.btn-sm.accent:hover{opacity:.9}

/* ── Report Modal ── */
.report-finding{background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:12px}
.report-finding h4{font-size:0.95rem;margin-bottom:8px;display:flex;align-items:center;gap:8px}
.report-steps{list-style:none;counter-reset:step}
.report-steps li{counter-increment:step;padding:6px 0;font-size:0.85rem;color:var(--text);position:relative;padding-left:28px}
.report-steps li::before{content:counter(step);position:absolute;left:0;width:20px;height:20px;border-radius:50%;background:var(--accent-dim);color:var(--accent);font-size:0.7rem;font-weight:700;display:flex;align-items:center;justify-content:center}
.copy-btn{background:var(--surface2);border:1px solid var(--border);color:var(--dim);padding:4px 10px;border-radius:5px;cursor:pointer;font-size:0.7rem;transition:all .15s}
.copy-btn:hover{color:var(--accent);border-color:var(--accent)}

/* ── Empty State ── */
.empty{text-align:center;color:var(--dim);padding:40px 20px;font-size:0.9rem}
.empty-icon{font-size:2rem;margin-bottom:8px;opacity:.5}

/* ── Tab panels ── */
.panel{display:none}
.panel.active{display:block}

/* ── Pagination ── */
.pagination{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:16px}
.pagination button{background:var(--surface2);border:1px solid var(--border);color:var(--dim);padding:6px 12px;border-radius:6px;cursor:pointer;font-size:0.8rem}
.pagination button:hover{color:var(--text)}
.pagination button:disabled{opacity:.3;cursor:not-allowed}
.pagination span{font-size:0.8rem;color:var(--dim)}

/* ── Responsive ── */
@media(max-width:640px){
  .topbar{padding:0 12px;gap:8px}
  .topbar-nav{margin-left:0;gap:0}
  .topbar-nav button{padding:8px 10px;font-size:0.8rem}
  .topbar-logo span{display:none}
  .main{padding:12px}
  .stats-grid{grid-template-columns:repeat(3,1fr);gap:8px}
  .stat-card{padding:12px 8px}
  .stat-val{font-size:1.4rem}
  .finding-row{grid-template-columns:70px 1fr 80px;font-size:0.8rem}
  .finding-row .finding-status{display:none}
  .scan-input-row{flex-direction:column}
  .modal{margin:12px;padding:20px}
}
</style>
</head>
<body>

<!-- ── Login ── -->
<div id="loginPage" class="login-wrap">
<div class="login-card">
  <div class="login-icon">&#x1f6e1;</div>
  <div class="login-title">BugBountyBot</div>
  <div class="login-sub">Ethical Hacking Dashboard</div>
  <div id="loginMsg" class="login-msg"></div>
  <input class="login-input" type="text" id="tokenInput" placeholder="Access token" autofocus autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
  <button class="login-btn" id="loginBtn">Authenticate</button>
</div>
</div>

<!-- ── Dashboard Shell ── -->
<div class="shell" id="shell">
<div class="topbar">
  <div class="topbar-logo"><div class="dot"></div>BugBountyBot<span style="color:var(--dim);font-weight:400;font-size:.8rem;margin-left:4px">v3</span></div>
  <div class="topbar-nav" id="nav">
    <button class="active" data-tab="overview">Overview</button>
    <button data-tab="programs">Programs</button>
    <button data-tab="queue">Queue</button>
    <button data-tab="scanner">Scanner</button>
    <button data-tab="findings">Findings</button>
  </div>
  <div class="topbar-right">
    <div class="topbar-status"><div class="dot on" id="statusDot"></div><span id="statusText">Online</span></div>
    <button class="btn-logout" id="logoutBtn">Logout</button>
  </div>
</div>

<div class="main">

  <!-- ── Overview Panel ── -->
  <div class="panel active" id="panel-overview">
    <div class="stats-grid" id="overviewStats">
      <div class="stat-card"><div class="stat-val online" id="ov-status">-</div><div class="stat-label">Status</div></div>
      <div class="stat-card"><div class="stat-val total" id="ov-total">-</div><div class="stat-label">Total Findings</div></div>
      <div class="stat-card"><div class="stat-val critical" id="ov-critical">-</div><div class="stat-label">Critical</div></div>
      <div class="stat-card"><div class="stat-val high" id="ov-high">-</div><div class="stat-label">High</div></div>
      <div class="stat-card"><div class="stat-val medium" id="ov-medium">-</div><div class="stat-label">Medium</div></div>
      <div class="stat-card"><div class="stat-val low" id="ov-low">-</div><div class="stat-label">Low</div></div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">Severity Distribution</span></div>
      <div class="sev-bar" id="sevBar"></div>
      <div id="sevLegend" style="display:flex;gap:16px;flex-wrap:wrap;font-size:.75rem;color:var(--dim)"></div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">Module Breakdown</span></div>
      <div id="moduleBreakdown"></div>
    </div>

    <div class="card">
      <div class="card-header"><span class="card-title">Recent Scans</span></div>
      <div id="recentScans"><div class="empty"><div class="empty-icon">&#x1f50d;</div>No scans yet</div></div>
    </div>
  </div>

  <!-- ── Scanner Panel ── -->
  <div class="panel" id="panel-scanner">
    <div class="card">
      <div class="card-header"><span class="card-title">Launch New Scan</span></div>
      <div class="scan-input-row">
        <input class="scan-input" type="text" id="targetInput" placeholder="target.com" autocomplete="off" spellcheck="false">
        <button class="scan-btn" id="scanBtn">&#x1f680; Scan</button>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Active Scans</span></div>
      <div id="scanList"><div class="empty"><div class="empty-icon">&#x1f4e1;</div>No active scans</div></div>
    </div>
    <div class="card">
      <div class="card-header"><span class="card-title">Scan History</span><button class="card-action" id="refreshResults">Refresh</button></div>
      <div id="resultsList"><div class="empty">Loading...</div></div>
    </div>
  </div>

  <!-- ── Findings Panel ── -->
  <div class="panel" id="panel-findings">
    <div class="card">
      <div class="card-header"><span class="card-title">All Findings</span><span id="findingsTotal" style="font-family:var(--mono);font-size:.85rem;color:var(--dim)"></span></div>
      <div class="findings-controls" id="findingsFilters"></div>
      <div id="findingsTable"></div>
      <div class="pagination" id="findingsPagination"></div>
    </div>
  </div>

  <!-- ── Programs Panel ── -->
  <div class="panel" id="panel-programs">
    <div class="card">
      <div class="card-header">
        <span class="card-title">Bug Bounty Programs</span>
        <div style="display:flex;gap:8px;align-items:center">
          <label style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--dim);cursor:pointer">
            <input type="checkbox" id="complianceOnly" style="accent-color:var(--accent)"> Scannable only
          </label>
          <select id="platformFilter" style="background:var(--bg);border:1px solid var(--border);color:var(--text);padding:6px 12px;border-radius:8px;font-size:0.8rem;cursor:pointer">
            <option value="all">All Platforms</option>
            <option value="INTIGRITI" selected>Intigriti</option>
            <option value="HACKERONE">HackerOne</option>
            <option value="BUGCROWD">Bugcrowd</option>
            <option value="YESWEHACK">YesWeHack</option>
          </select>
          <span id="programsCount" style="font-family:var(--mono);font-size:0.8rem;color:var(--dim)"></span>
        </div>
      </div>
      <div id="programsList"><div class="empty"><div class="empty-icon">&#x1f3af;</div>Loading programs...</div></div>
    </div>
  </div>

  <!-- ── Queue Panel ── -->
  <div class="panel" id="panel-queue">
    <div class="card">
      <div class="card-header">
        <span class="card-title">Scan Queue</span>
        <div style="display:flex;gap:8px">
          <button class="btn-sm accent" id="queueStartBtn" onclick="window._startQueue()">Start Queue</button>
          <button class="btn-sm" id="queueStopBtn" onclick="window._stopQueue()" style="display:none">Stop</button>
          <button class="btn-sm" onclick="window._clearQueue()">Clear Done</button>
        </div>
      </div>
      <div id="queueStats" style="display:flex;gap:16px;margin-bottom:12px;font-size:0.8rem;color:var(--dim)">
        <span>Queued: <strong id="qStat-queued" style="color:var(--text)">0</strong></span>
        <span>Scanning: <strong id="qStat-scanning" style="color:var(--accent)">0</strong></span>
        <span>Done: <strong id="qStat-complete" style="color:var(--accent)">0</strong></span>
        <span>Errors: <strong id="qStat-error" style="color:var(--red)">0</strong></span>
      </div>
      <div id="queueList"><div class="empty"><div class="empty-icon">&#x1f4cb;</div>Queue is empty. Add targets from the Programs tab.</div></div>
    </div>
  </div>

</div>
</div>

<!-- ── Finding Detail Modal ── -->
<div class="modal-overlay" id="modalOverlay" style="display:none">
<div class="modal" id="modalContent"></div>
</div>

<script>
(function(){
"use strict";

var TOKEN = "";
try { TOKEN = sessionStorage.getItem("bbbot_token") || ""; } catch(e) {}

var $ = function(id){ return document.getElementById(id); };
var allFindings = [];
var findingsFilter = {severity: "ALL", module: "ALL"};
var findingsPage = 0;
var PAGE_SIZE = 50;

/* ── API ── */
function api(path, opts) {
  opts = opts || {};
  var h = opts.headers || {};
  if (TOKEN) h["Authorization"] = "Bearer " + TOKEN;
  if (opts.body) h["Content-Type"] = "application/json";
  return fetch(path, {method:opts.method||"GET", headers:h, body:opts.body?JSON.stringify(opts.body):undefined})
    .then(function(r){ return r.json().then(function(d){ return {status:r.status, data:d}; }); });
}

/* ── Auth ── */
function doLogin() {
  var t = $("tokenInput").value.trim();
  if (!t) { $("loginMsg").textContent = "Token required"; $("loginMsg").className = "login-msg err"; return; }
  $("loginMsg").textContent = "Authenticating..."; $("loginMsg").className = "login-msg";
  $("loginBtn").disabled = true;
  TOKEN = t;
  fetch("/api/auth?token=" + encodeURIComponent(t))
    .then(function(r){
      $("loginBtn").disabled = false;
      if (r.ok) {
        try { sessionStorage.setItem("bbbot_token", t); } catch(e) {}
        $("loginPage").style.display = "none";
        $("shell").style.display = "block";
        boot();
      } else {
        TOKEN = ""; $("loginMsg").textContent = "Invalid token"; $("loginMsg").className = "login-msg err";
        $("tokenInput").value = ""; $("tokenInput").focus();
      }
    })
    .catch(function(e){ $("loginBtn").disabled = false; TOKEN = ""; $("loginMsg").textContent = "Network error"; $("loginMsg").className = "login-msg err"; });
}
$("loginBtn").addEventListener("click", doLogin);
$("tokenInput").addEventListener("keydown", function(e){ if(e.key==="Enter") doLogin(); });

function doLogout() {
  TOKEN = ""; try { sessionStorage.removeItem("bbbot_token"); } catch(e) {}
  $("loginPage").style.display = ""; $("shell").style.display = "none";
  $("tokenInput").value = ""; allFindings = [];
}
$("logoutBtn").addEventListener("click", doLogout);

/* ── Auto Login ── */
if (TOKEN) {
  fetch("/api/auth?token=" + encodeURIComponent(TOKEN))
    .then(function(r){ if(r.ok){ $("loginPage").style.display="none"; $("shell").style.display="block"; boot(); } else { TOKEN=""; try{sessionStorage.removeItem("bbbot_token")}catch(e){} } })
    .catch(function(){ TOKEN=""; });
}

/* ── Navigation ── */
$("nav").addEventListener("click", function(e){
  var btn = e.target;
  if (!btn.dataset || !btn.dataset.tab) return;
  $("nav").querySelectorAll("button").forEach(function(b){ b.className=""; });
  btn.className = "active";
  document.querySelectorAll(".panel").forEach(function(p){ p.className="panel"; });
  $("panel-" + btn.dataset.tab).className = "panel active";
  if (btn.dataset.tab === "findings" && allFindings.length === 0) loadAllFindings();
  if (btn.dataset.tab === "programs") loadPrograms();
  if (btn.dataset.tab === "queue") pollQueue();
});

/* ── Boot ── */
function boot() {
  pollStatus(); pollScans(); loadResults(); loadAllFindings(); loadPrograms(); pollQueue();
  setInterval(pollStatus, 5000);
  setInterval(pollScans, 4000);
  setInterval(pollQueue, 3000);
}

/* ── Status ── */
function pollStatus() {
  api("/api/status").then(function(r){
    if (r.status === 401) { doLogout(); return; }
    var d = r.data;
    var on = d.status === "online";
    $("ov-status").textContent = on ? "ONLINE" : "OFFLINE";
    $("statusDot").className = "dot " + (on ? "on" : "off");
    $("statusText").textContent = on ? "Online" : "Offline";
  }).catch(function(){});
}

/* ── Scans ── */
$("scanBtn").addEventListener("click", function(){
  var domain = $("targetInput").value.trim();
  if (!domain) return;
  $("targetInput").value = "";
  $("scanBtn").disabled = true;
  api("/api/scan", {method:"POST", body:{domain:domain}}).then(function(){
    $("scanBtn").disabled = false; pollScans();
  }).catch(function(){ $("scanBtn").disabled = false; });
});
$("targetInput").addEventListener("keydown", function(e){ if(e.key==="Enter") $("scanBtn").click(); });

function pollScans() {
  api("/api/scans").then(function(r){
    if (r.status===401) return;
    var scans = r.data.scans || [];
    // Active scans
    var el = $("scanList");
    if (!scans.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">&#x1f4e1;</div>No active scans</div>'; }
    else { el.innerHTML = scans.map(scanHTML).join(""); }
    // Recent scans on overview
    var recent = $("recentScans");
    if (!scans.length) { recent.innerHTML = '<div class="empty"><div class="empty-icon">&#x1f50d;</div>No scans yet</div>'; }
    else { recent.innerHTML = scans.slice(0,5).map(scanHTML).join(""); }
  }).catch(function(){});
}

function scanHTML(s) {
  var actions = '<span class="scan-badge '+esc(s.status)+'">'+esc(s.status)+'</span>';
  actions += '<button class="scan-action" onclick="event.stopPropagation();window._deleteScan(\''+esc(s.id)+'\')" title="Delete">&#x1f5d1;</button>';
  return '<div class="scan-item '+esc(s.status)+'" onclick="window._viewScan(\''+esc(s.id)+'\')">' +
    '<div><div class="scan-domain">'+esc(s.domain)+'</div><div class="scan-time">'+formatTime(s.started)+'</div></div>' +
    actions + '</div>';
}
window._deleteScan = function(id) {
  if (!confirm("Delete this scan?")) return;
  api("/api/scan/" + id, {method:"DELETE"}).then(function(){ pollScans(); });
};

window._viewScan = function(id) {
  api("/api/scan/" + id).then(function(r){
    if (r.status !== 200) return;
    var s = r.data;
    var html = '<button class="modal-close" onclick="window._closeModal()">&#x2715;</button>';
    html += '<h2>Scan: ' + esc(s.domain) + '</h2>';
    html += '<div class="modal-section"><h3>Status</h3><span class="scan-badge '+esc(s.status)+'">'+esc(s.status)+'</span></div>';
    html += '<div class="modal-section"><h3>Started</h3><div class="modal-field">'+esc(s.started)+'</div></div>';
    if (s.finished) html += '<div class="modal-section"><h3>Finished</h3><div class="modal-field">'+esc(s.finished)+'</div></div>';
    if (s.error) html += '<div class="modal-section"><h3>Error</h3><div class="modal-field" style="color:var(--red)">'+esc(s.error)+'</div></div>';
    if (s.result && s.result.stats) {
      var st = s.result.stats;
      html += '<div class="modal-section"><h3>Results</h3><div style="display:flex;gap:8px;flex-wrap:wrap">';
      html += sevPill("CRITICAL", st.critical) + sevPill("HIGH", st.high) + sevPill("MEDIUM", st.medium) + sevPill("LOW", st.low) + sevPill("INFO", st.info);
      html += '</div></div>';
    }
    $("modalContent").innerHTML = html;
    $("modalOverlay").style.display = "flex";
  });
};

/* ── Results ── */
$("refreshResults").addEventListener("click", loadResults);
function loadResults() {
  api("/api/results").then(function(r){
    var el = $("resultsList");
    var results = r.data.results || [];
    if (!results.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">&#x1f4c2;</div>No results yet</div>'; return; }
    el.innerHTML = results.map(function(x){
      var st = x.stats || {};
      return '<div class="result-card" onclick="window._loadReport(\''+esc(x.dir)+'\',\''+esc(x.file)+'\')">' +
        '<div class="result-target">'+esc(x.target)+'</div>' +
        '<div class="result-time">'+esc(x.timestamp)+'</div>' +
        '<div class="result-stats">' +
        sevPill("CRITICAL", st.critical||0) + sevPill("HIGH", st.high||0) + sevPill("MEDIUM", st.medium||0) + sevPill("LOW", st.low||0) +
        '</div></div>';
    }).join("");
  });
}

window._loadReport = function(dir, file) {
  api("/api/results/" + encodeURIComponent(dir) + "/" + encodeURIComponent(file)).then(function(r){
    if (r.status !== 200) return;
    allFindings = r.data.findings || [];
    findingsFilter = {severity:"ALL", module:"ALL"};
    findingsPage = 0;
    // Switch to findings tab
    $("nav").querySelectorAll("button").forEach(function(b){ b.className = b.dataset.tab==="findings" ? "active" : ""; });
    document.querySelectorAll(".panel").forEach(function(p){ p.className="panel"; });
    $("panel-findings").className = "panel active";
    renderFindings();
    renderOverviewFromFindings(r.data);
  });
};

/* ── Load All Findings (from latest result) ── */
function loadAllFindings() {
  api("/api/results").then(function(r){
    var results = r.data.results || [];
    if (!results.length) return;
    var latest = results[0];
    api("/api/results/" + encodeURIComponent(latest.dir) + "/" + encodeURIComponent(latest.file)).then(function(r2){
      if (r2.status !== 200) return;
      allFindings = r2.data.findings || [];
      renderFindings();
      renderOverviewFromFindings(r2.data);
    });
  });
}

function renderOverviewFromFindings(data) {
  var st = data.stats || {};
  $("ov-total").textContent = st.total || allFindings.length;
  $("ov-critical").textContent = st.critical || 0;
  $("ov-high").textContent = st.high || 0;
  $("ov-medium").textContent = st.medium || 0;
  $("ov-low").textContent = st.low || 0;

  // Severity bar
  var total = (st.critical||0) + (st.high||0) + (st.medium||0) + (st.low||0) + (st.info||0);
  if (total > 0) {
    var bar = $("sevBar");
    bar.innerHTML = '';
    [{c:"critical",v:st.critical||0},{c:"high",v:st.high||0},{c:"medium",v:st.medium||0},{c:"low",v:st.low||0},{c:"info",v:st.info||0}].forEach(function(s){
      if (s.v > 0) { var d = document.createElement("div"); d.className = s.c; d.style.width = (s.v/total*100)+"%"; bar.appendChild(d); }
    });
    $("sevLegend").innerHTML = [
      {l:"Critical",v:st.critical||0,c:"var(--red)"},{l:"High",v:st.high||0,c:"var(--orange)"},{l:"Medium",v:st.medium||0,c:"var(--purple)"},{l:"Low",v:st.low||0,c:"var(--blue)"},{l:"Info",v:st.info||0,c:"var(--cyan)"}
    ].filter(function(x){return x.v>0}).map(function(x){
      return '<span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:'+x.c+';margin-right:4px"></span>'+x.l+' ('+x.v+')</span>';
    }).join("");
  }

  // Module breakdown
  var byMod = {};
  allFindings.forEach(function(f){ var m = f.module || "unknown"; byMod[m] = (byMod[m]||0) + 1; });
  var modMax = Math.max.apply(null, Object.values(byMod).concat([1]));
  var modColors = {exposed_files:"var(--red)",security_headers:"var(--orange)",ssrf:"var(--purple)",xss:"var(--red)",sqli:"var(--red)",open_redirect:"var(--blue)",lfi:"var(--orange)",cors:"var(--cyan)",subdomains:"var(--accent)"};
  var modIcons = {exposed_files:"&#x1f4c4;",security_headers:"&#x1f6e1;",ssrf:"&#x1f310;",xss:"&#x1f489;",sqli:"&#x1f4be;",open_redirect:"&#x21a9;",lfi:"&#x1f4c2;",cors:"&#x1f517;",subdomains:"&#x1f30d;"};
  var mbHTML = Object.keys(byMod).sort(function(a,b){return byMod[b]-byMod[a]}).map(function(m){
    var pct = (byMod[m]/modMax*100);
    var color = modColors[m] || "var(--accent)";
    var icon = modIcons[m] || "&#x1f50d;";
    return '<div class="module-row">'+
      '<div class="module-icon" style="background:'+color+'20;color:'+color+'">'+icon+'</div>'+
      '<div class="module-name">'+esc(m.replace(/_/g,' '))+'</div>'+
      '<div class="module-bar"><div class="module-bar-fill" style="width:'+pct+'%;background:'+color+'"></div></div>'+
      '<div class="module-count" style="color:'+color+'">'+byMod[m]+'</div></div>';
  }).join("");
  $("moduleBreakdown").innerHTML = mbHTML || '<div class="empty">No data</div>';
}

/* ── Findings Table ── */
function renderFindings() {
  var filtered = allFindings;
  // Build filter buttons
  var sevCounts = {ALL:allFindings.length};
  var modCounts = {ALL:allFindings.length};
  allFindings.forEach(function(f){
    var s = f.severity || "?"; sevCounts[s] = (sevCounts[s]||0)+1;
    var m = f.module || "?"; modCounts[m] = (modCounts[m]||0)+1;
  });

  var filtersHTML = '<button class="filter-btn '+(findingsFilter.severity==="ALL"?"active":"")+'" onclick="window._filterSev(\'ALL\')">All<span class="filter-count">'+allFindings.length+'</span></button>';
  ["CRITICAL","HIGH","MEDIUM","LOW","INFO"].forEach(function(s){
    if (sevCounts[s]) filtersHTML += '<button class="filter-btn '+(findingsFilter.severity===s?"active":"")+'" onclick="window._filterSev(\''+s+'\')">'+s+'<span class="filter-count">'+sevCounts[s]+'</span></button>';
  });
  filtersHTML += '<span style="width:1px;background:var(--border);margin:0 4px"></span>';
  Object.keys(modCounts).filter(function(k){return k!=="ALL"}).sort().forEach(function(m){
    filtersHTML += '<button class="filter-btn '+(findingsFilter.module===m?"active":"")+'" onclick="window._filterMod(\''+esc(m)+'\')">'+esc(m.replace(/_/g,' '))+'<span class="filter-count">'+modCounts[m]+'</span></button>';
  });
  $("findingsFilters").innerHTML = filtersHTML;

  // Apply filters
  if (findingsFilter.severity !== "ALL") filtered = filtered.filter(function(f){ return f.severity === findingsFilter.severity; });
  if (findingsFilter.module !== "ALL") filtered = filtered.filter(function(f){ return f.module === findingsFilter.module; });

  $("findingsTotal").textContent = filtered.length + " findings";

  // Paginate
  var totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  var page = Math.min(findingsPage, totalPages - 1);
  if (page < 0) page = 0;
  var start = page * PAGE_SIZE;
  var pageItems = filtered.slice(start, start + PAGE_SIZE);

  // Table
  var tHTML = '<div class="finding-row header"><div>Severity</div><div>URL / Details</div><div>Module</div><div>Status</div></div>';
  tHTML += pageItems.map(function(f, i){
    var idx = start + i;
    return '<div class="finding-row" onclick="window._viewFinding('+idx+')">' +
      '<div><span class="sev-tag '+esc(f.severity||"")+'">'+esc(f.severity||"?")+'</span></div>' +
      '<div class="finding-url">'+esc(f.url || f.path || f.header || f.subdomain || "-")+'</div>' +
      '<div class="finding-module">'+esc((f.module||"").replace(/_/g," "))+'</div>' +
      '<div class="finding-status">'+(f.status != null ? esc(String(f.status)) : "-")+'</div></div>';
  }).join("");
  $("findingsTable").innerHTML = tHTML;

  // Pagination
  var pHTML = '';
  if (totalPages > 1) {
    pHTML = '<button '+(page<=0?"disabled":"")+' onclick="window._findingsPage('+(page-1)+')">&#x25c0; Prev</button>';
    pHTML += '<span>'+(page+1)+' / '+totalPages+'</span>';
    pHTML += '<button '+(page>=totalPages-1?"disabled":"")+' onclick="window._findingsPage('+(page+1)+')">Next &#x25b6;</button>';
  }
  $("findingsPagination").innerHTML = pHTML;
}

window._filterSev = function(s){ findingsFilter.severity = s; findingsPage = 0; renderFindings(); };
window._filterMod = function(m){ findingsFilter.module = (findingsFilter.module===m ? "ALL" : m); findingsPage = 0; renderFindings(); };
window._findingsPage = function(p){ findingsPage = p; renderFindings(); $("panel-findings").scrollIntoView({behavior:"smooth"}); };

/* ── Finding Detail ── */
window._viewFinding = function(idx) {
  var filtered = allFindings;
  if (findingsFilter.severity !== "ALL") filtered = filtered.filter(function(f){ return f.severity === findingsFilter.severity; });
  if (findingsFilter.module !== "ALL") filtered = filtered.filter(function(f){ return f.module === findingsFilter.module; });
  var f = filtered[idx];
  if (!f) return;

  var html = '<button class="modal-close" onclick="window._closeModal()">&#x2715;</button>';
  html += '<h2><span class="sev-tag '+esc(f.severity||"")+'">'+esc(f.severity||"?")+'</span> Finding Detail</h2>';

  // Common fields
  var fields = [
    {label:"Module", val:f.module},
    {label:"URL", val:f.url},
    {label:"Path", val:f.path},
    {label:"Method", val:f.method},
    {label:"Status", val:f.status},
    {label:"Content-Type", val:f.content_type},
    {label:"Size", val:f.size ? f.size + " bytes" : null},
    {label:"Header", val:f.header},
    {label:"Description", val:f.description},
    {label:"Parameter", val:f.parameter},
    {label:"Payload", val:f.payload},
    {label:"Type", val:f.type},
    {label:"Subdomain", val:f.subdomain},
    {label:"IPs", val:f.ips ? f.ips.join(", ") : null},
    {label:"Server", val:f.server},
    {label:"CNAME", val:f.cname},
    {label:"Redirect To", val:f.redirect_to},
  ];

  fields.forEach(function(field){
    if (field.val != null && field.val !== "" && field.val !== undefined) {
      html += '<div class="modal-section"><h3>'+esc(field.label)+'</h3><div class="modal-field">'+esc(String(field.val))+'</div></div>';
    }
  });

  // Evidence / snippet
  if (f.snippet) html += '<div class="modal-section"><h3>Response Snippet</h3><div class="modal-field">'+esc(f.snippet)+'</div></div>';
  if (f.response_snippet) html += '<div class="modal-section"><h3>Response Snippet</h3><div class="modal-field">'+esc(f.response_snippet)+'</div></div>';
  if (f.evidence) html += '<div class="modal-section"><h3>Evidence</h3><div class="modal-field">'+esc(typeof f.evidence === "object" ? JSON.stringify(f.evidence,null,2) : f.evidence)+'</div></div>';

  // Raw JSON
  html += '<div class="modal-section"><h3>Raw Data</h3><div class="modal-field">'+esc(JSON.stringify(f,null,2))+'</div></div>';

  $("modalContent").innerHTML = html;
  $("modalOverlay").style.display = "flex";
};

/* ── Modal ── */
window._closeModal = function(){ $("modalOverlay").style.display = "none"; };
$("modalOverlay").addEventListener("click", function(e){ if(e.target === $("modalOverlay")) window._closeModal(); });
document.addEventListener("keydown", function(e){ if(e.key==="Escape") window._closeModal(); });

/* ── Programs ── */
var allPrograms = [];
var programCompliance = {}; // pid -> compliance data

$("platformFilter").addEventListener("change", function(){ renderPrograms(); });
$("complianceOnly").addEventListener("change", function(){ renderPrograms(); });

function loadPrograms() {
  var el = $("programsList");
  el.innerHTML = '<div class="empty">Loading programs...</div>';
  api("/api/bounty/fetch", {method:"POST"}).then(function(){
    return api("/api/intigriti/programs");
  }).then(function(r){
    var records = r.data.records || r.data.programs || [];
    allPrograms = records;
    renderPrograms();
    // Pre-fetch compliance for all programs
    records.forEach(function(p){
      var pid = p.id || p.intigriti_id || "";
      if (pid && !programCompliance[pid]) {
        api("/api/intigriti/programs/" + pid + "/compliance").then(function(cr){
          if (cr.status === 200) {
            programCompliance[pid] = cr.data;
            renderPrograms();
          }
        }).catch(function(){});
      }
    });
  }).catch(function(e){
    el.innerHTML = '<div class="empty" style="color:var(--red)">Failed to load programs</div>';
  });
}

function complianceBadge(comp) {
  if (!comp) return '<span class="badge unknown">? Checking...</span>';
  var status = comp.automated_tooling_status || "unknown";
  if (status === "allowed") return '<span class="badge allowed">&#x2713; Automated OK</span>';
  if (status === "not_allowed") return '<span class="badge not-allowed">&#x2717; No Automated</span>';
  if (status === "conditional") return '<span class="badge unknown">&#x26a0; Conditional</span>';
  return '<span class="badge unknown">? Unknown</span>';
}

function safeHarbourBadge(comp) {
  if (!comp) return '';
  if (comp.safe_harbour) return '<span class="badge safe">&#x1f6e1; Safe Harbour</span>';
  return '';
}

function renderPrograms() {
  var el = $("programsList");
  var filter = $("platformFilter").value;
  var onlyScannable = $("complianceOnly").checked;
  var progs = allPrograms;
  if (filter !== "all") {
    progs = progs.filter(function(p){ return (p.platform || "INTIGRITI").toUpperCase() === filter; });
  }
  if (onlyScannable) {
    progs = progs.filter(function(p){
      var pid = p.id || p.intigriti_id || "";
      var comp = programCompliance[pid];
      return comp && comp.automated_tooling_status === "allowed";
    });
  }
  $("programsCount").textContent = progs.length + " programs";
  if (!progs.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">&#x1f3af;</div>No programs found.</div>'; return; }
  el.innerHTML = progs.slice(0,50).map(function(p){
    var name = p.name || p.handle || "Unknown";
    var minB = (p.minBounty && p.minBounty.value != null) ? p.minBounty.value : (p.min_bounty || "");
    var maxB = (p.maxBounty && p.maxBounty.value != null) ? p.maxBounty.value : (p.max_bounty || "");
    var bountyText = (minB || maxB) ? (minB + " - " + maxB + " EUR") : "";
    var following = p.following ? '<span style="color:var(--accent);font-size:0.7rem;margin-left:6px">&#x2605;</span>' : '';
    var pid = p.id || p.intigriti_id || "";
    var comp = programCompliance[pid];
    var badges = complianceBadge(comp) + safeHarbourBadge(comp);
    var domainCount = (p.domains && p.domains.content) ? p.domains.content.length : "?";
    return '<div class="program-card" onclick="window._viewProgram(\''+esc(pid)+'\')">' +
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span class="program-name">'+esc(name)+following+'</span>'+badges+'</div>' +
      '<div class="program-meta" style="display:flex;gap:16px;margin-top:4px">' +
        '<span>'+esc(domainCount)+' targets</span>' +
        (bountyText ? '<span style="color:var(--accent)">'+esc(bountyText)+'</span>' : '') +
      '</div></div>';
  }).join("");
}

window._viewProgram = function(pid) {
  if (!pid) return;
  var el = $("modalContent");
  el.innerHTML = '<div class="empty">Loading...</div>';
  $("modalOverlay").style.display = "flex";
  // Fetch compliance (includes domains) and program detail in parallel
  Promise.all([
    api("/api/intigriti/programs/" + pid + "/compliance"),
    api("/api/intigriti/programs/" + pid)
  ]).then(function(results){
    var comp = results[0].data;
    var p = results[1].data;
    programCompliance[pid] = comp;
    var html = '<button class="modal-close" onclick="window._closeModal()">&#x2715;</button>';
    html += '<h2 style="margin-bottom:12px">'+esc(p.name || p.handle || "Program")+'</h2>';

    // Compliance section
    html += '<div class="modal-section"><h3>Compliance</h3><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">';
    html += complianceBadge(comp) + safeHarbourBadge(comp);
    html += '</div>';
    if (comp.username) html += '<div class="modal-field" style="margin-bottom:4px"><span style="color:var(--dim)">Intigriti Account:</span> <span style="color:var(--accent)">'+esc(comp.username)+'</span></div>';
    if (comp.user_agent) html += '<div class="modal-field" style="margin-bottom:4px"><span style="color:var(--dim)">Required User-Agent:</span> '+esc(comp.user_agent)+'</div>';
    if (comp.request_header) html += '<div class="modal-field" style="margin-bottom:4px"><span style="color:var(--dim)">Required Header:</span> '+esc(comp.request_header)+'</div>';
    if (comp.description) html += '<div class="modal-field" style="font-size:0.8rem;max-height:100px;overflow-y:auto;margin-top:8px">'+esc(comp.description)+'</div>';
    html += '</div>';

    // Bounty
    var minB = (p.minBounty && p.minBounty.value != null) ? p.minBounty.value : "";
    var maxB = (p.maxBounty && p.maxBounty.value != null) ? p.maxBounty.value : "";
    if (minB || maxB) {
      html += '<div class="modal-section"><h3>Bounty Range</h3><div class="modal-field">'+esc(minB)+' - '+esc(maxB)+' EUR</div></div>';
    }

    // Scope with individual "Add to Queue" buttons
    var domains = comp.domains || [];
    var canScan = comp.automated_tooling_status === "allowed" || comp.automated_tooling_status === "conditional";
    if (domains.length) {
      html += '<div class="modal-section"><h3>Scope ('+domains.length+' targets)</h3>';
      var urlDomains = domains.filter(function(d){ return d.type === "url" || d.type === "web" || d.type === "api" || d.endpoint; });
      urlDomains.forEach(function(d, i){
        html += '<div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:8px;margin-bottom:4px">';
        html += '<div style="flex:1"><span style="color:var(--accent);font-family:var(--mono);font-size:0.85rem">'+esc(d.endpoint)+'</span>';
        if (d.tier) html += ' <span style="color:var(--dim);font-size:0.7rem">['+esc(d.tier)+']</span>';
        if (d.description) html += '<div style="color:var(--dim);font-size:0.75rem;margin-top:2px">'+esc(d.description)+'</div>';
        html += '</div>';
        if (canScan) {
          html += '<button class="btn-sm accent" onclick="window._addToQueue(\''+esc(pid)+'\',\''+esc(d.endpoint)+'\',\''+esc(p.name || p.handle || "")+'\');this.textContent=\'Added\';this.disabled=true">+ Queue</button>';
        }
        html += '</div>';
      });
      // Add all button
      if (canScan && urlDomains.length > 1) {
        html += '<button class="btn-sm accent" style="margin-top:8px;width:100%;padding:10px" onclick="window._addAllToQueue(\''+esc(pid)+'\',\''+esc(p.name || p.handle || "")+'\');this.textContent=\'All Added\';this.disabled=true">+ Add All '+urlDomains.length+' Targets to Queue</button>';
      }
      html += '</div>';
    }

    if (!canScan) {
      html += '<div style="margin-top:16px;padding:12px;background:var(--red-dim);border-radius:8px;color:var(--red);font-size:0.85rem">&#x26a0; Automated scanning is not allowed on this program.</div>';
    }

    el.innerHTML = html;
  }).catch(function(e){
    el.innerHTML = '<div class="empty" style="color:var(--red)">Failed to load details</div>';
  });
};

window._addToQueue = function(pid, endpoint, programName) {
  var comp = programCompliance[pid] || {};
  api("/api/queue/add", {method:"POST", body:{
    targets: [endpoint],
    program_name: programName,
    program_id: pid,
    compliance: {user_agent: comp.user_agent, request_header: comp.request_header}
  }}).then(function(){ pollQueue(); });
};

window._addAllToQueue = function(pid, programName) {
  var comp = programCompliance[pid] || {};
  var domains = comp.domains || [];
  var urls = domains.filter(function(d){ return d.endpoint; }).map(function(d){ return d.endpoint; });
  api("/api/queue/add", {method:"POST", body:{
    targets: urls,
    program_name: programName,
    program_id: pid,
    compliance: {user_agent: comp.user_agent, request_header: comp.request_header}
  }}).then(function(){ pollQueue(); });
};

/* ── Queue ── */
function pollQueue() {
  api("/api/queue").then(function(r){
    if (r.status === 401) return;
    var q = r.data.queue || [];
    var running = r.data.running;
    // Stats
    var stats = {queued:0, scanning:0, complete:0, error:0};
    q.forEach(function(item){ stats[item.status] = (stats[item.status]||0) + 1; });
    $("qStat-queued").textContent = stats.queued;
    $("qStat-scanning").textContent = stats.scanning;
    $("qStat-complete").textContent = stats.complete;
    $("qStat-error").textContent = stats.error;
    // Buttons
    $("queueStartBtn").style.display = running ? "none" : "";
    $("queueStopBtn").style.display = running ? "" : "none";
    // List
    var el = $("queueList");
    if (!q.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">&#x1f4cb;</div>Queue is empty. Add targets from Programs tab.</div>'; return; }
    el.innerHTML = q.map(function(item){
      var phases = (item.phases || []).map(function(ph){ return '<span class="phase-tag">'+esc(ph.name)+'</span>'; }).join("");
      var actions = '';
      if (item.status === "complete" && item.report) {
        actions += '<button class="btn-sm accent" onclick="window._viewReport(\''+esc(item.id)+'\')">Report</button>';
      }
      if (item.status === "queued") {
        actions += '<button class="btn-sm danger" onclick="window._removeFromQueue(\''+esc(item.id)+'\')">&#x2715;</button>';
      }
      var statusBadge = '<span class="scan-badge '+esc(item.status)+'">'+esc(item.status)+'</span>';
      if (item.status === "complete") statusBadge += ' <span style="font-size:0.75rem;color:var(--accent)">'+item.findings_count+' findings</span>';
      if (item.status === "error") statusBadge += ' <span style="font-size:0.75rem;color:var(--red)">'+esc(item.error || "")+'</span>';
      return '<div class="queue-item '+esc(item.status)+'">' +
        '<div style="flex:1"><div class="queue-target">'+esc(item.target)+'</div>' +
        '<div class="queue-program">'+esc(item.program_name)+'</div>' +
        (phases ? '<div class="queue-phases">'+phases+'</div>' : '') +
        '</div>' +
        statusBadge +
        '<div class="queue-actions">'+actions+'</div></div>';
    }).join("");
  }).catch(function(){});
}

window._startQueue = function(){
  api("/api/queue/start", {method:"POST"}).then(function(){ pollQueue(); });
};
window._stopQueue = function(){
  api("/api/queue/stop", {method:"POST"}).then(function(){ pollQueue(); });
};
window._removeFromQueue = function(id){
  api("/api/queue/" + id, {method:"DELETE"}).then(function(){ pollQueue(); });
};
window._clearQueue = function(){
  api("/api/queue/clear", {method:"POST", body:{type:"finished"}}).then(function(){ pollQueue(); });
};

/* ── Reports ── */
window._viewReport = function(itemId) {
  var el = $("modalContent");
  el.innerHTML = '<div class="empty">Loading report...</div>';
  $("modalOverlay").style.display = "flex";
  api("/api/queue/" + itemId + "/report").then(function(r){
    var rpt = r.data;
    var html = '<button class="modal-close" onclick="window._closeModal()">&#x2715;</button>';
    html += '<h2 style="margin-bottom:4px">Scan Report: '+esc(rpt.target)+'</h2>';
    html += '<div style="color:var(--dim);font-size:0.8rem;margin-bottom:16px">'+esc(rpt.program)+' &middot; '+esc(rpt.generated_at)+'</div>';

    // Summary badges
    var sum = rpt.summary || {};
    html += '<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">';
    if (sum.critical) html += '<span class="sev-tag CRITICAL">CRITICAL '+sum.critical+'</span>';
    if (sum.high) html += '<span class="sev-tag HIGH">HIGH '+sum.high+'</span>';
    if (sum.medium) html += '<span class="sev-tag MEDIUM">MEDIUM '+sum.medium+'</span>';
    if (sum.low) html += '<span class="sev-tag LOW">LOW '+sum.low+'</span>';
    if (sum.info) html += '<span class="sev-tag INFO">INFO '+sum.info+'</span>';
    html += '</div>';

    // Copy all button
    html += '<button class="copy-btn" style="margin-bottom:16px" onclick="window._copyFullReport(\''+esc(itemId)+'\')">Copy Full Report</button>';

    // Individual findings
    (rpt.reports || []).forEach(function(f, i){
      html += '<div class="report-finding">';
      html += '<h4><span class="sev-tag '+esc(f.severity)+'">'+esc(f.severity)+'</span> '+esc(f.title)+'</h4>';
      html += '<div style="color:var(--dim);font-size:0.8rem;margin-bottom:8px">'+esc(f.module)+' &middot; '+esc(f.url)+'</div>';

      if (f.description) html += '<div style="margin-bottom:8px;font-size:0.85rem">'+esc(f.description)+'</div>';

      html += '<h4 style="font-size:0.75rem;color:var(--dim);margin-top:12px">Steps to Reproduce</h4>';
      html += '<ol class="report-steps">';
      (f.steps || []).forEach(function(s){ html += '<li>'+esc(s)+'</li>'; });
      html += '</ol>';

      html += '<h4 style="font-size:0.75rem;color:var(--dim);margin-top:12px">Impact</h4>';
      html += '<div style="font-size:0.85rem;padding:8px;background:var(--bg);border-radius:6px">'+esc(f.impact)+'</div>';

      if (f.evidence && Object.keys(f.evidence).length) {
        html += '<h4 style="font-size:0.75rem;color:var(--dim);margin-top:12px">Evidence</h4>';
        html += '<div class="modal-field">'+esc(JSON.stringify(f.evidence, null, 2))+'</div>';
      }

      html += '<button class="copy-btn" style="margin-top:8px" onclick="window._copySingleReport('+i+',\''+esc(itemId)+'\')">Copy This Finding</button>';
      html += '</div>';
    });

    if (!rpt.reports || !rpt.reports.length) {
      html += '<div class="empty">No findings to report.</div>';
    }

    el.innerHTML = html;
  }).catch(function(e){
    el.innerHTML = '<div class="empty" style="color:var(--red)">Failed to load report</div>';
  });
};

window._copyFullReport = function(itemId) {
  api("/api/queue/" + itemId + "/report").then(function(r){
    var rpt = r.data;
    var text = "# Scan Report: " + rpt.target + "\n";
    text += "Program: " + rpt.program + "\n";
    text += "Date: " + rpt.generated_at + "\n\n";
    (rpt.reports || []).forEach(function(f, i){
      text += "## Finding " + (i+1) + ": " + f.title + "\n";
      text += "Severity: " + f.severity + "\n";
      text += "URL: " + f.url + "\n\n";
      text += "### Steps to Reproduce\n";
      (f.steps || []).forEach(function(s){ text += s + "\n"; });
      text += "\n### Impact\n" + f.impact + "\n\n";
      if (f.evidence && Object.keys(f.evidence).length) {
        text += "### Evidence\n" + JSON.stringify(f.evidence, null, 2) + "\n\n";
      }
      text += "---\n\n";
    });
    navigator.clipboard.writeText(text).then(function(){
      alert("Report copied to clipboard!");
    });
  });
};

window._copySingleReport = function(idx, itemId) {
  api("/api/queue/" + itemId + "/report").then(function(r){
    var f = (r.data.reports || [])[idx];
    if (!f) return;
    var text = "## " + f.title + "\n";
    text += "Severity: " + f.severity + "\n";
    text += "URL: " + f.url + "\n\n";
    text += "### Steps to Reproduce\n";
    (f.steps || []).forEach(function(s){ text += s + "\n"; });
    text += "\n### Impact\n" + f.impact + "\n";
    if (f.evidence && Object.keys(f.evidence).length) {
      text += "\n### Evidence\n" + JSON.stringify(f.evidence, null, 2) + "\n";
    }
    navigator.clipboard.writeText(text).then(function(){
      alert("Finding copied to clipboard!");
    });
  });
};

window._scanFromProgram = function(pid) {
  var prog = allPrograms.find(function(p){ return (p.id || p.intigriti_id) === pid; });
  if (!prog) return;
  window._closeModal();
  $("nav").querySelectorAll("button").forEach(function(b){ b.className=""; });
  $("nav").querySelector("[data-tab=scanner]").className = "active";
  document.querySelectorAll(".panel").forEach(function(p){ p.className="panel"; });
  $("panel-scanner").className = "panel active";
  var domains = (prog.domains && prog.domains.content) ? prog.domains.content : (prog.scope || []);
  if (domains.length) {
    var target = domains[0].endpoint || domains[0].asset || "";
    if (target) {
      $("targetInput").value = target;
      $("scanBtn").click();
    }
  }
};

/* ── Utils ── */
function esc(s) { var d=document.createElement("div"); d.appendChild(document.createTextNode(String(s||""))); return d.innerHTML; }
function sevPill(sev, count) { return '<span class="result-sev sev-tag '+sev+'">'+sev+' '+count+'</span>'; }
function formatTime(iso) {
  if (!iso) return "";
  try { var d = new Date(iso); return d.toLocaleString(); } catch(e) { return iso; }
}

})();
</script>
</body>
</html>"""

@app.get("/", response_class=HTMLResponse)
async def dashboard():
    return HTML_PAGE

if __name__ == "__main__":
    import uvicorn
    print("Dashboard v3 on http://0.0.0.0:8000")
    print(f"Token: {AUTH_TOKEN}")
    uvicorn.run(app, host="0.0.0.0", port=8000)
