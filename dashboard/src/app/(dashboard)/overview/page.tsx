"use client";

import { useEffect, useState } from "react";
import {
  Crosshair,
  AlertTriangle,
  Shield,
  Clock,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Activity,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { SeverityBadge } from "@/components/severity-badge";
import Link from "next/link";

interface ScanSummary {
  id: string;
  target: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  duration: number | null;
  stats: {
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
    info?: number;
    total?: number;
  };
  _count?: { findings: number };
}

interface OverviewData {
  totalScans: number;
  activeScans: number;
  totalFindings: number;
  criticalFindings: number;
  recentScans: ScanSummary[];
  severityBreakdown: { critical: number; high: number; medium: number; low: number; info: number };
}

const STATUS_ICONS: Record<string, { icon: React.ReactNode; color: string }> = {
  COMPLETE: { icon: <CheckCircle2 className="w-4 h-4" />, color: "var(--accent)" },
  ERROR: { icon: <XCircle className="w-4 h-4" />, color: "var(--red)" },
  RUNNING: { icon: <Loader2 className="w-4 h-4 animate-spin" />, color: "var(--blue)" },
  QUEUED: { icon: <Clock className="w-4 h-4" />, color: "var(--dim)" },
  CANCELLED: { icon: <XCircle className="w-4 h-4" />, color: "var(--dim)" },
};

export default function OverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [botOnline, setBotOnline] = useState(false);

  useEffect(() => {
    async function fetchOverview() {
      try {
        const [statsRes, statusRes] = await Promise.all([
          fetch("/api/stats/overview"),
          fetch("/api/status"),
        ]);
        if (statsRes.ok) setData(await statsRes.json());
        if (statusRes.ok) {
          const s = await statusRes.json();
          setBotOnline(s.online);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchOverview();
    const interval = setInterval(fetchOverview, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  const d = data || {
    totalScans: 0,
    activeScans: 0,
    totalFindings: 0,
    criticalFindings: 0,
    recentScans: [],
    severityBreakdown: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
  };

  const severityTotal =
    d.severityBreakdown.critical +
    d.severityBreakdown.high +
    d.severityBreakdown.medium +
    d.severityBreakdown.low +
    d.severityBreakdown.info || 1;

  return (
    <div className="space-y-6">
      {/* Bot Status Banner */}
      <div className={`flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border ${
        botOnline
          ? "bg-[var(--accent-dim)] border-[var(--accent)]/20"
          : "bg-[var(--red)]/10 border-[var(--red)]/20"
      }`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${botOnline ? "bg-[var(--accent)] animate-pulse" : "bg-[var(--red)]"}`} />
          <span className="text-sm font-medium">
            {botOnline ? "Bot is online and ready" : "Bot is offline"}
          </span>
          {d.activeScans > 0 && (
            <Link href="/monitor" className="flex items-center gap-1.5 text-xs text-[var(--blue)] hover:underline">
              <Activity className="w-3.5 h-3.5 animate-pulse" />
              {d.activeScans} active scan{d.activeScans > 1 ? "s" : ""} — View live
            </Link>
          )}
        </div>
        <Link
          href="/mission"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-black text-xs font-bold hover:opacity-90"
        >
          <Zap className="w-3.5 h-3.5" />
          New Scan
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Scans" value={d.totalScans} icon={Crosshair} color="var(--accent)" />
        <StatCard
          label="Active"
          value={d.activeScans}
          icon={Activity}
          color="var(--blue)"
          subtitle={d.activeScans > 0 ? "Running now" : "Idle"}
        />
        <StatCard
          label="Findings"
          value={d.totalFindings}
          icon={AlertTriangle}
          color="var(--orange)"
          subtitle={`${d.totalScans > 0 ? (d.totalFindings / d.totalScans).toFixed(1) : 0} per scan`}
        />
        <StatCard
          label="Critical"
          value={d.criticalFindings}
          icon={Shield}
          color="var(--red)"
          subtitle={d.criticalFindings > 0 ? "Needs attention" : "All clear"}
        />
      </div>

      {/* Severity Bar */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] uppercase tracking-widest text-[var(--dim)] font-semibold">
            Severity Distribution
          </h3>
          <Link href="/findings" className="text-[10px] text-[var(--accent)] hover:underline">
            View all findings →
          </Link>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden bg-[var(--surface2)]">
          {[
            { key: "critical", color: "var(--red)" },
            { key: "high", color: "var(--orange)" },
            { key: "medium", color: "var(--purple)" },
            { key: "low", color: "var(--blue)" },
            { key: "info", color: "var(--cyan)" },
          ].map(({ key, color }) => {
            const val = d.severityBreakdown[key as keyof typeof d.severityBreakdown];
            if (!val) return null;
            return (
              <div
                key={key}
                style={{ width: `${(val / severityTotal) * 100}%`, backgroundColor: color }}
                className="transition-all duration-500"
                title={`${key.toUpperCase()}: ${val}`}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 mt-3">
          {[
            { label: "Critical", value: d.severityBreakdown.critical, color: "var(--red)" },
            { label: "High", value: d.severityBreakdown.high, color: "var(--orange)" },
            { label: "Medium", value: d.severityBreakdown.medium, color: "var(--purple)" },
            { label: "Low", value: d.severityBreakdown.low, color: "var(--blue)" },
            { label: "Info", value: d.severityBreakdown.info, color: "var(--cyan)" },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[var(--dim)]">{label}</span>
              <span className="font-semibold" style={{ color }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Scans */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl">
        <div className="flex items-center justify-between px-3 sm:px-5 py-3 sm:py-4 border-b border-[var(--border)]">
          <h3 className="text-[10px] uppercase tracking-widest text-[var(--dim)] font-semibold">
            Recent Scans
          </h3>
          <Link
            href="/mission"
            className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1"
          >
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {d.recentScans.length === 0 ? (
            <div className="px-3 sm:px-5 py-8 text-center text-[var(--dim)] text-sm">
              No scans yet. Launch one from Mission Control.
            </div>
          ) : (
            d.recentScans.map((scan) => {
              const st = STATUS_ICONS[scan.status] || STATUS_ICONS.QUEUED;
              const findingsCount = scan._count?.findings || scan.stats.total || 0;
              const duration = scan.duration
                ? `${Math.round(scan.duration / 1000)}s`
                : scan.startedAt && scan.finishedAt
                ? `${Math.round((new Date(scan.finishedAt).getTime() - new Date(scan.startedAt).getTime()) / 1000)}s`
                : null;

              return (
                <div key={scan.id} className="px-4 py-3 flex items-start gap-3 hover:bg-[var(--surface2)] transition-colors">
                  <div className="mt-0.5" style={{ color: st.color }}>{st.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium truncate">{scan.target}</p>
                      <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: st.color }}>
                        {scan.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[var(--dim)]">
                      {scan.startedAt && (
                        <span>{new Date(scan.startedAt).toLocaleString()}</span>
                      )}
                      {duration && <span>{duration}</span>}
                      {scan.stats.critical ? <SeverityBadge severity="CRITICAL" /> : null}
                      {scan.stats.high ? (
                        <span className="text-[10px] font-bold text-[var(--orange)]">
                          {scan.stats.high} high
                        </span>
                      ) : null}
                      <span>{findingsCount} total</span>
                    </div>
                    <div className="flex gap-3 mt-1">
                      {scan.status === "RUNNING" && (
                        <Link
                          href="/monitor"
                          className="text-[10px] text-[var(--blue)] hover:underline"
                        >
                          Live →
                        </Link>
                      )}
                      <Link
                        href={`/findings?scan=${scan.id}`}
                        className="text-[10px] text-[var(--accent)] hover:underline"
                      >
                        Details →
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
