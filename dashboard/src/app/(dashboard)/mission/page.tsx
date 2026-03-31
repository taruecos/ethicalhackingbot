"use client";

import { useEffect, useState } from "react";
import {
  Play,
  Square,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  RefreshCw,
  Settings2,
  Terminal,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { SeverityBadge } from "@/components/severity-badge";
import Link from "next/link";

interface ScanConfig {
  domain: string;
  depth: "quick" | "standard" | "deep";
  modules: string[];
  rateLimit: number;
  followRedirects: boolean;
}

interface Scan {
  id: string;
  target: string;
  status: string;
  config: ScanConfig;
  startedAt: string | null;
  finishedAt: string | null;
  duration: number | null;
  error: string | null;
  stats: Record<string, number>;
  phases: Array<{ name: string; time: string; status?: string }>;
  _count?: { findings: number };
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  module: string;
  message: string;
  scanId?: string;
}

const PHASE_STEPS = [
  { id: "init", label: "Init" },
  { id: "recon", label: "Recon" },
  { id: "scan", label: "Scan" },
  { id: "analysis", label: "Analysis" },
  { id: "report", label: "Report" },
];

const LOG_COLORS: Record<string, string> = {
  INFO: "text-[var(--accent)]",
  WARN: "text-[var(--orange)]",
  ERROR: "text-[var(--red)]",
  DEBUG: "text-[var(--dim)]",
};

const MODULES = [
  { id: "recon", label: "Recon", desc: "Tech detection, headers, subdomains" },
  { id: "xss", label: "XSS", desc: "Cross-site scripting" },
  { id: "sqli", label: "SQLi", desc: "SQL injection" },
  { id: "ssrf", label: "SSRF", desc: "Server-side request forgery" },
  { id: "lfi", label: "LFI", desc: "Local file inclusion" },
  { id: "open_redirect", label: "Open Redirect", desc: "Redirect vulnerabilities" },
  { id: "cors", label: "CORS", desc: "CORS misconfigurations" },
  { id: "exposed_files", label: "Exposed Files", desc: "Sensitive file detection" },
];

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  QUEUED: { icon: <Clock className="w-4 h-4" />, color: "var(--dim)", label: "Queued" },
  RUNNING: { icon: <Loader2 className="w-4 h-4 animate-spin" />, color: "var(--blue)", label: "Running" },
  COMPLETE: { icon: <CheckCircle2 className="w-4 h-4" />, color: "var(--accent)", label: "Complete" },
  ERROR: { icon: <XCircle className="w-4 h-4" />, color: "var(--red)", label: "Error" },
  CANCELLED: { icon: <Square className="w-4 h-4" />, color: "var(--dim)", label: "Cancelled" },
};

export default function MissionControlPage() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const [domain, setDomain] = useState("");
  const [depth, setDepth] = useState<"quick" | "standard" | "deep">("standard");
  const [selectedModules, setSelectedModules] = useState<string[]>(MODULES.map((m) => m.id));
  const [rateLimit, setRateLimit] = useState(30);
  const [expandedScan, setExpandedScan] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [botOnline, setBotOnline] = useState(false);

  useEffect(() => {
    fetchScans();
    fetchLogs();
    const scanInterval = setInterval(fetchScans, 3000);
    const logInterval = setInterval(fetchLogs, 2000);
    return () => {
      clearInterval(scanInterval);
      clearInterval(logInterval);
    };
  }, []);

  async function fetchScans() {
    try {
      const res = await fetch("/api/scans");
      if (res.ok) {
        const data = await res.json();
        const newScans = data.scans || [];
        setScans(newScans);
        // Auto-expand the first running scan
        const runningScan = newScans.find((s: Scan) => s.status === "RUNNING");
        if (runningScan && !expandedScan) {
          setExpandedScan(runningScan.id);
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function launchScan() {
    if (!domain.trim()) return;
    setLaunching(true);
    try {
      await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: domain.trim(),
          depth,
          modules: selectedModules,
          rateLimit,
        }),
      });
      setDomain("");
      await fetchScans();
    } catch {
      // silent
    } finally {
      setLaunching(false);
    }
  }

  async function fetchLogs() {
    try {
      const res = await fetch("/api/monitor", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setBotOnline(data.online);
        if (data.logs && data.logs.length > 0) {
          setLogs(data.logs);
        }
      }
    } catch {
      // silent
    }
  }

  function getPhaseIndex(phases: Array<{ name: string }>): number {
    if (phases.length === 0) return 0;
    const lastPhase = phases[phases.length - 1].name.toLowerCase();
    const idx = PHASE_STEPS.findIndex((p) => p.id === lastPhase);
    return idx >= 0 ? idx : 0;
  }

  function getProgress(phases: Array<{ name: string }>): number {
    if (phases.length === 0) return 0;
    return Math.min((phases.length / PHASE_STEPS.length) * 100, 99);
  }

  function getElapsed(startedAt: string | null): string {
    if (!startedAt) return "—";
    const ms = Date.now() - new Date(startedAt).getTime();
    const sec = Math.floor(ms / 1000);
    const min = Math.floor(sec / 60);
    const h = Math.floor(min / 60);
    if (h > 0) return `${h}h ${min % 60}m`;
    if (min > 0) return `${min}m ${sec % 60}s`;
    return `${sec}s`;
  }

  function getScanLogs(scanId: string): LogEntry[] {
    return logs.filter((l) => l.scanId === scanId);
  }

  async function cancelScan(scanId: string) {
    await fetch(`/api/scans/${scanId}/cancel`, { method: "POST" });
    await fetchScans();
  }

  async function deleteScan(scanId: string) {
    await fetch(`/api/scans/${scanId}`, { method: "DELETE" });
    await fetchScans();
  }

  function toggleModule(id: string) {
    setSelectedModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  return (
    <div className="space-y-6">
      {/* Launch Card */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 sm:p-5">
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-[10px] uppercase tracking-widest text-[var(--dim)] font-semibold flex-1">
            Launch Scan
          </h3>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${
              showConfig
                ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                : "bg-[var(--surface2)] text-[var(--dim)] hover:text-[var(--text)]"
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            Config
          </button>
        </div>

        {/* Domain input */}
        <div className="flex gap-2 sm:gap-3">
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && launchScan()}
            placeholder="example.com"
            className="flex-1 px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-sm font-mono focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-dim)] transition-all"
          />
          <button
            onClick={launchScan}
            disabled={launching || !domain.trim()}
            className="px-4 sm:px-6 py-3 rounded-xl bg-[var(--accent)] text-black font-bold text-sm hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center gap-2"
          >
            {launching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Scan</span>
          </button>
        </div>

        {/* Config panel */}
        {showConfig && (
          <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-4">
            {/* Depth */}
            <div>
              <label className="text-xs text-[var(--dim)] font-semibold uppercase tracking-wider block mb-2">
                Scan Depth
              </label>
              <div className="flex gap-2">
                {(["quick", "standard", "deep"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDepth(d)}
                    className={`px-4 py-2 rounded-lg text-xs font-medium capitalize transition-colors ${
                      depth === d
                        ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                        : "bg-[var(--surface2)] text-[var(--dim)] hover:text-[var(--text)]"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Rate limit */}
            <div>
              <label className="text-xs text-[var(--dim)] font-semibold uppercase tracking-wider block mb-2">
                Rate Limit: {rateLimit} req/min
              </label>
              <input
                type="range"
                min={5}
                max={120}
                value={rateLimit}
                onChange={(e) => setRateLimit(Number(e.target.value))}
                className="w-full accent-[var(--accent)]"
              />
            </div>

            {/* Modules */}
            <div>
              <label className="text-xs text-[var(--dim)] font-semibold uppercase tracking-wider block mb-2">
                Modules
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {MODULES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => toggleModule(m.id)}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      selectedModules.includes(m.id)
                        ? "border-[var(--accent)] bg-[var(--accent-dim)]"
                        : "border-[var(--border)] bg-[var(--surface2)] opacity-50"
                    }`}
                  >
                    <p className="text-xs font-semibold">{m.label}</p>
                    <p className="text-[10px] text-[var(--dim)] mt-0.5">{m.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scans List */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-[10px] uppercase tracking-widest text-[var(--dim)] font-semibold">
            All Scans ({scans.length})
          </h3>
          <button onClick={fetchScans} className="text-[var(--dim)] hover:text-[var(--text)]">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--accent)]" />
          </div>
        ) : scans.length === 0 ? (
          <div className="px-5 py-12 text-center text-[var(--dim)] text-sm">
            No scans yet. Enter a domain above to get started.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {scans.map((scan) => {
              const st = STATUS_CONFIG[scan.status] || STATUS_CONFIG.QUEUED;
              const isRunning = scan.status === "RUNNING";
              const isExpanded = expandedScan === scan.id;
              const phaseIdx = getPhaseIndex(scan.phases);
              const progress = getProgress(scan.phases);
              const scanLogs = getScanLogs(scan.id);
              const findingsCount = scan._count?.findings ?? Object.values(scan.stats || {}).reduce((a, b) => a + (typeof b === "number" ? b : 0), 0);

              return (
                <div
                  key={scan.id}
                  className="px-4 py-4 hover:bg-[var(--surface2)] transition-colors"
                >
                  {/* Header row */}
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5" style={{ color: st.color }}>{st.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold truncate">{scan.target}</p>
                        <span
                          className="text-[10px] uppercase font-bold tracking-wider"
                          style={{ color: st.color }}
                        >
                          {st.label}
                        </span>
                        {isRunning && (
                          <span className="text-[10px] text-[var(--dim)] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {getElapsed(scan.startedAt)}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[var(--dim)]">
                        {scan.startedAt && (
                          <span>{new Date(scan.startedAt).toLocaleString()}</span>
                        )}
                        {scan.duration && <span>{Math.round(scan.duration / 1000)}s</span>}
                        {findingsCount > 0 && (
                          <span className="text-[var(--accent)]">{findingsCount} findings</span>
                        )}
                        {scan.error && (
                          <span className="text-[var(--red)] truncate max-w-[200px]">
                            {scan.error}
                          </span>
                        )}
                      </div>
                      {/* Stats badges */}
                      {scan.stats && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {Object.entries(scan.stats)
                            .filter(([k]) => k !== "total")
                            .map(([sev, count]) =>
                              count > 0 ? (
                                <SeverityBadge key={sev} severity={sev.toUpperCase()} />
                              ) : null
                            )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 shrink-0">
                      {(isRunning || scanLogs.length > 0) && (
                        <button
                          onClick={() => setExpandedScan(isExpanded ? null : scan.id)}
                          className="p-2 rounded-lg hover:bg-[var(--surface2)] text-[var(--blue)]"
                          title={isExpanded ? "Collapse" : "Expand details"}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                      {isRunning && (
                        <button
                          onClick={() => cancelScan(scan.id)}
                          className="p-2 rounded-lg hover:bg-[var(--surface2)] text-[var(--orange)]"
                          title="Cancel"
                        >
                          <Square className="w-4 h-4" />
                        </button>
                      )}
                      {scan.status === "COMPLETE" && (
                        <Link
                          href={`/findings?scan=${scan.id}`}
                          className="p-2 rounded-lg hover:bg-[var(--surface2)] text-[var(--accent)]"
                          title="View Findings"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </Link>
                      )}
                      <button
                        onClick={() => deleteScan(scan.id)}
                        className="p-2 rounded-lg hover:bg-[var(--surface2)] text-[var(--dim)] hover:text-[var(--red)]"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Progress bar + Phase steps for RUNNING scans */}
                  {isRunning && (
                    <div className="mt-3 ml-7 space-y-3">
                      {/* Progress bar */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-[var(--dim)] uppercase tracking-wider font-semibold">
                            Progress
                          </span>
                          <span className="text-xs font-bold text-[var(--accent)]">
                            {Math.round(progress)}%
                          </span>
                        </div>
                        <div className="h-2 bg-[var(--surface2)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[var(--blue)] to-[var(--accent)] rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Phase steps */}
                      <div className="flex items-center gap-1">
                        {PHASE_STEPS.map((step, i) => {
                          const isComplete = i < phaseIdx;
                          const isCurrent = i === phaseIdx;
                          return (
                            <div key={step.id} className="flex items-center flex-1">
                              <div className="flex flex-col items-center flex-1">
                                <div
                                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                                    isComplete
                                      ? "bg-[var(--accent)] text-black"
                                      : isCurrent
                                      ? "bg-[var(--blue)] text-white animate-pulse"
                                      : "bg-[var(--surface2)] text-[var(--dim)]"
                                  }`}
                                >
                                  {isComplete ? (
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  ) : (
                                    i + 1
                                  )}
                                </div>
                                <span
                                  className={`text-[9px] mt-1 ${
                                    isCurrent ? "text-[var(--blue)] font-semibold" : "text-[var(--dim)]"
                                  }`}
                                >
                                  {step.label}
                                </span>
                              </div>
                              {i < PHASE_STEPS.length - 1 && (
                                <div
                                  className={`h-0.5 flex-1 mx-1 rounded-full transition-all ${
                                    isComplete ? "bg-[var(--accent)]" : "bg-[var(--surface2)]"
                                  }`}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Expanded: Live logs for this scan */}
                  {isExpanded && (
                    <div className="mt-3 ml-7 bg-[var(--bg)] border border-[var(--border)] rounded-xl overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
                        <Terminal className="w-3.5 h-3.5 text-[var(--accent)]" />
                        <span className="text-[10px] uppercase tracking-widest text-[var(--dim)] font-semibold">
                          Scan Logs
                        </span>
                        {!botOnline && (
                          <span className="text-[10px] text-[var(--red)] font-bold ml-auto">Bot Offline</span>
                        )}
                      </div>
                      <div className="h-[180px] overflow-y-auto font-mono text-[10px] sm:text-xs p-2">
                        {scanLogs.length === 0 ? (
                          <div className="flex items-center justify-center h-full text-[var(--dim)] text-sm">
                            {botOnline ? "Waiting for logs..." : "Bot offline — no logs"}
                          </div>
                        ) : (
                          scanLogs.map((log) => (
                            <div key={log.id} className="py-0.5 hover:bg-[var(--surface)] px-2 rounded">
                              <span className="text-[var(--dim)] mr-2 text-[10px]">
                                {new Date(log.timestamp).toLocaleTimeString()}
                              </span>
                              <span className={`font-bold mr-2 text-[10px] ${LOG_COLORS[log.level] || "text-[var(--dim)]"}`}>
                                {log.level}
                              </span>
                              <span className="text-[var(--text)] break-all text-[11px]">
                                {log.message}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
