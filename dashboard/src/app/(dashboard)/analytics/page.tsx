"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  DollarSign,
  TrendingUp,
  Target,
  Award,
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { SeverityBadge } from "@/components/severity-badge";

interface AnalyticsData {
  totalBounties: number;
  totalRevenue: number;
  acceptanceRate: number;
  avgResponseTime: number;
  scansByMonth: Array<{ month: string; count: number }>;
  findingsBySeverity: Record<string, number>;
  topModules: Array<{ module: string; findings: number }>;
  revenueByMonth: Array<{ month: string; amount: number }>;
  platformStats: Array<{
    platform: string;
    scans: number;
    findings: number;
    reported: number;
    accepted: number;
    bounty: number;
  }>;
  topVulnerabilities: Array<{
    title: string;
    severity: string;
    count: number;
    module: string;
  }>;
  scanSuccessRate: number;
  totalTargets: number;
  findingsPerScan: number;
  falsePositiveRate: number;
}

interface TimeRange {
  label: string;
  value: string;
}

const TIME_RANGES: TimeRange[] = [
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "90d", value: "90d" },
  { label: "All", value: "all" },
];

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "var(--red)",
  HIGH: "var(--orange)",
  MEDIUM: "var(--purple)",
  LOW: "var(--blue)",
  INFO: "var(--cyan)",
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("all");

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch(`/api/stats/analytics?range=${timeRange}`);
        if (res.ok) setData(await res.json());
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, [timeRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  const d = data || {
    totalBounties: 0,
    totalRevenue: 0,
    acceptanceRate: 0,
    avgResponseTime: 0,
    scansByMonth: [],
    findingsBySeverity: {},
    topModules: [],
    revenueByMonth: [],
    platformStats: [],
    topVulnerabilities: [],
    scanSuccessRate: 0,
    totalTargets: 0,
    findingsPerScan: 0,
    falsePositiveRate: 0,
  };

  const totalFindings = Object.values(d.findingsBySeverity).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[10px] uppercase tracking-widest text-[var(--dim)] font-semibold">
          Analytics Dashboard
        </h2>
        <div className="flex gap-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg p-1">
          {TIME_RANGES.map((range) => (
            <button
              key={range.value}
              onClick={() => { setLoading(true); setTimeRange(range.value); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                timeRange === range.value
                  ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                  : "text-[var(--dim)] hover:text-[var(--text)]"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <StatCard
          label="Total Bounties"
          value={d.totalBounties}
          icon={Award}
          color="var(--accent)"
          subtitle={`${d.acceptanceRate}% acceptance`}
        />
        <StatCard
          label="Revenue"
          value={`€${d.totalRevenue.toLocaleString()}`}
          icon={DollarSign}
          color="var(--orange)"
        />
        <StatCard
          label="Targets Scanned"
          value={d.totalTargets}
          icon={Target}
          color="var(--blue)"
          subtitle={`${d.findingsPerScan.toFixed(1)} findings/scan`}
        />
        <StatCard
          label="Scan Success"
          value={`${d.scanSuccessRate}%`}
          icon={TrendingUp}
          color="var(--purple)"
          subtitle={`${d.falsePositiveRate}% false positive rate`}
        />
      </div>

      {/* Severity Distribution */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 sm:p-5">
        <h3 className="text-[10px] uppercase tracking-widest text-[var(--dim)] font-semibold mb-4">
          Findings by Severity
        </h3>
        {totalFindings === 0 ? (
          <div className="h-32 flex items-center justify-center text-sm text-[var(--dim)]">No findings data</div>
        ) : (
          <div className="space-y-3">
            {["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"].map((sev) => {
              const count = d.findingsBySeverity[sev] || 0;
              const pct = totalFindings > 0 ? (count / totalFindings) * 100 : 0;
              return (
                <div key={sev} className="flex items-center gap-2">
                  <div className="w-16 sm:w-20 shrink-0">
                    <SeverityBadge severity={sev} />
                  </div>
                  <div className="flex-1 h-7 bg-[var(--surface2)] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 flex items-center justify-end pr-3"
                      style={{
                        width: `${Math.max(pct, 3)}%`,
                        backgroundColor: SEVERITY_COLORS[sev],
                      }}
                    >
                      {pct > 10 && (
                        <span className="text-[10px] font-bold text-black">{count}</span>
                      )}
                    </div>
                  </div>
                  <div className="w-12 sm:w-16 text-right shrink-0">
                    <span className="text-xs font-bold" style={{ color: SEVERITY_COLORS[sev] }}>
                      {count}
                    </span>
                    <span className="text-[10px] text-[var(--dim)] ml-1 hidden sm:inline">({pct.toFixed(0)}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Scans per Month */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
          <h3 className="text-[10px] uppercase tracking-widest text-[var(--dim)] font-semibold mb-4">
            Scans per Month
          </h3>
          {d.scansByMonth.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-[var(--dim)]">No data yet</div>
          ) : (
            <div className="h-48 flex items-end gap-2">
              {d.scansByMonth.map((item) => {
                const max = Math.max(...d.scansByMonth.map((i) => i.count), 1);
                const height = (item.count / max) * 100;
                return (
                  <div key={item.month} className="flex-1 flex flex-col items-center gap-1 group">
                    <span className="text-xs font-semibold text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.count}
                    </span>
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-[var(--accent)] to-[var(--accent)]/60 transition-all hover:opacity-80"
                      style={{ height: `${Math.max(height, 4)}%` }}
                    />
                    <span className="text-[9px] text-[var(--dim)]">
                      {item.month.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Revenue per Month */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
          <h3 className="text-[10px] uppercase tracking-widest text-[var(--dim)] font-semibold mb-4">
            Revenue per Month
          </h3>
          {d.revenueByMonth.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-[var(--dim)]">No data yet</div>
          ) : (
            <div className="h-48 flex items-end gap-2">
              {d.revenueByMonth.map((item) => {
                const max = Math.max(...d.revenueByMonth.map((i) => i.amount), 1);
                const height = (item.amount / max) * 100;
                return (
                  <div key={item.month} className="flex-1 flex flex-col items-center gap-1 group">
                    <span className="text-xs font-semibold text-[var(--orange)] opacity-0 group-hover:opacity-100 transition-opacity">
                      €{item.amount}
                    </span>
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-[var(--orange)] to-[var(--orange)]/60 transition-all hover:opacity-80"
                      style={{ height: `${Math.max(height, 4)}%` }}
                    />
                    <span className="text-[9px] text-[var(--dim)]">
                      {item.month.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top Modules + Top Vulnerabilities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Modules */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
          <h3 className="text-[10px] uppercase tracking-widest text-[var(--dim)] font-semibold mb-4">
            Top Modules by Findings
          </h3>
          {d.topModules.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--dim)]">No data yet</div>
          ) : (
            <div className="space-y-3">
              {d.topModules.map((m, i) => {
                const max = Math.max(...d.topModules.map((i) => i.findings), 1);
                const width = (m.findings / max) * 100;
                return (
                  <div key={m.module} className="flex items-center gap-3">
                    <span className="text-[10px] text-[var(--dim)] w-5 text-right shrink-0">{i + 1}</span>
                    <span className="text-xs font-mono w-20 sm:w-28 truncate text-[var(--text)] shrink-0">{m.module}</span>
                    <div className="flex-1 h-6 bg-[var(--surface2)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent)] rounded-full transition-all flex items-center justify-end pr-2"
                        style={{ width: `${Math.max(width, 5)}%` }}
                      >
                        <span className="text-[10px] font-bold text-black">{m.findings}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Vulnerabilities */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
          <h3 className="text-[10px] uppercase tracking-widest text-[var(--dim)] font-semibold mb-4">
            Most Common Vulnerabilities
          </h3>
          {(!d.topVulnerabilities || d.topVulnerabilities.length === 0) ? (
            <div className="py-8 text-center text-sm text-[var(--dim)]">No data yet</div>
          ) : (
            <div className="space-y-2">
              {d.topVulnerabilities.map((v, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 bg-[var(--surface2)] rounded-lg">
                  <span className="text-[10px] text-[var(--dim)] w-5 text-right font-bold">#{i + 1}</span>
                  <SeverityBadge severity={v.severity} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{v.title}</p>
                    <p className="text-[10px] text-[var(--dim)]">{v.module}</p>
                  </div>
                  <span className="text-xs font-bold text-[var(--text)]">×{v.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Platform Breakdown */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 sm:p-5">
        <h3 className="text-[10px] uppercase tracking-widest text-[var(--dim)] font-semibold mb-4">
          Platform Performance
        </h3>
        {d.platformStats.length === 0 ? (
          <div className="py-8 text-center text-sm text-[var(--dim)]">No platform data yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-3 text-[10px] uppercase text-[var(--dim)] font-semibold">Platform</th>
                  <th className="text-right py-3 text-[10px] uppercase text-[var(--dim)] font-semibold">Scans</th>
                  <th className="text-right py-3 text-[10px] uppercase text-[var(--dim)] font-semibold">Findings</th>
                  <th className="text-right py-3 text-[10px] uppercase text-[var(--dim)] font-semibold">Reported</th>
                  <th className="text-right py-3 text-[10px] uppercase text-[var(--dim)] font-semibold">Accepted</th>
                  <th className="text-right py-3 text-[10px] uppercase text-[var(--dim)] font-semibold">Rate</th>
                  <th className="text-right py-3 text-[10px] uppercase text-[var(--dim)] font-semibold">Bounty</th>
                </tr>
              </thead>
              <tbody>
                {d.platformStats.map((p) => {
                  const rate = p.reported > 0 ? Math.round((p.accepted / p.reported) * 100) : 0;
                  return (
                    <tr key={p.platform} className="border-b border-[var(--border)]/50 hover:bg-[var(--surface2)]">
                      <td className="py-3 font-semibold">{p.platform}</td>
                      <td className="py-3 text-right text-[var(--dim)]">{p.scans}</td>
                      <td className="py-3 text-right">{p.findings}</td>
                      <td className="py-3 text-right text-[var(--blue)]">{p.reported}</td>
                      <td className="py-3 text-right text-[var(--accent)]">{p.accepted}</td>
                      <td className="py-3 text-right">
                        <span className={rate > 50 ? "text-[var(--accent)]" : rate > 25 ? "text-[var(--orange)]" : "text-[var(--red)]"}>
                          {rate}%
                        </span>
                      </td>
                      <td className="py-3 text-right text-[var(--orange)] font-semibold">
                        €{p.bounty.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
