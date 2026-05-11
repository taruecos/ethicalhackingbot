"use client";

import React, { useState, useEffect, useRef } from "react";
import {
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

interface ApiScan {
  id: string;
  target: string;
  status: "QUEUED" | "RUNNING" | "COMPLETE" | "ERROR" | "CANCELLED";
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  programId: string | null;
  config: any;
  stats: any;
  _count?: { findings: number };
}

interface LogEntry {
  id: string;
  time: string;
  level: string;
  module: string;
  message: string;
}

interface ApiLog {
  id: string;
  timestamp: string;
  level: string;
  module: string;
  message: string;
}

function formatLogTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--:--";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

const MAX_LOGS_KEPT = 1000;

const LEVEL_COLORS: Record<string, string> = {
  INFO: ds.accent.default,
  DEBUG: ds.text.muted,
  WARN: ds.severity.high,
  ERROR: ds.severity.critical,
};

function formatHm(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatElapsed(startedAt: string | null): string {
  if (!startedAt) return "—";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function getProgress(scan: ApiScan): { discovered: number; scanned: number; phase: number; module: string } {
  const stats = scan.stats || {};
  return {
    discovered: Number(stats.endpointsDiscovered ?? 0),
    scanned: Number(stats.endpointsScanned ?? 0),
    phase: Number(stats.phase ?? 0),
    module: String(stats.currentModule ?? "—"),
  };
}

function getFindingsBreakdown(scan: ApiScan): { critical: number; high: number; medium: number; low: number; info: number } {
  const stats = scan.stats || {};
  const breakdown = stats.findings || stats.findingsBreakdown;
  if (breakdown && typeof breakdown === "object") {
    return {
      critical: Number(breakdown.critical ?? 0),
      high: Number(breakdown.high ?? 0),
      medium: Number(breakdown.medium ?? 0),
      low: Number(breakdown.low ?? 0),
      info: Number(breakdown.info ?? 0),
    };
  }
  return { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
}

export function ActiveTab() {
  const [scans, setScans] = useState<ApiScan[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<Set<string>>(new Set(["INFO", "WARN", "ERROR", "DEBUG"]));
  const [logSearch, setLogSearch] = useState("");
  const [logModule, setLogModule] = useState("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const lastLogIdRef = useRef<Map<string, string>>(new Map());

  const loadScans = async () => {
    try {
      const res = await fetch("/api/scans", { credentials: "same-origin" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const all: ApiScan[] = json.scans ?? [];
      setScans(all.filter((s) => s.status === "QUEUED" || s.status === "RUNNING" || s.status === "ERROR"));
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScans();
    const interval = setInterval(loadScans, 5000);
    return () => clearInterval(interval);
  }, []);

  const runningIds = (scans ?? [])
    .filter((s) => s.status === "RUNNING" || s.status === "ERROR")
    .map((s) => s.id);
  const runningIdsKey = runningIds.join(",");

  useEffect(() => {
    if (runningIds.length === 0) return;

    let cancelled = false;
    let inFlight = false;

    const fetchLogs = async () => {
      if (inFlight || cancelled) return;
      inFlight = true;
      try {
        const incoming: LogEntry[] = [];
        for (const scanId of runningIds) {
          const cursor = lastLogIdRef.current.get(scanId);
          const qs = cursor ? `?after=${encodeURIComponent(cursor)}` : "";
          try {
            const res = await fetch(`/api/scans/${scanId}/logs${qs}`, { credentials: "same-origin" });
            if (!res.ok) continue;
            const json = (await res.json()) as { logs?: ApiLog[] };
            const items = json.logs ?? [];
            if (items.length === 0) continue;
            lastLogIdRef.current.set(scanId, items[items.length - 1].id);
            for (const item of items) {
              incoming.push({
                id: item.id,
                time: formatLogTime(item.timestamp),
                level: (item.level || "INFO").toUpperCase(),
                module: item.module || "—",
                message: item.message ?? "",
              });
            }
          } catch {
            // swallow per-scan errors, keep polling others
          }
        }
        if (!cancelled && incoming.length > 0) {
          setLogs((prev) => {
            const merged = prev.concat(incoming);
            return merged.length > MAX_LOGS_KEPT ? merged.slice(-MAX_LOGS_KEPT) : merged;
          });
        }
      } finally {
        inFlight = false;
      }
    };

    fetchLogs();
    const id = setInterval(fetchLogs, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // runningIds is intentionally captured via runningIdsKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runningIdsKey]);

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const startQueued = async (id: string) => {
    try {
      await fetch(`/api/scans/${id}/start`, { method: "POST", credentials: "same-origin" });
      await loadScans();
    } catch {
      // ignore — list will refresh
    }
  };

  const cancelScan = async (id: string) => {
    try {
      await fetch(`/api/scans/${id}/cancel`, { method: "POST", credentials: "same-origin" });
      await loadScans();
    } catch {
      // ignore
    }
  };

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

  const queuedScans = (scans ?? []).filter((s) => s.status === "QUEUED");
  const runningScans = (scans ?? []).filter((s) => s.status === "RUNNING" || s.status === "ERROR");

  const filteredLogs = logs.filter(
    (l) =>
      logFilter.has(l.level) &&
      (logModule === "all" || l.module === logModule) &&
      (logSearch === "" ||
        l.message.toLowerCase().includes(logSearch.toLowerCase()) ||
        l.module.toLowerCase().includes(logSearch.toLowerCase())),
  );

  const logModules = ["all", ...Array.from(new Set(logs.map((l) => l.module)))];

  if (loading && !scans) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: ds.text.muted, fontSize: ds.size.sm }}>
        Loading scans…
      </div>
    );
  }

  if (error) {
    return (
      <DSCard style={{ padding: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <AlertCircle size={16} style={{ color: ds.severity.critical }} />
          <span style={{ fontSize: ds.size.sm, color: ds.severity.critical }}>Failed to load scans: {error}</span>
        </div>
        <DSButton variant="secondary" size="sm" icon={<RefreshCw size={11} />} onClick={loadScans}>Retry</DSButton>
      </DSCard>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {queuedScans.length > 0 && (
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
                    Queued at {formatHm(scan.createdAt)}
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
          {runningScans.length > 0 && <span style={{ color: ds.text.muted, fontWeight: ds.weight.regular }}>({runningScans.length})</span>}
        </SectionTitle>

        {runningScans.length === 0 ? (
          <DSCard style={{ padding: 48, textAlign: "center" }}>
            <ShieldCheck size={40} style={{ color: ds.text.muted, margin: "0 auto 14px" }} />
            <div style={{ fontSize: ds.size.lg, fontWeight: ds.weight.semibold, color: ds.text.secondary, marginBottom: 6 }}>All clear — no active scans</div>
            <div style={{ fontSize: ds.size.sm, color: ds.text.muted, marginBottom: 20 }}>The system is idle. Queue a new scan from the Compose tab.</div>
          </DSCard>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {runningScans.map((scan) => (
              <RunningCard key={scan.id} scan={scan} expanded={expandedLogs.has(scan.id)} onToggleLogs={() => toggleLogs(scan.id)} onCancel={() => cancelScan(scan.id)} />
            ))}
          </div>
        )}
      </div>

      {runningScans.length > 0 && (
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
              {filteredLogs.length === 0 ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: ds.text.muted, fontSize: 12 }}>
                  No logs streaming yet. Logs will appear here once a scan starts producing output.
                </div>
              ) : (
                filteredLogs.map((entry) => (
                  <div key={entry.id} style={{ display: "flex", alignItems: "flex-start", gap: 0, fontSize: 12, lineHeight: "20px", borderBottom: `1px solid rgba(39,39,42,0.15)` }}>
                    <span style={{ color: "#4b5563", minWidth: 66, flexShrink: 0 }}>{entry.time}</span>
                    <span style={{ color: LEVEL_COLORS[entry.level] ?? ds.text.muted, minWidth: 50, flexShrink: 0, fontWeight: 500 }}>{entry.level}</span>
                    <span style={{ color: "#4b5563", minWidth: 60, flexShrink: 0 }}>[{entry.module}]</span>
                    <span style={{ color: entry.message.includes("[FINDING]") ? ds.severity.high : "#9ca3af", flex: 1 }}>{entry.message}</span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RunningCard({ scan, expanded, onToggleLogs, onCancel }: { scan: ApiScan; expanded: boolean; onToggleLogs: () => void; onCancel: () => void }) {
  const progress = getProgress(scan);
  const findings = getFindingsBreakdown(scan);
  const hasError = scan.status === "ERROR";
  const errorMsg = scan.stats?.error || scan.stats?.errorMessage;
  const pct = progress.discovered > 0 ? Math.round((progress.scanned / progress.discovered) * 100) : 0;

  return (
    <DSCard style={{ padding: 0, overflow: "hidden" }}>
      {hasError && (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "12px 16px", backgroundColor: ds.severity.criticalBg, borderBottom: `1px solid ${ds.severity.critical}40` }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <AlertCircle size={15} style={{ color: ds.severity.critical, flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.severity.critical }}>Scan error</div>
              <div style={{ fontSize: ds.size.xs, color: ds.text.muted, marginTop: 2 }}>{errorMsg ?? "Scan halted with an error."}</div>
            </div>
          </div>
        </div>
      )}

      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              {!hasError && <Loader2 size={13} className="animate-spin" style={{ color: ds.severity.info }} />}
              <span style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.text.primary, fontFamily: "monospace" }}>{scan.target}</span>
            </div>
            <div style={{ fontSize: ds.size.xs, color: ds.text.muted }}>
              Module: <span style={{ color: ds.text.secondary }}>{progress.module}</span>
              {" · "}Elapsed: <span style={{ color: ds.text.secondary }}>{formatElapsed(scan.startedAt)}</span>
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
            const isDone = idx < progress.phase;
            const isActive = idx === progress.phase;
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

        {!hasError && progress.discovered > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>
                {progress.scanned} / {progress.discovered} endpoints
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
          {Object.entries(findings).map(([sev, count]) => (
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: ds.size.xs, fontWeight: ds.weight.semibold, color: ds.text.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>{children}</div>;
}
