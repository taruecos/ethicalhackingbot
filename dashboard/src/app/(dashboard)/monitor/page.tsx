"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Loader2,
  Activity,
  Cpu,
  HardDrive,
  MemoryStick,
  Wifi,
  WifiOff,
  Terminal,
  RefreshCw,
  Pause,
  Play,
  ChevronDown,
  Zap,
  Clock,
  Target,
  CheckCircle2,
  Shield,
  Globe,
  Ban,
  Info,
  X,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { StatCard } from "@/components/stat-card";

interface QueuedScan {
  id: string;
  target: string;
  status: string;
  programName: string | null;
  config: Record<string, unknown>;
  createdAt: string;
}

interface ScanProgress {
  id: string;
  target: string;
  status: string;
  phase: string;
  progress: number;
  modulesTotal: number;
  modulesDone: number;
  currentModule: string;
  startedAt: string;
  elapsed: number;
  findingsCount: number;
  stats: Record<string, number>;
  endpointsTotal: number;
  endpointsScanned: number;
  scopeEntries: string[];
  blockedUrls: number;
}

interface SystemMetrics {
  cpuPercent: number;
  memoryUsed: number;
  memoryTotal: number;
  diskUsed: number;
  diskTotal: number;
  uptime: number;
  requestsPerMinute: number;
  activeConnections: number;
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: "INFO" | "WARN" | "ERROR" | "DEBUG";
  module: string;
  message: string;
  scanId?: string;
}

const LOG_COLORS: Record<string, string> = {
  INFO: "text-[var(--accent)]",
  WARN: "text-[var(--orange)]",
  ERROR: "text-[var(--red)]",
  DEBUG: "text-[var(--dim)]",
};

const PHASE_STEPS = [
  { id: "init", label: "Init" },
  { id: "recon", label: "Recon" },
  { id: "scan", label: "Scan" },
  { id: "analysis", label: "Analysis" },
  { id: "report", label: "Report" },
];

interface ComplianceData {
  target: string;
  programName: string | null;
  scope: {
    entries: string[];
    source: "program" | "config" | "default";
    warnings: string[];
  };
  roe: {
    userAgent: string | null;
    requestHeader: string | null;
    safeHarbour: boolean;
    rateLimit: number;
    source: "program" | "config" | "default";
    warnings: string[];
  };
  modules: {
    enabled: string[];
    descriptions: Record<string, string>;
  };
  risks: string[];
  compliant: boolean;
}

export default function LiveMonitorPage() {
  const [activeScans, setActiveScans] = useState<ScanProgress[]>([]);
  const [queuedScans, setQueuedScans] = useState<QueuedScan[]>([]);
  const [startingId, setStartingId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [botOnline, setBotOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [logFilter, setLogFilter] = useState<string>("");
  const [complianceModal, setComplianceModal] = useState<ComplianceData | null>(null);
  const [complianceLoading, setComplianceLoading] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  const fetchStatus = useCallback(async () => {
    if (paused) return;
    try {
      const res = await fetch("/api/monitor", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setBotOnline(data.online);
        if (data.activeScans) setActiveScans(data.activeScans);
                if (data.queuedScans) setQueuedScans(data.queuedScans);
        if (data.metrics) setMetrics(data.metrics);
        if (data.logs && data.logs.length > 0) {
          setLogs((prev) => {
            const existingIds = new Set(prev.map((l) => l.id));
            const newLogs = data.logs.filter((l: LogEntry) => !existingIds.has(l.id));
            const combined = [...prev, ...newLogs];
            return combined.slice(-500);
          });
        }
      } else {
        setBotOnline(false);
      }
    } catch {
      setBotOnline(false);
    } finally {
      setLoading(false);
    }
  }, [paused]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  function handleLogsScroll() {
    if (!logsContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  }

  async function startScan(scanId: string) {
    setStartingId(scanId);
    try {
      const res = await fetch(`/api/scans/${scanId}/start`, { method: "POST" });
      if (res.ok) {
        setQueuedScans((prev) => prev.filter((s) => s.id !== scanId));
        fetchStatus();
      }
    } catch {
      // silent
    } finally {
      setStartingId(null);
    }
  }

  async function fetchCompliance(scanId: string) {
    setComplianceLoading(scanId);
    try {
      const res = await fetch(`/api/scans/${scanId}/compliance`);
      const data = await res.json();
      if (res.ok) {
        setComplianceModal(data as ComplianceData);
      } else {
        console.error("[Compliance]", data.error, data.details);
      }
    } catch (err) {
      console.error("[Compliance] fetch failed:", err);
    } finally {
      setComplianceLoading(null);
    }
  }

  function getPhaseIndex(phase: string): number {
    const idx = PHASE_STEPS.findIndex((p) => p.id === phase.toLowerCase());
    return idx >= 0 ? idx : 0;
  }

  function formatUptime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  function formatBytes(bytes: number): string {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  }

  const filteredLogs = logFilter
    ? logs.filter((l) => l.level === logFilter || l.module.toLowerCase().includes(logFilter.toLowerCase()))
    : logs;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold ${
            botOnline
              ? "bg-[var(--accent-dim)] text-[var(--accent)]"
              : "bg-[var(--red)]/15 text-[var(--red)]"
          }`}>
            {botOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {botOnline ? "Bot Online" : "Bot Offline"}
          </div>
          {activeScans.length > 0 && (
            <span className="text-xs text-[var(--blue)] flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 animate-pulse" />
              {activeScans.length} active scan{activeScans.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPaused(!paused)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              paused
                ? "bg-[var(--orange)]/15 text-[var(--orange)]"
                : "bg-[var(--surface2)] text-[var(--dim)] hover:text-[var(--text)]"
            }`}
          >
            {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            {paused ? "Resume" : "Pause"}
          </button>
          <button
            onClick={fetchStatus}
            className="p-1.5 rounded-lg bg-[var(--surface2)] text-[var(--dim)] hover:text-[var(--text)]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* System Metrics */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <StatCard
            label="CPU"
            value={`${metrics.cpuPercent}%`}
            icon={Cpu}
            color={metrics.cpuPercent > 80 ? "var(--red)" : metrics.cpuPercent > 50 ? "var(--orange)" : "var(--accent)"}
            subtitle={`${metrics.requestsPerMinute} req/min`}
          />
          <StatCard
            label="Memory"
            value={`${Math.round((metrics.memoryUsed / metrics.memoryTotal) * 100)}%`}
            icon={MemoryStick}
            color={metrics.memoryUsed / metrics.memoryTotal > 0.85 ? "var(--red)" : "var(--blue)"}
            subtitle={`${formatBytes(metrics.memoryUsed)} / ${formatBytes(metrics.memoryTotal)}`}
          />
          <StatCard
            label="Disk"
            value={`${Math.round((metrics.diskUsed / metrics.diskTotal) * 100)}%`}
            icon={HardDrive}
            color="var(--purple)"
            subtitle={`${formatBytes(metrics.diskUsed)} / ${formatBytes(metrics.diskTotal)}`}
          />
          <StatCard
            label="Uptime"
            value={formatUptime(metrics.uptime)}
            icon={Zap}
            color="var(--cyan)"
            subtitle={`${metrics.activeConnections} connections`}
          />
        </div>
      )}

      {/* Scan Queue */}
      {queuedScans.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[10px] uppercase tracking-widest text-[var(--dim)] font-semibold">
            Scan Queue ({queuedScans.length})
          </h3>
          {queuedScans.map((scan) => (
            <div
              key={scan.id}
              className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--orange)]/15 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-[var(--orange)]" />
                </div>
                <div>
                  <p className="text-sm font-bold">{scan.target}</p>
                  <p className="text-xs text-[var(--dim)]">
                    {scan.programName || "Manual scan"}
                    {" • Queued "}
                    {new Date(scan.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchCompliance(scan.id)}
                  disabled={complianceLoading === scan.id}
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--surface2)] text-[var(--dim)] hover:text-[var(--accent)] hover:bg-[var(--accent-dim)] transition-colors disabled:opacity-50"
                  title="Compliance Check"
                >
                  {complianceLoading === scan.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Info className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => startScan(scan.id)}
                  disabled={startingId === scan.id}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-black text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {startingId === scan.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  Start Scan
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active Scans Progress */}
      {activeScans.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[10px] uppercase tracking-widest text-[var(--dim)] font-semibold">
            Active Scans
          </h3>
          {activeScans.map((scan) => {
            const phaseIdx = getPhaseIndex(scan.phase);
            const elapsed = Math.round(scan.elapsed / 1000);
            const elapsedMin = Math.floor(elapsed / 60);
            const elapsedSec = elapsed % 60;

            return (
              <div
                key={scan.id}
                className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 sm:p-5"
              >
                {/* Scan header */}
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--blue)]/15 flex items-center justify-center shrink-0">
                      <Target className="w-4 h-4 text-[var(--blue)]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{scan.target}</p>
                      <p className="text-xs text-[var(--dim)]">
                        Module: <span className="text-[var(--accent)]">{scan.currentModule || "—"}</span>
                        {" • "}
                        {scan.modulesDone}/{scan.modulesTotal} modules
                      </p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="flex items-center gap-1 text-xs text-[var(--dim)]">
                      <Clock className="w-3 h-3" />
                      {elapsedMin > 0 ? `${elapsedMin}m ${elapsedSec}s` : `${elapsedSec}s`}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {scan.stats.critical > 0 && (
                        <span className="text-[10px] font-bold text-[var(--red)]">{scan.stats.critical} CRIT</span>
                      )}
                      {scan.stats.high > 0 && (
                        <span className="text-[10px] font-bold text-[var(--orange)]">{scan.stats.high} HIGH</span>
                      )}
                      <span className="text-[10px] text-[var(--dim)]">{scan.findingsCount} findings</span>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-[var(--dim)] uppercase tracking-wider font-semibold">
                      Progress
                    </span>
                    <span className="text-xs font-bold text-[var(--accent)]">
                      {Math.round(scan.progress)}%
                    </span>
                  </div>
                  <div className="h-2 bg-[var(--surface2)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[var(--blue)] to-[var(--accent)] rounded-full transition-all duration-500"
                      style={{ width: `${scan.progress}%` }}
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
            );
          })}
        </div>
      )}

      {/* No scans at all */}
      {activeScans.length === 0 && queuedScans.length === 0 && !loading && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-8 text-center">
          <Activity className="w-8 h-8 text-[var(--dim)] mx-auto mb-3" />
          <p className="text-sm text-[var(--dim)]">No scans in queue</p>
          <p className="text-xs text-[var(--dim)] mt-1">Add a scan from Programs to see it here</p>
        </div>
      )}

      {/* Compliance Modal */}
      {complianceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] sticky top-0 bg-[var(--surface)] rounded-t-2xl z-10">
              <div className="flex items-center gap-3">
                {complianceModal.compliant ? (
                  <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/15 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-[var(--red)]/15 flex items-center justify-center">
                    <ShieldAlert className="w-4 h-4 text-[var(--red)]" />
                  </div>
                )}
                <div>
                  <h2 className="text-sm font-bold">Compliance Check</h2>
                  <p className="text-xs text-[var(--dim)]">{complianceModal.target}</p>
                </div>
              </div>
              <button
                onClick={() => setComplianceModal(null)}
                className="p-1.5 rounded-lg hover:bg-[var(--surface2)] text-[var(--dim)] hover:text-[var(--text)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Overall status */}
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold ${
                complianceModal.compliant
                  ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                  : "bg-[var(--red)]/15 text-[var(--red)]"
              }`}>
                {complianceModal.compliant ? (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Scan is compliant — safe to start
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-4 h-4" />
                    Compliance issues detected — review before starting
                  </>
                )}
              </div>

              {/* Risks */}
              {complianceModal.risks.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-[10px] uppercase tracking-widest text-[var(--red)] font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Risks ({complianceModal.risks.length})
                  </h3>
                  <div className="space-y-1.5">
                    {complianceModal.risks.map((risk, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-[var(--red)] bg-[var(--red)]/10 rounded-lg px-3 py-2">
                        <Ban className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        {risk}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Scope */}
              <div className="space-y-2">
                <h3 className="text-[10px] uppercase tracking-widest text-[var(--dim)] font-semibold flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[var(--blue)]" />
                  Scope
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--surface2)] text-[var(--dim)] normal-case tracking-normal">
                    {complianceModal.scope.source}
                  </span>
                </h3>
                <div className="bg-[var(--bg)] rounded-xl p-3 space-y-1.5">
                  {complianceModal.scope.entries.map((entry, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <CheckCircle2 className="w-3 h-3 text-[var(--accent)] shrink-0" />
                      <span className="font-mono text-[var(--text)]">{entry}</span>
                    </div>
                  ))}
                  {complianceModal.scope.warnings.map((warn, i) => (
                    <div key={`w-${i}`} className="flex items-center gap-2 text-xs text-[var(--orange)]">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      {warn}
                    </div>
                  ))}
                </div>
              </div>

              {/* Rules of Engagement */}
              <div className="space-y-2">
                <h3 className="text-[10px] uppercase tracking-widest text-[var(--dim)] font-semibold flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[var(--purple)]" />
                  Rules of Engagement
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--surface2)] text-[var(--dim)] normal-case tracking-normal">
                    {complianceModal.roe.source}
                  </span>
                </h3>
                <div className="bg-[var(--bg)] rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--dim)]">User-Agent</span>
                    <span className={`font-mono text-[11px] ${complianceModal.roe.userAgent ? "text-[var(--text)]" : "text-[var(--dim)] italic"}`}>
                      {complianceModal.roe.userAgent || "Default"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--dim)]">Rate Limit</span>
                    <span className="font-mono text-[11px] text-[var(--text)]">{complianceModal.roe.rateLimit} req/min</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--dim)]">Custom Header</span>
                    <span className={`font-mono text-[11px] ${complianceModal.roe.requestHeader ? "text-[var(--text)]" : "text-[var(--dim)] italic"}`}>
                      {complianceModal.roe.requestHeader || "None"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--dim)]">Safe Harbour</span>
                    {complianceModal.roe.safeHarbour ? (
                      <span className="text-[var(--accent)] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Yes
                      </span>
                    ) : (
                      <span className="text-[var(--orange)] font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> No
                      </span>
                    )}
                  </div>
                  {complianceModal.roe.warnings.map((warn, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-[var(--orange)] pt-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      {warn}
                    </div>
                  ))}
                </div>
              </div>

              {/* Modules */}
              <div className="space-y-2">
                <h3 className="text-[10px] uppercase tracking-widest text-[var(--dim)] font-semibold flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-[var(--cyan)]" />
                  Scan Modules ({complianceModal.modules.enabled.length})
                </h3>
                <div className="bg-[var(--bg)] rounded-xl p-3 space-y-2">
                  {complianceModal.modules.enabled.length === 0 ? (
                    <p className="text-xs text-[var(--dim)] italic">No modules selected — recon only</p>
                  ) : (
                    complianceModal.modules.enabled.map((mod) => (
                      <div key={mod} className="text-xs">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3 h-3 text-[var(--accent)] shrink-0" />
                          <span className="font-bold text-[var(--text)] capitalize">{mod.replace(/_/g, " ")}</span>
                        </div>
                        {complianceModal.modules.descriptions[mod] && (
                          <p className="text-[var(--dim)] text-[11px] ml-5 mt-0.5">
                            {complianceModal.modules.descriptions[mod].split(" — ")[1] || complianceModal.modules.descriptions[mod]}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Modal footer */}
            <div className="px-5 py-4 border-t border-[var(--border)] sticky bottom-0 bg-[var(--surface)] rounded-b-2xl">
              <button
                onClick={() => setComplianceModal(null)}
                className="w-full py-2.5 rounded-xl bg-[var(--surface2)] text-[var(--text)] text-xs font-bold hover:bg-[var(--border)] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Logs */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[var(--accent)]" />
            <h3 className="text-[10px] uppercase tracking-widest text-[var(--dim)] font-semibold">
              Live Logs
            </h3>
            <span className="text-[10px] text-[var(--dim)]">{filteredLogs.length} entries</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Log level filter */}
            <div className="flex gap-1">
              {["INFO", "WARN", "ERROR", "DEBUG"].map((level) => (
                <button
                  key={level}
                  onClick={() => setLogFilter(logFilter === level ? "" : level)}
                  className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-colors ${
                    logFilter === level
                      ? `${LOG_COLORS[level]} bg-[var(--surface2)]`
                      : "text-[var(--dim)] hover:text-[var(--text)]"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`p-1 rounded ${autoScroll ? "text-[var(--accent)]" : "text-[var(--dim)]"}`}
              title={autoScroll ? "Auto-scroll on" : "Auto-scroll off"}
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div
          ref={logsContainerRef}
          onScroll={handleLogsScroll}
          className="h-[250px] sm:h-[300px] overflow-y-auto font-mono text-[10px] sm:text-xs p-2 sm:p-3 bg-[var(--bg)]"
        >
          {filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[var(--dim)] text-sm">
              {botOnline ? "Waiting for logs..." : "Bot is offline — no logs available"}
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="py-0.5 hover:bg-[var(--surface)] px-2 rounded">
                <div className="flex gap-2 flex-wrap">
                  <span className="text-[var(--dim)] whitespace-nowrap flex-shrink-0 text-[10px]">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`font-bold flex-shrink-0 text-[10px] ${LOG_COLORS[log.level] || "text-[var(--dim)]"}`}>
                    {log.level}
                  </span>
                  <span className="text-[var(--blue)] flex-shrink-0 truncate text-[10px] max-w-[120px]">
                    [{log.module}]
                  </span>
                </div>
                <span className="text-[var(--text)] break-all text-[11px] pl-1">
                  {log.message}
                </span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}
