"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  stats: Record<string, unknown> | null;
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
  findingsPerScan: number;
  falsePositiveRate: number;
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
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatMonth(iso: string): string {
  const [, m] = iso.split("-");
  const idx = parseInt(m, 10) - 1;
  return MONTH_SHORT[idx] ?? iso;
}

function formatEUR(amount: number): string {
  return `€${amount.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}`;
}

function computeDuration(start: string | null, end: string | null): string {
  if (!start) return "—";
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  const sec = Math.max(0, Math.round((endMs - startMs) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function extractFindingsCount(stats: Record<string, unknown> | null): number {
  if (!stats) return 0;
  const candidates = ["findings", "findingsCount", "totalFindings"];
  for (const k of candidates) {
    const v = (stats as Record<string, unknown>)[k];
    if (typeof v === "number") return v;
  }
  return 0;
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

function ScanStatusBadge({ status }: { status: string }) {
  const configs: Record<string, { color: string; bg: string }> = {
    COMPLETE: { color: ds.accent.default, bg: ds.accent.bg15 },
    COMPLETED: { color: ds.accent.default, bg: ds.accent.bg15 },
    RUNNING: { color: ds.severity.info, bg: ds.severity.infoBg },
    FAILED: { color: ds.severity.critical, bg: ds.severity.criticalBg },
    QUEUED: { color: ds.text.muted, bg: "rgba(113,113,122,0.12)" },
    PENDING: { color: ds.text.muted, bg: "rgba(113,113,122,0.12)" },
  };
  const cfg = configs[status.toUpperCase()] ?? { color: ds.text.muted, bg: "rgba(113,113,122,0.12)" };
  const label = status.charAt(0) + status.slice(1).toLowerCase();

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 20, padding: "0 8px", borderRadius: ds.radius.md, backgroundColor: cfg.bg, color: cfg.color, fontSize: ds.size.xs, fontWeight: ds.weight.medium, whiteSpace: "nowrap" }}>
      {status.toUpperCase() === "RUNNING" ? (
        <Loader2 size={9} className="animate-spin" style={{ color: cfg.color }} />
      ) : (
        <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: cfg.color }} />
      )}
      {label}
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

interface TodayProps {
  loading: boolean;
  error: string | null;
  data: OverviewData | null;
  onRetry: () => void;
}

const SEVERITY_META: Array<{ key: SeverityKey; label: string; color: string; bg: string }> = [
  { key: "critical", label: "Critical", color: ds.severity.critical, bg: ds.severity.criticalBg },
  { key: "high", label: "High", color: ds.severity.high, bg: ds.severity.highBg },
  { key: "medium", label: "Medium", color: ds.severity.medium, bg: ds.severity.mediumBg },
  { key: "low", label: "Low", color: ds.severity.low, bg: ds.severity.lowBg },
  { key: "info", label: "Info", color: ds.severity.info, bg: ds.severity.infoBg },
];

function TodayContent({ loading, error, data, onRetry }: TodayProps) {
  if (loading && !data) {
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
              <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.severity.critical }}>Unable to load dashboard stats</div>
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
        <DSEmptyState icon={ScanLine} title="No scans yet" description="You haven't run any scans. Launch your first scan to start discovering vulnerabilities across your programs." ctaLabel="Run your first scan" onCta={() => {}} />
      </div>
    );
  }

  const severityTotal = SEVERITY_META.reduce((sum, { key }) => sum + (data.severityBreakdown[key] ?? 0), 0);
  const botOnline = data.activeScans >= 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: ds.radius.lg, backgroundColor: botOnline ? ds.accent.bg15 : ds.severity.criticalBg, border: `1px solid ${botOnline ? ds.accent.bg20 : ds.severity.critical + "40"}`, marginBottom: 24 }}>
        {botOnline ? <CheckCircle2 size={14} style={{ color: ds.accent.default, flexShrink: 0 }} /> : <WifiOff size={14} style={{ color: ds.severity.critical, flexShrink: 0 }} />}
        <span style={{ fontSize: ds.size.sm, fontWeight: ds.weight.medium, color: botOnline ? ds.accent.default : ds.severity.critical }}>
          {data.activeScans > 0 ? `Scanner active — ${data.activeScans} scan${data.activeScans > 1 ? "s" : ""} running` : "Scanner idle — no active scan"}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Scans" value={data.totalScans} icon={<ScanLine size={14} style={{ color: ds.text.muted }} />} />
        <StatCard label="Active Scans" value={data.activeScans} delta={data.activeScans > 0 ? "in progress" : "idle"} icon={<Loader2 size={14} style={{ color: ds.text.muted }} />} spinning={data.activeScans > 0} />
        <StatCard
          label="Total Findings"
          value={data.totalFindings}
          delta={`across ${Object.values(data.severityBreakdown).filter((v) => v > 0).length} severities`}
          icon={<Bug size={14} style={{ color: ds.text.muted }} />}
          footer={
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
              {SEVERITY_META.map(({ key, bg, color }) => {
                const count = data.severityBreakdown[key] ?? 0;
                if (count === 0) return null;
                return (
                  <span key={key} style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 6px", borderRadius: ds.radius.md, backgroundColor: bg, fontSize: 10, fontWeight: ds.weight.medium, color }}>
                    <span style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: color }} />
                    {count}
                  </span>
                );
              })}
            </div>
          }
        />
        <StatCard label="Critical Findings" value={data.criticalFindings} delta={data.criticalFindings > 0 ? "attention required" : "no critical"} deltaPositive={data.criticalFindings === 0} icon={<AlertTriangle size={14} style={{ color: ds.severity.critical }} />} valueColor={data.criticalFindings > 0 ? ds.severity.critical : ds.text.primary} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <DSCard style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <span style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.text.primary }}>Severity Distribution</span>
            <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>{severityTotal} findings</span>
          </div>

          {severityTotal === 0 ? (
            <div style={{ padding: "24px 0", textAlign: "center", color: ds.text.muted, fontSize: ds.size.xs }}>No findings yet</div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {SEVERITY_META.map(({ key, label, color }) => {
                  const count = data.severityBreakdown[key] ?? 0;
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
                {SEVERITY_META.map(({ key, color }) => {
                  const count = data.severityBreakdown[key] ?? 0;
                  if (count === 0) return null;
                  return <div key={key} style={{ flex: count, backgroundColor: color }} />;
                })}
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
            <div style={{ padding: "24px 0", textAlign: "center", color: ds.text.muted, fontSize: ds.size.xs }}>No scans yet</div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 70px 50px", gap: 8, padding: "0 0 8px", borderBottom: `1px solid ${ds.border.default}`, marginBottom: 8 }}>
                {["Target", "Status", "Duration", "Finds"].map((h) => (
                  <span key={h} style={{ fontSize: ds.size.xs, color: ds.text.muted, fontWeight: ds.weight.medium, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
                ))}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {data.recentScans.map((scan) => {
                  const findings = extractFindingsCount(scan.stats);
                  return (
                    <div key={scan.id} style={{ display: "grid", gridTemplateColumns: "1fr 90px 70px 50px", gap: 8, padding: "7px 0", borderRadius: ds.radius.md, alignItems: "center", borderBottom: `1px solid ${ds.border.default}` }}>
                      <span style={{ fontSize: ds.size.xs, color: ds.text.secondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }}>{scan.target}</span>
                      <ScanStatusBadge status={scan.status} />
                      <span style={{ fontSize: ds.size.xs, color: ds.text.muted, fontVariantNumeric: "tabular-nums" }}>{computeDuration(scan.startedAt, scan.finishedAt)}</span>
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

interface HistoricalProps {
  timeRange: TimeRange;
  setTimeRange: (r: TimeRange) => void;
  loading: boolean;
  error: string | null;
  data: AnalyticsData | null;
  onRetry: () => void;
}

function HistoricalContent({ timeRange, setTimeRange, loading, error, data, onRetry }: HistoricalProps) {
  const scansByMonth = useMemo(() => (data?.scansByMonth ?? []).map((x) => ({ month: formatMonth(x.month), scans: x.count })), [data]);
  const revenueByMonth = useMemo(() => (data?.revenueByMonth ?? []).map((x) => ({ month: formatMonth(x.month), revenue: x.amount })), [data]);
  const maxModule = data?.topModules[0]?.findings ?? 1;

  if (loading && !data) {
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
            <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.severity.critical }}>Unable to load analytics</div>
            <div style={{ fontSize: ds.size.xs, color: ds.text.muted, marginTop: 2 }}>{error}</div>
          </div>
        </div>
        <DSButton variant="danger" size="sm" icon={<RotateCcw size={12} />} onClick={onRetry}>Retry</DSButton>
      </div>
    );
  }

  if (!data || (data.totalBounties === 0 && data.totalTargets === 0)) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 480 }}>
        <DSEmptyState icon={Trophy} title="No historical data yet" description="Once you complete your first scan and report findings, your historical analytics will appear here." ctaLabel="Start scanning" onCta={() => {}} />
      </div>
    );
  }

  return (
    <div>
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Bounties" value={data.totalBounties} delta="reports accepted" icon={<Trophy size={14} style={{ color: ds.severity.high }} />} />
        <StatCard label="Revenue" value={formatEUR(data.totalRevenue)} delta="EUR total" deltaPositive={data.totalRevenue > 0} icon={<Euro size={14} style={{ color: ds.accent.default }} />} valueColor={ds.accent.default} />
        <StatCard label="Targets Scanned" value={data.totalTargets} delta="unique hosts" icon={<Target size={14} style={{ color: ds.severity.info }} />} />
        <StatCard label="Success Rate" value={`${data.scanSuccessRate}%`} delta="scans completed" icon={<Percent size={14} style={{ color: ds.severity.medium }} />} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <DSCard style={{ padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.text.primary }}>Scans per Month</div>
            <div style={{ fontSize: ds.size.xs, color: ds.text.muted, marginTop: 2 }}>Last {scansByMonth.length} months</div>
          </div>
          {scansByMonth.length === 0 ? (
            <div style={{ padding: "48px 0", textAlign: "center", color: ds.text.muted, fontSize: ds.size.xs }}>No scan history</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={scansByMonth} barSize={24} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(39,39,42,0.35)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: ds.text.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: ds.text.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip suffix=" scans" />} cursor={{ fill: "rgba(39,39,42,0.25)" }} />
                <Bar dataKey="scans" fill={ds.accent.default} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </DSCard>

        <DSCard style={{ padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.text.primary }}>Revenue per Month</div>
            <div style={{ fontSize: ds.size.xs, color: ds.text.muted, marginTop: 2 }}>EUR · Last {revenueByMonth.length} months</div>
          </div>
          {revenueByMonth.length === 0 ? (
            <div style={{ padding: "48px 0", textAlign: "center", color: ds.text.muted, fontSize: ds.size.xs }}>No revenue yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={revenueByMonth} barSize={24} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(39,39,42,0.35)" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: ds.text.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} tick={{ fill: ds.text.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip prefix="€" />} cursor={{ fill: "rgba(39,39,42,0.25)" }} />
                <Bar dataKey="revenue" fill={ds.severity.medium} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </DSCard>

        <DSCard style={{ padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.text.primary }}>Top Modules by Findings</div>
            <div style={{ fontSize: ds.size.xs, color: ds.text.muted, marginTop: 2 }}>Based on current range</div>
          </div>
          {data.topModules.length === 0 ? (
            <div style={{ padding: "48px 0", textAlign: "center", color: ds.text.muted, fontSize: ds.size.xs }}>No module data</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.topModules.map(({ module, findings }, idx) => (
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

          {data.platformStats.length === 0 ? (
            <div style={{ padding: "48px 0", textAlign: "center", color: ds.text.muted, fontSize: ds.size.xs }}>No platform data</div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "100px 50px 70px 70px 70px 70px", gap: 4, paddingBottom: 8, borderBottom: `1px solid ${ds.border.default}`, marginBottom: 6 }}>
                {["Platform", "Scans", "Findings", "Reported", "Accepted", "Bounty"].map((h) => (
                  <span key={h} style={{ fontSize: ds.size.xs, color: ds.text.muted, fontWeight: ds.weight.medium, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: h !== "Platform" ? "right" : "left" }}>{h}</span>
                ))}
              </div>

              {data.platformStats.map((row, i) => (
                <div key={row.platform} style={{ display: "grid", gridTemplateColumns: "100px 50px 70px 70px 70px 70px", gap: 4, padding: "8px 0", borderBottom: i < data.platformStats.length - 1 ? `1px solid ${ds.border.default}` : "none", alignItems: "center" }}>
                  <span style={{ fontSize: ds.size.xs, fontWeight: ds.weight.medium, color: ds.text.primary }}>{row.platform}</span>
                  <span style={{ fontSize: ds.size.xs, color: ds.text.muted, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.scans}</span>
                  <span style={{ fontSize: ds.size.xs, color: ds.text.muted, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.findings}</span>
                  <span style={{ fontSize: ds.size.xs, color: ds.text.muted, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.reported}</span>
                  <span style={{ fontSize: ds.size.xs, color: ds.accent.default, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: ds.weight.medium }}>{row.accepted}</span>
                  <span style={{ fontSize: ds.size.xs, color: ds.text.primary, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: ds.weight.semibold }}>{formatEUR(row.bounty)}</span>
                </div>
              ))}
            </>
          )}
        </DSCard>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("today");
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const [syncing, setSyncing] = useState(false);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const res = await fetch("/api/stats/overview", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as OverviewData;
      setOverview(json);
    } catch (e: any) {
      setOverviewError(e?.message ?? "Network error");
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const loadAnalytics = useCallback(async (range: TimeRange) => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const res = await fetch(`/api/stats/analytics?range=${range}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as AnalyticsData;
      setAnalytics(json);
    } catch (e: any) {
      setAnalyticsError(e?.message ?? "Network error");
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (activeTab === "historical") {
      loadAnalytics(timeRange);
    }
  }, [activeTab, timeRange, loadAnalytics]);

  const handleSync = async () => {
    setSyncing(true);
    await Promise.all([
      loadOverview(),
      activeTab === "historical" ? loadAnalytics(timeRange) : Promise.resolve(),
    ]);
    setSyncing(false);
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

        <DSButton variant="primary" size="md" icon={<RefreshCw size={13} className={syncing ? "animate-spin" : ""} />} onClick={handleSync} forceState={syncing ? "disabled" : undefined}>
          {syncing ? "Syncing…" : "Refresh"}
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
        <TodayContent loading={overviewLoading} error={overviewError} data={overview} onRetry={loadOverview} />
      )}
      {activeTab === "historical" && (
        <HistoricalContent timeRange={timeRange} setTimeRange={setTimeRange} loading={analyticsLoading} error={analyticsError} data={analytics} onRetry={() => loadAnalytics(timeRange)} />
      )}
    </div>
  );
}
