"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Clock,
  Play,
  X,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Search,
  Loader2,
} from "lucide-react";
import { ds } from "@/components/ds/tokens";
import { DSCard } from "@/components/ds/DSCard";
import { DSButton } from "@/components/ds/DSButton";

const SCAN_PHASES = ["Init", "Recon", "Scan", "Analysis", "Report"];

const QUEUED_SCANS = [
  { id: "q1", target: "cdn.bugcrowd.com", program: "Bugcrowd", createdAt: "09:12" },
  { id: "q2", target: "portal.intigriti.com", program: "Intigriti", createdAt: "09:08" },
  { id: "q3", target: "api.bugbounty.jp", program: "BugBounty JP", createdAt: "08:55" },
];

interface RunningScan {
  id: string;
  target: string;
  program: string;
  phase: number;
  currentModule: string;
  endpointsDiscovered: number;
  endpointsScanned: number;
  elapsed: string;
  eta: string;
  findings: { critical: number; high: number; medium: number; low: number; info: number };
  hasError?: boolean;
  errorMsg?: string;
}

const INITIAL_RUNNING: RunningScan[] = [
  {
    id: "r1",
    target: "api.hackerone.com",
    program: "HackerOne",
    phase: 2,
    currentModule: "SQLi Scanner",
    endpointsDiscovered: 247,
    endpointsScanned: 156,
    elapsed: "8m 42s",
    eta: "~3m",
    findings: { critical: 1, high: 2, medium: 3, low: 1, info: 4 },
  },
];

const INITIAL_LOGS = [
  { id: 1, time: "09:22:14", level: "INFO", module: "Core", message: "Scan initiated for api.hackerone.com" },
  { id: 2, time: "09:22:14", level: "DEBUG", module: "DNS", message: "Resolving api.hackerone.com → 104.18.22.47" },
  { id: 3, time: "09:22:15", level: "INFO", module: "Recon", message: "Starting subdomain enumeration" },
  { id: 4, time: "09:22:16", level: "DEBUG", module: "HTTP", message: "Probing /robots.txt → 200 OK (48ms)" },
  { id: 5, time: "09:22:17", level: "INFO", module: "Recon", message: "Found 247 unique endpoints across 3 subdomains" },
  { id: 6, time: "09:22:18", level: "INFO", module: "SQLi", message: "Starting injection probes on 156 endpoints" },
  { id: 7, time: "09:22:20", level: "WARN", module: "RateLmt", message: "Request rate approaching limit (58/60 req/min)" },
  { id: 8, time: "09:22:21", level: "DEBUG", module: "HTTP", message: "GET /api/users?id=1 → 200 (123ms)" },
  { id: 9, time: "09:22:22", level: "ERROR", module: "SQLi", message: "Connection timeout on /api/reports (5000ms)" },
  { id: 10, time: "09:22:23", level: "INFO", module: "SQLi", message: "[FINDING] Possible SQLi in /api/search?q param" },
];

const STREAMING_LOGS = [
  { level: "INFO", module: "SQLi", message: "Testing blind injection on /api/search" },
  { level: "DEBUG", module: "HTTP", message: "GET /api/items?id=1 AND 1=1 → 200 (98ms)" },
  { level: "INFO", module: "SSRF", message: "Probing metadata endpoint via /api/proxy" },
  { level: "WARN", module: "WAF", message: "WAF detected — throttling request rate to 20/min" },
  { level: "INFO", module: "CSRF", message: "Checking CSRF tokens on state-change endpoints" },
  { level: "DEBUG", module: "HTTP", message: "POST /api/transfer → 200 (201ms)" },
  { level: "ERROR", module: "Network", message: "Temporary connection reset by peer at /api/bulk" },
  { level: "INFO", module: "IDOR", message: "[FINDING] IDOR via UUID enumeration at /api/docs/{uuid}" },
];

const LEVEL_COLORS: Record<string, string> = {
  INFO: ds.accent.default,
  DEBUG: ds.text.muted,
  WARN: ds.severity.high,
  ERROR: ds.severity.critical,
};

type DemoVariant = "running" | "empty" | "error";

export function ActiveTab() {
  const [variant, setVariant] = useState<DemoVariant>("running");
  const [queuedScans, setQueuedScans] = useState(QUEUED_SCANS);
  const [runningScans, setRunningScans] = useState<RunningScan[]>(INITIAL_RUNNING);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set(["r1"]));
  const [logs, setLogs] = useState(INITIAL_LOGS);
  const [logFilter, setLogFilter] = useState<Set<string>>(new Set(["INFO", "WARN", "ERROR", "DEBUG"]));
  const [logSearch, setLogSearch] = useState("");
  const [logModule, setLogModule] = useState("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const nextLogId = useRef(INITIAL_LOGS.length + 1);

  useEffect(() => {
    if (variant !== "running") return;
    let idx = 0;
    const interval = setInterval(() => {
      const entry = STREAMING_LOGS[idx % STREAMING_LOGS.length];
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
      setLogs((prev) => {
        const newLogs = [...prev, { id: nextLogId.current++, time: timeStr, ...entry }];
        return newLogs.slice(-200);
      });
      idx++;
    }, 1800);
    return () => clearInterval(interval);
  }, [variant]);

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  useEffect(() => {
    if (variant !== "running") return;
    const interval = setInterval(() => {
      setRunningScans((prev) =>
        prev.map((scan) => ({
          ...scan,
          endpointsScanned: Math.min(scan.endpointsDiscovered, scan.endpointsScanned + 2),
        })),
      );
    }, 2000);
    return () => clearInterval(interval);
  }, [variant]);

  const startQueued = (id: string) => setQueuedScans((prev) => prev.filter((s) => s.id !== id));
  const cancelScan = (id: string) => setRunningScans((prev) => prev.filter((s) => s.id !== id));
  const toggleLogs = (id: string) =>
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleLevel = (level: string) =>
    setLogFilter((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });

  const filteredLogs = logs.filter(
    (l) =>
      logFilter.has(l.level) &&
      (logModule === "all" || l.module === logModule) &&
      (logSearch === "" || l.message.toLowerCase().includes(logSearch.toLowerCase()) || l.module.toLowerCase().includes(logSearch.toLowerCase())),
  );

  const logModules = ["all", ...Array.from(new Set(logs.map((l) => l.module)))];

  const errorScan: RunningScan = {
    id: "err1",
    target: "admin.synack.com",
    program: "Synack",
    phase: 1,
    currentModule: "Recon",
    endpointsDiscovered: 12,
    endpointsScanned: 12,
    elapsed: "2m 15s",
    eta: "N/A",
    findings: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    hasError: true,
    errorMsg: "Host unreachable: Connection refused on port 443 after 3 retries (ECONNREFUSED)",
  };

  const displayRunning = variant === "error" ? [errorScan] : variant === "running" ? runningScans : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "7px 12px", backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg, flexWrap: "wrap" }}>
        <span style={{ fontSize: ds.size.xs, color: ds.text.muted, fontWeight: ds.weight.medium, textTransform: "uppercase", letterSpacing: "0.07em" }}>Preview</span>
        {(["running", "empty", "error"] as DemoVariant[]).map((v) => (
          <button
            key={v}
            onClick={() => setVariant(v)}
            style={{ height: 24, padding: "0 10px", borderRadius: ds.radius.md, border: `1px solid ${variant === v ? ds.accent.default : ds.border.default}`, backgroundColor: variant === v ? ds.accent.bg15 : "transparent", color: variant === v ? ds.accent.default : ds.text.secondary, fontSize: ds.size.xs, fontWeight: ds.weight.medium, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "all 0.1s ease", textTransform: "capitalize" }}
          >
            {v}
          </button>
        ))}
      </div>

      <div>
        <SectionTitle>System Metrics</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          <MetricCard label="CPU Usage" value="34%" sub="4-core · 3.2GHz" icon={<Cpu size={14} style={{ color: ds.text.muted }} />} pct={34} color={ds.accent.default} />
          <MetricCard label="RAM" value="67%" sub="10.7 / 16 GB" icon={<MemoryStick size={14} style={{ color: ds.text.muted }} />} pct={67} color={ds.severity.high} />
          <MetricCard label="Disk" value="182 GB" sub="used / 500 GB" icon={<HardDrive size={14} style={{ color: ds.text.muted }} />} pct={36} color={ds.severity.info} />
          <MetricCard label="Uptime" value="14d 7h" sub="since last reboot" icon={<Clock size={14} style={{ color: ds.text.muted }} />} pct={null} color={ds.accent.default} />
        </div>
      </div>

      {variant !== "empty" && queuedScans.length > 0 && (
        <div>
          <SectionTitle>
            Queued <span style={{ color: ds.text.muted, fontWeight: ds.weight.regular }}>({queuedScans.length})</span>
          </SectionTitle>
          <DSCard style={{ padding: 0, overflow: "hidden" }}>
            {queuedScans.map((scan, i) => (
              <div key={scan.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < queuedScans.length - 1 ? `1px solid ${ds.border.default}` : "none" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.medium, color: ds.text.primary, fontFamily: "monospace" }}>{scan.target}</div>
                  <div style={{ fontSize: ds.size.xs, color: ds.text.muted, marginTop: 2 }}>
                    {scan.program} · queued at {scan.createdAt}
                  </div>
                </div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: ds.radius.md, backgroundColor: "rgba(113,113,122,0.12)", color: ds.text.muted, fontSize: ds.size.xs, fontWeight: ds.weight.medium }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: ds.text.muted }} />
                  Queued
                </span>
                <DSButton variant="primary" size="sm" icon={<Play size={11} />} onClick={() => startQueued(scan.id)}>
                  Start
                </DSButton>
              </div>
            ))}
          </DSCard>
        </div>
      )}

      <div>
        <SectionTitle>
          Running{" "}
          {variant === "running" && <span style={{ color: ds.text.muted, fontWeight: ds.weight.regular }}>({displayRunning.length})</span>}
        </SectionTitle>

        {variant === "empty" ? (
          <DSCard style={{ padding: 48, textAlign: "center" }}>
            <ShieldCheck size={40} style={{ color: ds.text.muted, margin: "0 auto 14px" }} />
            <div style={{ fontSize: ds.size.lg, fontWeight: ds.weight.semibold, color: ds.text.secondary, marginBottom: 6 }}>All clear — queue a new scan</div>
            <div style={{ fontSize: ds.size.sm, color: ds.text.muted, marginBottom: 20 }}>No scans are currently running. The system is idle and ready.</div>
            <DSButton variant="primary" size="md" icon={<Play size={13} />}>
              Compose new scan
            </DSButton>
          </DSCard>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {displayRunning.map((scan) => (
              <RunningCard key={scan.id} scan={scan} expanded={expandedLogs.has(scan.id)} onToggleLogs={() => toggleLogs(scan.id)} onCancel={() => cancelScan(scan.id)} />
            ))}
          </div>
        )}
      </div>

      {variant !== "empty" && (
        <div>
          <SectionTitle>Live Logs</SectionTitle>
          <div style={{ borderRadius: ds.radius.lg, overflow: "hidden", border: `1px solid ${ds.border.default}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", backgroundColor: ds.bg.elevated, borderBottom: `1px solid ${ds.border.default}`, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 4 }}>
                {Object.entries(LEVEL_COLORS).map(([level, color]) => (
                  <button
                    key={level}
                    onClick={() => toggleLevel(level)}
                    style={{ height: 22, padding: "0 8px", borderRadius: ds.radius.md, border: `1px solid ${logFilter.has(level) ? color + "60" : ds.border.default}`, backgroundColor: logFilter.has(level) ? color + "20" : "transparent", color: logFilter.has(level) ? color : ds.text.muted, fontSize: 10, fontWeight: ds.weight.semibold, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "all 0.1s ease" }}
                  >
                    {level}
                  </button>
                ))}
              </div>

              <div style={{ width: 1, height: 16, backgroundColor: ds.border.default }} />

              <select
                value={logModule}
                onChange={(e) => setLogModule(e.target.value)}
                style={{ height: 26, padding: "0 8px", backgroundColor: ds.bg.surface, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.md, color: ds.text.secondary, fontSize: 11, cursor: "pointer", outline: "none", fontFamily: "Inter, sans-serif", colorScheme: "dark" as const }}
              >
                {logModules.map((m) => (
                  <option key={m} value={m}>
                    {m === "all" ? "All modules" : m}
                  </option>
                ))}
              </select>

              <div style={{ position: "relative", flex: 1, minWidth: 140, maxWidth: 260 }}>
                <Search size={11} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: ds.text.muted, pointerEvents: "none" }} />
                <input value={logSearch} onChange={(e) => setLogSearch(e.target.value)} placeholder="Search logs…" style={{ width: "100%", height: 26, boxSizing: "border-box", backgroundColor: ds.bg.surface, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.md, fontSize: 11, fontFamily: "Inter, sans-serif", color: ds.text.primary, paddingLeft: 26, paddingRight: 8, outline: "none" }} />
              </div>

              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10, color: ds.text.muted }}>Auto-scroll</span>
                <button
                  onClick={() => setAutoScroll(!autoScroll)}
                  style={{ width: 30, height: 16, borderRadius: 8, padding: 0, backgroundColor: autoScroll ? ds.accent.default : "rgba(39,39,42,0.6)", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s" }}
                >
                  <span style={{ position: "absolute", top: 1, left: autoScroll ? 15 : 1, width: 14, height: 14, borderRadius: "50%", backgroundColor: "#fff", transition: "left 0.2s" }} />
                </button>
                <span style={{ fontSize: 10, color: ds.text.muted, fontVariantNumeric: "tabular-nums" }}>{filteredLogs.length} lines</span>
              </div>
            </div>

            <div style={{ height: 340, overflowY: "auto", backgroundColor: "#0a0b0f", padding: "10px 14px", fontFamily: "'JetBrains Mono', monospace" }}>
              {filteredLogs.map((entry) => (
                <div key={entry.id} style={{ display: "flex", alignItems: "flex-start", gap: 0, fontSize: 12, lineHeight: "20px", borderBottom: `1px solid rgba(39,39,42,0.15)` }}>
                  <span style={{ color: "#4b5563", minWidth: 66, flexShrink: 0 }}>{entry.time}</span>
                  <span style={{ color: LEVEL_COLORS[entry.level] ?? ds.text.muted, minWidth: 50, flexShrink: 0, fontWeight: 500 }}>{entry.level}</span>
                  <span style={{ color: "#4b5563", minWidth: 60, flexShrink: 0 }}>[{entry.module}]</span>
                  <span style={{ color: entry.message.includes("[FINDING]") ? ds.severity.high : "#9ca3af", flex: 1 }}>{entry.message}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RunningCard({ scan, expanded, onToggleLogs, onCancel }: { scan: RunningScan; expanded: boolean; onToggleLogs: () => void; onCancel: () => void }) {
  const pct = Math.round((scan.endpointsScanned / scan.endpointsDiscovered) * 100);

  return (
    <DSCard style={{ padding: 0, overflow: "hidden" }}>
      {scan.hasError && (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "12px 16px", backgroundColor: ds.severity.criticalBg, borderBottom: `1px solid ${ds.severity.critical}40` }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <AlertCircle size={15} style={{ color: ds.severity.critical, flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.severity.critical }}>Scan error</div>
              <div style={{ fontSize: ds.size.xs, color: ds.text.muted, marginTop: 2 }}>{scan.errorMsg}</div>
            </div>
          </div>
          <DSButton variant="secondary" size="sm" icon={<RefreshCw size={11} />}>
            Resume from checkpoint
          </DSButton>
        </div>
      )}

      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              {!scan.hasError && <Loader2 size={13} className="animate-spin" style={{ color: ds.severity.info }} />}
              <span style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.text.primary, fontFamily: "monospace" }}>{scan.target}</span>
              <span style={{ fontSize: ds.size.xs, color: ds.text.muted, padding: "1px 6px", backgroundColor: ds.bg.elevated, borderRadius: ds.radius.md, border: `1px solid ${ds.border.default}` }}>{scan.program}</span>
            </div>
            <div style={{ fontSize: ds.size.xs, color: ds.text.muted }}>
              Module: <span style={{ color: ds.text.secondary }}>{scan.currentModule}</span>
              {" · "}Elapsed: <span style={{ color: ds.text.secondary }}>{scan.elapsed}</span>
              {!scan.hasError && (
                <>
                  {" · "}ETA: <span style={{ color: ds.accent.default }}>{scan.eta}</span>
                </>
              )}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <DSButton variant="ghost" size="sm" onClick={onCancel}>
              <X size={12} style={{ marginRight: 4 }} />
              Cancel
            </DSButton>
            <button
              onClick={onToggleLogs}
              style={{ display: "flex", alignItems: "center", gap: 5, height: 28, padding: "0 10px", borderRadius: ds.radius.md, border: `1px solid ${ds.border.default}`, backgroundColor: "transparent", color: ds.text.muted, fontSize: ds.size.xs, cursor: "pointer", fontFamily: "Inter, sans-serif" }}
            >
              Logs
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
          {SCAN_PHASES.map((phase, idx) => {
            const isDone = idx < scan.phase;
            const isActive = idx === scan.phase;
            return (
              <React.Fragment key={phase}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: isDone ? ds.accent.bg20 : isActive ? ds.accent.default : ds.bg.elevated, border: `2px solid ${isDone ? ds.accent.default : isActive ? ds.accent.default : ds.border.default}`, flexShrink: 0, boxShadow: isActive ? `0 0 0 4px ${ds.accent.bg15}` : "none", transition: "all 0.2s ease" }}>
                    {isDone ? (
                      <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                        <path d="M1 5L4 8L11 1" stroke={ds.accent.default} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: ds.weight.bold, color: isActive ? "#000" : ds.text.muted }}>{idx + 1}</span>
                    )}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: isActive ? ds.weight.semibold : ds.weight.regular, color: isActive ? ds.accent.default : isDone ? ds.text.secondary : ds.text.muted, whiteSpace: "nowrap" }}>{phase}</span>
                </div>
                {idx < SCAN_PHASES.length - 1 && (
                  <div style={{ flex: 1, height: 2, marginBottom: 16, backgroundColor: isDone ? ds.accent.default : ds.bg.elevated, transition: "background 0.4s ease" }} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {!scan.hasError && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>
                {scan.endpointsScanned} / {scan.endpointsDiscovered} endpoints
              </span>
              <span style={{ fontSize: ds.size.xs, fontWeight: ds.weight.semibold, color: ds.accent.default }}>{pct}%</span>
            </div>
            <div style={{ height: 5, backgroundColor: ds.bg.elevated, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", backgroundColor: ds.accent.default, borderRadius: 3, transition: "width 0.8s ease" }} />
            </div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>Findings:</span>
          {Object.entries(scan.findings).map(([sev, count]) => (
            <span
              key={sev}
              style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 6px", borderRadius: ds.radius.md, fontSize: 10, fontWeight: ds.weight.medium, backgroundColor: (ds.severity as any)[`${sev}Bg`], color: (ds.severity as any)[sev] }}
            >
              <span style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: (ds.severity as any)[sev] }} />
              {count}
            </span>
          ))}
        </div>
      </div>
    </DSCard>
  );
}

function MetricCard({ label, value, sub, icon, pct, color }: { label: string; value: string; sub: string; icon: React.ReactNode; pct: number | null; color: string }) {
  return (
    <div style={{ backgroundColor: ds.bg.surface, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg, padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontSize: ds.size.xs, color: ds.text.muted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: ds.weight.medium }}>{label}</span>
        <div style={{ width: 26, height: 26, borderRadius: ds.radius.md, backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
      </div>
      <div style={{ fontSize: ds.size["2xl"], fontWeight: ds.weight.bold, color: ds.text.primary, marginBottom: 4, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {pct !== null && (
        <div style={{ height: 4, backgroundColor: ds.bg.elevated, borderRadius: 2, overflow: "hidden", marginBottom: 6 }}>
          <div style={{ width: `${pct}%`, height: "100%", backgroundColor: color, borderRadius: 2, transition: "width 0.5s ease" }} />
        </div>
      )}
      <div style={{ fontSize: ds.size.xs, color: ds.text.muted }}>{sub}</div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: ds.size.xs, fontWeight: ds.weight.semibold, color: ds.text.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>{children}</div>;
}
