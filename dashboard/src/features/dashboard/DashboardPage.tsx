"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  RefreshCw,
  CheckCircle2,
  Loader2,
  WifiOff,
  ScanLine,
  Bug,
  AlertTriangle,
  Target,
  Trophy,
  Euro,
  Percent,
  RotateCcw,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { ds } from "@/components/ds/tokens";
import { DSCard } from "@/components/ds/DSCard";
import { DSButton } from "@/components/ds/DSButton";
import { DSEmptyState } from "@/components/ds/DSEmptyState";

type ActiveTab = "today" | "historical";
type TimeRange = "7d" | "30d" | "90d" | "all";

type SeverityKey = "critical" | "high" | "medium" | "low" | "info";

interface RecentScan {
  id: string;
  target: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  stats: any;
}

interface OverviewData {
  totalScans: number;
  activeScans: number;
  totalFindings: number;
  criticalFindings: number;
  recentScans: RecentScan[];
  severityBreakdown: Record<SeverityKey, number>;
}

interface AnalyticsData {
  totalBounties: number;
  totalRevenue: number;
  acceptanceRate: number;
  totalTargets: number;
  scanSuccessRate: number;
  scansByMonth: { month: string; count: number }[];
  revenueByMonth: { month: string; amount: number }[];
  topModules: { module: string; findings: number }[];
  platformStats: {
    platform: string;
    scans: number;
    findings: number;
    reported: number;
    accepted: number;
    bounty: number;
  }[];
}

function Skeleton({ width = "100%", height = 16, radius = ds.radius.md }: { width?: string | number; height?: number; radius?: number }) {
  return <div className="animate-pulse" style={{ width, height, borderRadius: radius, backgroundColor: ds.bg.elevated }} />;
}

function StatCardSkeleton() {
  return (
    <div style={{ backgroundColor: ds.bg.surface, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Skeleton width={120} height={12} />
        <Skeleton width={28} height={28} radius={ds.radius.md} />
      </div>
      <Skeleton width={72} height={32} />
      <Skeleton width={100} height={10} />
    </div>
  );
}

function CardSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div style={{ backgroundColor: ds.bg.surface, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg, padding: 20, height, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Skeleton width={140} height={13} />
        <Skeleton width={60} height={13} />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
        {[80, 55, 65, 40, 70].map((w, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Skeleton width={80} height={10} />
            <Skeleton width={`${w}%`} height={8} radius={4} />
            <Skeleton width={30} height={10} />
          </div>
        ))}
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  COMPLETE: "COMPLETED",
  RUNNING: "RUNNING",
  ERROR: "FAILED",
  CANCELLED: "FAILED",
  QUEUED: "QUEUED",
};

function ScanStatusBadge({ status }: { status: string }) {
  const display = STATUS_LABEL[status] ?? status;
  const configs: Record<string, { color: string; bg: string }> = {
    COMPLETED: { color: ds.accent.default, bg: ds.accent.bg15 },
    RUNNING: { color: ds.severity.info, bg: ds.severity.infoBg },
    FAILED: { color: ds.severity.critical, bg: ds.severity.criticalBg },
    QUEUED: { color: ds.text.muted, bg: "rgba(113,113,122,0.12)" },
  };
  const cfg = configs[display] ?? { color: ds.text.muted, bg: "rgba(113,113,122,0.12)" };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 20, padding: "0 8px", borderRadius: ds.radius.md, backgroundColor: cfg.bg, color: cfg.color, fontSize: ds.size.xs, fontWeight: ds.weight.medium, whiteSpace: "nowrap" }}>
      {display === "RUNNING" ? (
        <Loader2 size={9} className="animate-spin" style={{ color: cfg.color }} />
      ) : (
        <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: cfg.color }} />
      )}
      {display.charAt(0) + display.slice(1).toLowerCase()}
    </span>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaPositive?: boolean;
  icon: React.ReactNode;
  valueColor?: string;
  footer?: React.ReactNode;
  spinning?: boolean;
}
function StatCard({ label, value, delta, deltaPositive, icon, valueColor, footer, spinning }: StatCardProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ backgroundColor: ds.bg.surface, border: `1px solid ${hovered ? ds.border.accent20 : ds.border.default}`, borderRadius: ds.radius.lg, padding: 20, display: "flex", flexDirection: "column", gap: 10, transition: "all 0.15s ease", cursor: "default" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: ds.size.xs, fontWeight: ds.weight.medium, color: ds.text.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
        <div style={{ width: 30, height: 30, borderRadius: ds.radius.md, backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: ds.size["3xl"], fontWeight: ds.weight.bold, color: valueColor ?? ds.text.primary, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{value}</span>
        {spinning && <Loader2 size={16} className="animate-spin" style={{ color: ds.accent.default }} />}
      </div>

      {delta && (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {deltaPositive !== undefined && (deltaPositive ? <ArrowUp size={11} style={{ color: ds.accent.default }} /> : <ArrowDown size={11} style={{ color: ds.severity.critical }} />)}
          <span style={{ fontSize: ds.size.xs, color: deltaPositive === undefined ? ds.text.muted : deltaPositive ? ds.accent.default : ds.severity.critical }}>{delta}</span>
        </div>
      )}

      {footer && <div>{footer}</div>}
    </div>
  );
}

function ChartTooltip({ active, payload, label, prefix = "", suffix = "" }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.md, padding: "8px 12px", boxShadow: "0 4px 16px rgba(0,0,0,0.4)" }}>
      <div style={{ fontSize: ds.size.xs, color: ds.text.muted, marginBottom: 4 }}>{label}</div>
      {payload.map((entry: any, i: number) => (
        <div key={i} style={{ fontSize: ds.size.sm, fontWeight: ds.weight.medium, color: entry.color }}>
          {prefix}
          {entry.value.toLocaleString()}
          {suffix}
        </div>
      ))}
    </div>
  );
}

function formatDuration(startedAt: string | null, finishedAt: string | null): string {
  if (!startedAt) return "—";
  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function getFindingsCount(stats: any): number {
  if (!stats || typeof stats !== "object") return 0;
  return Number(stats.findings || stats.findingsCount || 0) || 0;
}

function TodayContent({ data, loading, error, onRetry }: { data: OverviewData | null; loading: boolean; error: string | null; onRetry: () => void }) {
  if (loading) {
    return (
      <div>
        <div className="animate-pulse" style={{ height: 48, borderRadius: ds.radius.lg, backgroundColor: ds.bg.elevated, marginBottom: 24 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
          {[0, 1, 2, 3].map((i) => <StatCardSkeleton key={i} />)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <CardSkeleton height={280} />
          <CardSkeleton height={280} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: ds.radius.lg, backgroundColor: ds.severity.criticalBg, border: `1px solid ${ds.severity.critical}40`, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <WifiOff size={16} style={{ color: ds.severity.critical, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.severity.critical }}>Failed to load dashboard data</div>
              <div style={{ fontSize: ds.size.xs, color: ds.text.muted, marginTop: 2 }}>{error}</div>
            </div>
          </div>
          <DSButton variant="danger" size="sm" icon={<RotateCcw size={12} />} onClick={onRetry}>Retry</DSButton>
        </div>
      </div>
    );
  }

  if (!data || data.totalScans === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 480 }}>
        <DSEmptyState
          icon={ScanLine}
          title="No scans yet"
          description="Run your first scan to start discovering vulnerabilities across your programs."
          ctaLabel="Run your first scan"
          onCta={() => { window.location.href = "/scans"; }}
        />
      </div>
    );
  }

  const severityEntries: { key: SeverityKey; label: string; count: number; color: string; bg: string }[] = [
    { key: "critical", label: "Critical", count: data.severityBreakdown.critical, color: ds.severity.critical, bg: ds.severity.criticalBg },
    { key: "high", label: "High", count: data.severityBreakdown.high, color: ds.severity.high, bg: ds.severity.highBg },
    { key: "medium", label: "Medium", count: data.severityBreakdown.medium, color: ds.severity.medium, bg: ds.severity.mediumBg },
    { key: "low", label: "Low", count: data.severityBreakdown.low, color: ds.severity.low, bg: ds.severity.lowBg },
    { key: "info", label: "Info", count: data.severityBreakdown.info, color: ds.severity.info, bg: ds.severity.infoBg },
  ];
  const severityTotal = severityEntries.reduce((a, b) => a + b.count, 0);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: ds.radius.lg, backgroundColor: ds.accent.bg15, border: `1px solid ${ds.accent.bg20}`, marginBottom: 24 }}>
        <CheckCircle2 size={14} style={{ color: ds.accent.default, flexShrink: 0 }} />
        <span style={{ fontSize: ds.size.sm, fontWeight: ds.weight.medium, color: ds.accent.default }}>
          {data.activeScans > 0 ? `${data.activeScans} scan${data.activeScans > 1 ? "s" : ""} active` : "No active scans"}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Scans" value={data.totalScans} icon={<ScanLine size={14} style={{ color: ds.text.muted }} />} />
        <StatCard label="Active Scans" value={data.activeScans} delta={data.activeScans > 0 ? "in progress" : "idle"} icon={<Loader2 size={14} style={{ color: ds.text.muted }} />} spinning={data.activeScans > 0} />
        <StatCard label="Total Findings" value={data.totalFindings} icon={<Bug size={14} style={{ color: ds.text.muted }} />} />
        <StatCard label="Critical Findings" value={data.criticalFindings} icon={<AlertTriangle size={14} style={{ color: ds.severity.critical }} />} valueColor={data.criticalFindings > 0 ? ds.severity.critical : undefined} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <DSCard style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <span style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.text.primary }}>Severity Distribution</span>
            <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>{severityTotal} findings</span>
          </div>

          {severityTotal === 0 ? (
            <div style={{ padding: "30px 0", textAlign: "center", color: ds.text.muted, fontSize: ds.size.sm }}>No findings yet</div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {severityEntries.map(({ key, label, count, color }) => {
                  const pct = severityTotal > 0 ? Math.round((count / severityTotal) * 100) : 0;
                  return (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 60, flexShrink: 0 }}>
                        <span style={{ fontSize: ds.size.xs, fontWeight: ds.weight.medium, color }}>{label}</span>
                      </div>
                      <div style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: ds.bg.elevated, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 4, backgroundColor: color, transition: "width 0.6s ease" }} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, width: 64, justifyContent: "flex-end" }}>
                        <span style={{ fontSize: ds.size.xs, fontWeight: ds.weight.semibold, color: ds.text.primary, fontVariantNumeric: "tabular-nums" }}>{count}</span>
                        <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", marginTop: 20 }}>
                {severityEntries.map(({ key, count, color }) => (
                  count > 0 ? <div key={key} style={{ flex: count, backgroundColor: color }} /> : null
                ))}
              </div>
            </>
          )}
        </DSCard>

        <DSCard style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.text.primary }}>Recent Scans</span>
            <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>Last {data.recentScans.length}</span>
          </div>

          {data.recentScans.length === 0 ? (
            <div style={{ padding: "30px 0", textAlign: "center", color: ds.text.muted, fontSize: ds.size.sm }}>No scans yet</div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 70px 50px", gap: 8, padding: "0 0 8px", borderBottom: `1px solid ${ds.border.default}`, marginBottom: 8 }}>
                {["Target", "Status", "Duration", "Finds"].map((h) => (
                  <span key={h} style={{ fontSize: ds.size.xs, color: ds.text.muted, fontWeight: ds.weight.medium, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
                ))}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {data.recentScans.map((scan) => {
                  const findings = getFindingsCount(scan.stats);
                  return (
                    <div key={scan.id} style={{ display: "grid", gridTemplateColumns: "1fr 90px 70px 50px", gap: 8, padding: "7px 0", borderRadius: ds.radius.md, alignItems: "center", borderBottom: `1px solid ${ds.border.default}` }}>
                      <span style={{ fontSize: ds.size.xs, color: ds.text.secondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }}>{scan.target}</span>
                      <ScanStatusBadge status={scan.status} />
                      <span style={{ fontSize: ds.size.xs, color: ds.text.muted, fontVariantNumeric: "tabular-nums" }}>{formatDuration(scan.startedAt, scan.finishedAt)}</span>
                      <span style={{ fontSize: ds.size.xs, fontWeight: ds.weight.semibold, color: findings > 0 ? ds.severity.high : ds.text.muted, fontVariantNumeric: "tabular-nums" }}>
                        {findings > 0 ? findings : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </DSCard>
      </div>
    </div>
  );
}

function HistoricalContent({ timeRange, setTimeRange, data, loading, error, onRetry }: { timeRange: TimeRange; setTimeRange: (r: TimeRange) => void; data: AnalyticsData | null; loading: boolean; error: string | null; onRetry: () => void }) {
  if (loading) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
          <div className="animate-pulse" style={{ width: 200, height: 30, borderRadius: ds.radius.lg, backgroundColor: ds.bg.elevated }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
          {[0, 1, 2, 3].map((i) => <StatCardSkeleton key={i} />)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <CardSkeleton height={260} />
          <CardSkeleton height={260} />
          <CardSkeleton height={320} />
          <CardSkeleton height={320} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: ds.radius.lg, backgroundColor: ds.severity.criticalBg, border: `1px solid ${ds.severity.critical}40` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <WifiOff size={16} style={{ color: ds.severity.critical, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.severity.critical }}>Failed to load analytics</div>
            <div style={{ fontSize: ds.size.xs, color: ds.text.muted, marginTop: 2 }}>{error}</div>
          </div>
        </div>
        <DSButton variant="danger" size="sm" icon={<RotateCcw size={12} />} onClick={onRetry}>Retry</DSButton>
      </div>
    );
  }

  const hasData = data && (data.totalBounties > 0 || data.totalTargets > 0 || data.scansByMonth.length > 0);

  if (!hasData) {
    return (
      <div>
        <TimeRangePicker timeRange={timeRange} setTimeRange={setTimeRange} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 420 }}>
          <DSEmptyState
            icon={Trophy}
            title="No historical data yet"
            description="Once you complete your first scan and report findings, your historical analytics will appear here."
            ctaLabel="Start scanning"
            onCta={() => { window.location.href = "/scans"; }}
          />
        </div>
      </div>
    );
  }

  const maxModule = data!.topModules.length > 0 ? data!.topModules[0].findings : 1;
  const formatEur = (v: number) => `€${v.toLocaleString()}`;

  return (
    <div>
      <TimeRangePicker timeRange={timeRange} setTimeRange={setTimeRange} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Bounties" value={data!.totalBounties} delta="reports accepted" icon={<Trophy size={14} style={{ color: ds.severity.high }} />} />
        <StatCard label="Revenue" value={formatEur(data!.totalRevenue)} delta="EUR total" deltaPositive={true} icon={<Euro size={14} style={{ color: ds.accent.default }} />} valueColor={ds.accent.default} />
        <StatCard label="Targets Scanned" value={data!.totalTargets} delta="unique hosts" icon={<Target size={14} style={{ color: ds.severity.info }} />} />
        <StatCard label="Success Rate" value={`${data!.scanSuccessRate}%`} delta="findings → accepted" icon={<Percent size={14} style={{ color: ds.severity.medium }} />} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <DSCard style={{ padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.text.primary }}>Scans per Month</div>
            <div style={{ fontSize: ds.size.xs, color: ds.text.muted, marginTop: 2 }}>Last 12 months</div>
          </div>
          {data!.scansByMonth.length === 0 ? (
            <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: ds.text.muted, fontSize: ds.size.sm }}>No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data!.scansByMonth} barSize={24} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(39,39,42,0.35)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: ds.text.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: ds.text.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip suffix=" scans" />} cursor={{ fill: "rgba(39,39,42,0.25)" }} />
                <Bar dataKey="count" fill={ds.accent.default} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </DSCard>

        <DSCard style={{ padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.text.primary }}>Revenue per Month</div>
            <div style={{ fontSize: ds.size.xs, color: ds.text.muted, marginTop: 2 }}>EUR · Last 12 months</div>
          </div>
          {data!.revenueByMonth.length === 0 ? (
            <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: ds.text.muted, fontSize: ds.size.sm }}>No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data!.revenueByMonth} barSize={24} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(39,39,42,0.35)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: ds.text.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} tick={{ fill: ds.text.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip prefix="€" />} cursor={{ fill: "rgba(39,39,42,0.25)" }} />
                <Bar dataKey="amount" fill={ds.severity.medium} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </DSCard>

        <DSCard style={{ padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.text.primary }}>Top Modules by Findings</div>
            <div style={{ fontSize: ds.size.xs, color: ds.text.muted, marginTop: 2 }}>{timeRange === "all" ? "All time" : `Last ${timeRange}`}</div>
          </div>
          {data!.topModules.length === 0 ? (
            <div style={{ padding: "30px 0", textAlign: "center", color: ds.text.muted, fontSize: ds.size.sm }}>No findings yet</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data!.topModules.map(({ module, findings }, idx) => (
                <div key={module} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: ds.size.xs, color: ds.text.muted, width: 16, textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{idx + 1}</span>
                  <div style={{ width: 96, flexShrink: 0 }}>
                    <span style={{ fontSize: ds.size.xs, color: ds.text.secondary }}>{module}</span>
                  </div>
                  <div style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: ds.bg.elevated, overflow: "hidden" }}>
                    <div style={{ width: `${(findings / maxModule) * 100}%`, height: "100%", borderRadius: 3, backgroundColor: idx === 0 ? ds.severity.critical : idx < 3 ? ds.severity.high : ds.accent.default, transition: "width 0.5s ease" }} />
                  </div>
                  <span style={{ fontSize: ds.size.xs, fontWeight: ds.weight.semibold, color: ds.text.primary, width: 28, textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{findings}</span>
                </div>
              ))}
            </div>
          )}
        </DSCard>

        <DSCard style={{ padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.text.primary }}>Platform Performance</div>
            <div style={{ fontSize: ds.size.xs, color: ds.text.muted, marginTop: 2 }}>{timeRange === "all" ? "All time" : `Last ${timeRange}`}</div>
          </div>

          {data!.platformStats.length === 0 ? (
            <div style={{ padding: "30px 0", textAlign: "center", color: ds.text.muted, fontSize: ds.size.sm }}>No bounty records yet</div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "100px 50px 70px 70px 70px 70px", gap: 4, paddingBottom: 8, borderBottom: `1px solid ${ds.border.default}`, marginBottom: 6 }}>
                {["Platform", "Scans", "Findings", "Reported", "Accepted", "Bounty"].map((h) => (
                  <span key={h} style={{ fontSize: ds.size.xs, color: ds.text.muted, fontWeight: ds.weight.medium, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: h !== "Platform" ? "right" : "left" }}>{h}</span>
                ))}
              </div>

              {data!.platformStats.map((row, i) => (
                <div key={row.platform} style={{ display: "grid", gridTemplateColumns: "100px 50px 70px 70px 70px 70px", gap: 4, padding: "8px 0", borderBottom: i < data!.platformStats.length - 1 ? `1px solid ${ds.border.default}` : "none", alignItems: "center" }}>
                  <span style={{ fontSize: ds.size.xs, fontWeight: ds.weight.medium, color: ds.text.primary }}>{row.platform}</span>
                  <span style={{ fontSize: ds.size.xs, color: ds.text.muted, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.scans}</span>
                  <span style={{ fontSize: ds.size.xs, color: ds.text.muted, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.findings}</span>
                  <span style={{ fontSize: ds.size.xs, color: ds.text.muted, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.reported}</span>
                  <span style={{ fontSize: ds.size.xs, color: ds.accent.default, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: ds.weight.medium }}>{row.accepted}</span>
                  <span style={{ fontSize: ds.size.xs, color: ds.text.primary, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: ds.weight.semibold }}>{formatEur(row.bounty)}</span>
                </div>
              ))}
            </>
          )}
        </DSCard>
      </div>
    </div>
  );
}

function TimeRangePicker({ timeRange, setTimeRange }: { timeRange: TimeRange; setTimeRange: (r: TimeRange) => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
      <div style={{ display: "flex", gap: 4, padding: 4, backgroundColor: ds.bg.elevated, borderRadius: ds.radius.lg, border: `1px solid ${ds.border.default}` }}>
        {(["7d", "30d", "90d", "all"] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            style={{ height: 28, padding: "0 14px", borderRadius: ds.radius.md, border: "none", backgroundColor: timeRange === range ? ds.accent.default : "transparent", color: timeRange === range ? "#000" : ds.text.muted, fontSize: ds.size.xs, fontWeight: timeRange === range ? ds.weight.semibold : ds.weight.medium, cursor: "pointer", transition: "all 0.15s ease", fontFamily: "Inter, sans-serif" }}
          >
            {range === "all" ? "All" : range}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("today");
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [syncing, setSyncing] = useState(false);

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const loadOverview = async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const res = await fetch("/api/stats/overview", { credentials: "same-origin" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setOverview(json);
    } catch (e: any) {
      setOverviewError(e?.message ?? "Network error");
    } finally {
      setOverviewLoading(false);
    }
  };

  const loadAnalytics = async (range: TimeRange) => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const res = await fetch(`/api/stats/analytics?range=${range}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setAnalytics(json);
    } catch (e: any) {
      setAnalyticsError(e?.message ?? "Network error");
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    if (activeTab === "historical") loadAnalytics(timeRange);
  }, [activeTab, timeRange]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch("/api/programs/sync", { method: "POST", credentials: "same-origin" });
      await loadOverview();
    } catch {
      // surfaced via overview reload error if any
    } finally {
      setSyncing(false);
    }
  };

  const tabs: Array<{ id: ActiveTab; label: string }> = [
    { id: "today", label: "Today" },
    { id: "historical", label: "Historical" },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: ds.size["3xl"], fontWeight: ds.weight.bold, color: ds.text.primary, lineHeight: 1.2 }}>Dashboard</h1>
          <p style={{ margin: "4px 0 0", fontSize: ds.size.sm, color: ds.text.muted }}>{today}</p>
        </div>

        <DSButton variant="primary" size="md" icon={<RefreshCw size={13} className={syncing ? "animate-spin" : ""} />} onClick={handleSync} disabled={syncing}>
          {syncing ? "Syncing…" : "Sync Programs"}
        </DSButton>
      </div>

      <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${ds.border.default}`, marginBottom: 24 }}>
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            style={{ height: 38, padding: "0 16px", border: "none", borderBottom: `2px solid ${activeTab === id ? ds.accent.default : "transparent"}`, backgroundColor: "transparent", color: activeTab === id ? ds.text.primary : ds.text.muted, fontSize: ds.size.sm, fontWeight: activeTab === id ? ds.weight.semibold : ds.weight.regular, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "all 0.15s ease", marginBottom: -1 }}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "today" && (
        <TodayContent data={overview} loading={overviewLoading} error={overviewError} onRetry={loadOverview} />
      )}
      {activeTab === "historical" && (
        <HistoricalContent timeRange={timeRange} setTimeRange={setTimeRange} data={analytics} loading={analyticsLoading} error={analyticsError} onRetry={() => loadAnalytics(timeRange)} />
      )}
    </div>
  );
}
