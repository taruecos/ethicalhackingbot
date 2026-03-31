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
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { StatCard } from "@/components/stat-card";

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

export default function LiveMonitorPage() {
  const [activeScans, setActiveScans] = useState<ScanProgress[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [botOnline, setBotOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [logFilter, setLogFilter] = useState<string>("");
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

      {/* No active scans */}
      {activeScans.length === 0 && !loading && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-8 text-center">
          <Activity className="w-8 h-8 text-[var(--dim)] mx-auto mb-3" />
          <p className="text-sm text-[var(--dim)]">No active scans</p>
          <p className="text-xs text-[var(--dim)] mt-1">Launch a scan from Mission Control to see live progress here</p>
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
