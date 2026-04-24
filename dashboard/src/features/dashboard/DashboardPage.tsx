"use client";

import React, { useState } from "react";
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

type PageState = "default" | "loading" | "empty" | "error";
type ActiveTab = "today" | "historical";
type TimeRange = "7d" | "30d" | "90d" | "all";

const RECENT_SCANS = [
  { id: 1, target: "api.hackerone.com", status: "COMPLETED", duration: "2m 34s", findings: 3 },
  { id: 2, target: "app.bugcrowd.com", status: "RUNNING", duration: "1m 12s", findings: 1 },
  { id: 3, target: "admin.synack.com", status: "COMPLETED", duration: "4m 01s", findings: 0 },
  { id: 4, target: "api.intigriti.com", status: "COMPLETED", duration: "3m 22s", findings: 5 },
  { id: 5, target: "auth.yeswehack.com", status: "FAILED", duration: "0m 45s", findings: 0 },
  { id: 6, target: "shop.hackerone.com", status: "COMPLETED", duration: "5m 10s", findings: 2 },
  { id: 7, target: "cdn.bugcrowd.com", status: "QUEUED", duration: "—", findings: 0 },
  { id: 8, target: "portal.intigriti.com", status: "RUNNING", duration: "0m 58s", findings: 1 },
  { id: 9, target: "api.bugbounty.jp", status: "COMPLETED", duration: "3m 47s", findings: 4 },
  { id: 10, target: "app.zerocopter.com", status: "COMPLETED", duration: "2m 19s", findings: 2 },
];

const SEVERITY_DIST = [
  { key: "critical", label: "Critical", count: 4, color: ds.severity.critical, bg: ds.severity.criticalBg },
  { key: "high", label: "High", count: 12, color: ds.severity.high, bg: ds.severity.highBg },
  { key: "medium", label: "Medium", count: 23, color: ds.severity.medium, bg: ds.severity.mediumBg },
  { key: "low", label: "Low", count: 28, color: ds.severity.low, bg: ds.severity.lowBg },
  { key: "info", label: "Info", count: 7, color: ds.severity.info, bg: ds.severity.infoBg },
];
const SEVERITY_TOTAL = SEVERITY_DIST.reduce((a, b) => a + b.count, 0);

const TODAY_FINDINGS = { critical: 4, high: 7, medium: 4, low: 2, info: 1 };

const SCANS_PER_MONTH = [
  { month: "Nov", scans: 142 },
  { month: "Dec", scans: 178 },
  { month: "Jan", scans: 203 },
  { month: "Feb", scans: 189 },
  { month: "Mar", scans: 234 },
  { month: "Apr", scans: 267 },
];

const REVENUE_PER_MONTH = [
  { month: "Nov", revenue: 2100 },
  { month: "Dec", revenue: 3200 },
  { month: "Jan", revenue: 1800 },
  { month: "Feb", revenue: 4500 },
  { month: "Mar", revenue: 5800 },
  { month: "Apr", revenue: 8450 },
];

const TOP_MODULES = [
  { module: "SQLi Scanner", findings: 234 },
  { module: "XSS Detector", findings: 198 },
  { module: "Auth Bypass", findings: 156 },
  { module: "SSRF Probe", findings: 143 },
  { module: "RCE Check", findings: 89 },
  { module: "Path Traversal", findings: 67 },
  { module: "XXE Parser", findings: 54 },
  { module: "CSRF Validator", findings: 43 },
  { module: "Open Redirect", findings: 38 },
  { module: "Info Disclosure", findings: 29 },
];

const PLATFORM_PERF = [
  { platform: "HackerOne", scans: 78, findings: 234, reported: 45, accepted: 31, bounty: "€3,200" },
  { platform: "Bugcrowd", scans: 54, findings: 178, reported: 32, accepted: 22, bounty: "€2,100" },
  { platform: "Intigriti", scans: 43, findings: 143, reported: 28, accepted: 19, bounty: "€1,850" },
  { platform: "YesWeHack", scans: 31, findings: 89, reported: 18, accepted: 12, bounty: "€980" },
  { platform: "Synack", scans: 12, findings: 45, reported: 8, accepted: 6, bounty: "€320" },
];

const HISTORICAL_BY_RANGE: Record<TimeRange, { bounties: number; revenue: string; targets: number; successRate: number }> = {
  "7d": { bounties: 6, revenue: "€1,840", targets: 38, successRate: 71 },
  "30d": { bounties: 24, revenue: "€8,450", targets: 156, successRate: 67 },
  "90d": { bounties: 68, revenue: "€24,200", targets: 421, successRate: 64 },
  all: { bounties: 142, revenue: "€58,900", targets: 892, successRate: 62 },
};

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
    COMPLETED: { color: ds.accent.default, bg: ds.accent.bg15 },
    RUNNING: { color: ds.severity.info, bg: ds.severity.infoBg },
    FAILED: { color: ds.severity.critical, bg: ds.severity.criticalBg },
    QUEUED: { color: ds.text.muted, bg: "rgba(113,113,122,0.12)" },
  };
  const cfg = configs[status] ?? { color: ds.text.muted, bg: "rgba(113,113,122,0.12)" };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 20, padding: "0 8px", borderRadius: ds.radius.md, backgroundColor: cfg.bg, color: cfg.color, fontSize: ds.size.xs, fontWeight: ds.weight.medium, whiteSpace: "nowrap" }}>
      {status === "RUNNING" ? (
        <Loader2 size={9} className="animate-spin" style={{ color: cfg.color }} />
      ) : (
        <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: cfg.color }} />
      )}
      {status.charAt(0) + status.slice(1).toLowerCase()}
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

function TodayContent({ botOnline, pageState }: { botOnline: boolean; pageState: PageState }) {
  if (pageState === "loading") {
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

  if (pageState === "empty") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 480 }}>
        <DSEmptyState icon={ScanLine} title="No scans yet" description="You haven't run any scans today. Launch your first scan to start discovering vulnerabilities across your programs." ctaLabel="Run your first scan" onCta={() => {}} />
      </div>
    );
  }

  if (pageState === "error") {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: ds.radius.lg, backgroundColor: ds.severity.criticalBg, border: `1px solid ${ds.severity.critical}40`, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <WifiOff size={16} style={{ color: ds.severity.critical, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.severity.critical }}>Bot unreachable — scanner offline</div>
              <div style={{ fontSize: ds.size.xs, color: ds.text.muted, marginTop: 2 }}>Last successful connection 47 minutes ago. Check your VPN or server status.</div>
            </div>
          </div>
          <DSButton variant="danger" size="sm" icon={<RotateCcw size={12} />}>Retry</DSButton>
        </div>

        <div style={{ opacity: 0.35, pointerEvents: "none" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <CardSkeleton height={280} />
            <CardSkeleton height={280} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: ds.radius.lg, backgroundColor: botOnline ? ds.accent.bg15 : ds.severity.criticalBg, border: `1px solid ${botOnline ? ds.accent.bg20 : ds.severity.critical + "40"}`, marginBottom: 24 }}>
        {botOnline ? <CheckCircle2 size={14} style={{ color: ds.accent.default, flexShrink: 0 }} /> : <WifiOff size={14} style={{ color: ds.severity.critical, flexShrink: 0 }} />}
        <span style={{ fontSize: ds.size.sm, fontWeight: ds.weight.medium, color: botOnline ? ds.accent.default : ds.severity.critical }}>
          {botOnline ? "Bot online — last scan 14 min ago" : "Bot offline — scanner unreachable"}
        </span>
        <span style={{ marginLeft: "auto", fontSize: ds.size.xs, color: ds.text.muted }}>
          {botOnline ? "Auto-refresh in 5m" : "Last online 47m ago"}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard label="Total Scans Today" value={47} delta="+12 vs yesterday" deltaPositive={true} icon={<ScanLine size={14} style={{ color: ds.text.muted }} />} />
        <StatCard label="Active Scans" value={3} delta="3 in progress" icon={<Loader2 size={14} style={{ color: ds.text.muted }} />} spinning={true} />
        <StatCard
          label="New Findings"
          value={18}
          delta="across 12 targets"
          icon={<Bug size={14} style={{ color: ds.text.muted }} />}
          footer={
            <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
              {(Object.entries(TODAY_FINDINGS) as Array<[keyof typeof TODAY_FINDINGS, number]>).map(([sev, count]) => (
                <span
                  key={sev}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    padding: "1px 6px",
                    borderRadius: ds.radius.md,
                    backgroundColor: ds.severity[`${sev}Bg` as keyof typeof ds.severity] as string,
                    fontSize: 10,
                    fontWeight: ds.weight.medium,
                    color: ds.severity[sev as keyof typeof ds.severity] as string,
                  }}
                >
                  <span style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: ds.severity[sev as keyof typeof ds.severity] as string }} />
                  {count}
                </span>
              ))}
            </div>
          }
        />
        <StatCard label="Critical Findings" value={4} delta="+2 since 08:00" deltaPositive={false} icon={<AlertTriangle size={14} style={{ color: ds.severity.critical }} />} valueColor={ds.severity.critical} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <DSCard style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <span style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.text.primary }}>Severity Distribution</span>
            <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>{SEVERITY_TOTAL} findings</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {SEVERITY_DIST.map(({ key, label, count, color }) => {
              const pct = Math.round((count / SEVERITY_TOTAL) * 100);
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
            {SEVERITY_DIST.map(({ key, count, color }) => (
              <div key={key} style={{ flex: count, backgroundColor: color }} />
            ))}
          </div>
        </DSCard>

        <DSCard style={{ padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.text.primary }}>Recent Scans</span>
            <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>Last 10</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 70px 50px", gap: 8, padding: "0 0 8px", borderBottom: `1px solid ${ds.border.default}`, marginBottom: 8 }}>
            {["Target", "Status", "Duration", "Finds"].map((h) => (
              <span key={h} style={{ fontSize: ds.size.xs, color: ds.text.muted, fontWeight: ds.weight.medium, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {RECENT_SCANS.map((scan) => (
              <div key={scan.id} style={{ display: "grid", gridTemplateColumns: "1fr 90px 70px 50px", gap: 8, padding: "7px 0", borderRadius: ds.radius.md, alignItems: "center", borderBottom: `1px solid ${ds.border.default}` }}>
                <span style={{ fontSize: ds.size.xs, color: ds.text.secondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }}>{scan.target}</span>
                <ScanStatusBadge status={scan.status} />
                <span style={{ fontSize: ds.size.xs, color: ds.text.muted, fontVariantNumeric: "tabular-nums" }}>{scan.duration}</span>
                <span style={{ fontSize: ds.size.xs, fontWeight: ds.weight.semibold, color: scan.findings > 0 ? ds.severity.high : ds.text.muted, fontVariantNumeric: "tabular-nums" }}>
                  {scan.findings > 0 ? scan.findings : "—"}
                </span>
              </div>
            ))}
          </div>
        </DSCard>
      </div>
    </div>
  );
}

function HistoricalContent({ timeRange, setTimeRange, pageState }: { timeRange: TimeRange; setTimeRange: (r: TimeRange) => void; pageState: PageState }) {
  const stats = HISTORICAL_BY_RANGE[timeRange];
  const maxModule = TOP_MODULES[0].findings;

  if (pageState === "loading") {
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

  if (pageState === "empty") {
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
        <StatCard label="Total Bounties" value={stats.bounties} delta="reports accepted" icon={<Trophy size={14} style={{ color: ds.severity.high }} />} />
        <StatCard label="Revenue" value={stats.revenue} delta="EUR total" deltaPositive={true} icon={<Euro size={14} style={{ color: ds.accent.default }} />} valueColor={ds.accent.default} />
        <StatCard label="Targets Scanned" value={stats.targets} delta="unique hosts" icon={<Target size={14} style={{ color: ds.severity.info }} />} />
        <StatCard label="Success Rate" value={`${stats.successRate}%`} delta="findings → accepted" icon={<Percent size={14} style={{ color: ds.severity.medium }} />} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <DSCard style={{ padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.text.primary }}>Scans per Month</div>
            <div style={{ fontSize: ds.size.xs, color: ds.text.muted, marginTop: 2 }}>Last 6 months</div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={SCANS_PER_MONTH} barSize={24} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(39,39,42,0.35)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: ds.text.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: ds.text.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip suffix=" scans" />} cursor={{ fill: "rgba(39,39,42,0.25)" }} />
              <Bar dataKey="scans" fill={ds.accent.default} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </DSCard>

        <DSCard style={{ padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.text.primary }}>Revenue per Month</div>
            <div style={{ fontSize: ds.size.xs, color: ds.text.muted, marginTop: 2 }}>EUR · Last 6 months</div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={REVENUE_PER_MONTH} barSize={24} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(39,39,42,0.35)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: ds.text.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} tick={{ fill: ds.text.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip prefix="€" />} cursor={{ fill: "rgba(39,39,42,0.25)" }} />
              <Bar dataKey="revenue" fill={ds.severity.medium} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </DSCard>

        <DSCard style={{ padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.text.primary }}>Top 10 Modules by Findings</div>
            <div style={{ fontSize: ds.size.xs, color: ds.text.muted, marginTop: 2 }}>All time</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {TOP_MODULES.map(({ module, findings }, idx) => (
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
        </DSCard>

        <DSCard style={{ padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.text.primary }}>Platform Performance</div>
            <div style={{ fontSize: ds.size.xs, color: ds.text.muted, marginTop: 2 }}>{timeRange === "all" ? "All time" : `Last ${timeRange}`}</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "100px 50px 70px 70px 70px 70px", gap: 4, paddingBottom: 8, borderBottom: `1px solid ${ds.border.default}`, marginBottom: 6 }}>
            {["Platform", "Scans", "Findings", "Reported", "Accepted", "Bounty"].map((h) => (
              <span key={h} style={{ fontSize: ds.size.xs, color: ds.text.muted, fontWeight: ds.weight.medium, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: h !== "Platform" ? "right" : "left" }}>{h}</span>
            ))}
          </div>

          {PLATFORM_PERF.map((row, i) => (
            <div key={row.platform} style={{ display: "grid", gridTemplateColumns: "100px 50px 70px 70px 70px 70px", gap: 4, padding: "8px 0", borderBottom: i < PLATFORM_PERF.length - 1 ? `1px solid ${ds.border.default}` : "none", alignItems: "center" }}>
              <span style={{ fontSize: ds.size.xs, fontWeight: ds.weight.medium, color: ds.text.primary }}>{row.platform}</span>
              <span style={{ fontSize: ds.size.xs, color: ds.text.muted, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.scans}</span>
              <span style={{ fontSize: ds.size.xs, color: ds.text.muted, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.findings}</span>
              <span style={{ fontSize: ds.size.xs, color: ds.text.muted, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.reported}</span>
              <span style={{ fontSize: ds.size.xs, color: ds.accent.default, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: ds.weight.medium }}>{row.accepted}</span>
              <span style={{ fontSize: ds.size.xs, color: ds.text.primary, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: ds.weight.semibold }}>{row.bounty}</span>
            </div>
          ))}
        </DSCard>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const [pageState, setPageState] = useState<PageState>("default");
  const [activeTab, setActiveTab] = useState<ActiveTab>("today");
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [botOnline, setBotOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => setSyncing(false), 2200);
  };

  const tabs: Array<{ id: ActiveTab; label: string }> = [
    { id: "today", label: "Today" },
    { id: "historical", label: "Historical" },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "8px 14px", backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg, marginBottom: 28, flexWrap: "wrap" }}>
        <span style={{ fontSize: ds.size.xs, color: ds.text.muted, fontWeight: ds.weight.medium, textTransform: "uppercase", letterSpacing: "0.07em", flexShrink: 0 }}>Preview state</span>
        <div style={{ display: "flex", gap: 4 }}>
          {(["default", "loading", "empty", "error"] as PageState[]).map((s) => (
            <button
              key={s}
              onClick={() => setPageState(s)}
              style={{ height: 26, padding: "0 10px", borderRadius: ds.radius.md, border: `1px solid ${pageState === s ? ds.accent.default : ds.border.default}`, backgroundColor: pageState === s ? ds.accent.bg15 : "transparent", color: pageState === s ? ds.accent.default : ds.text.secondary, fontSize: ds.size.xs, fontWeight: ds.weight.medium, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "all 0.1s ease", textTransform: "capitalize" }}
            >
              {s}
            </button>
          ))}
        </div>
        {pageState === "default" && (
          <>
            <div style={{ width: 1, height: 18, backgroundColor: ds.border.default }} />
            <span style={{ fontSize: ds.size.xs, color: ds.text.muted, fontWeight: ds.weight.medium }}>Bot:</span>
            <div style={{ display: "flex", gap: 4 }}>
              {[true, false].map((online) => (
                <button
                  key={String(online)}
                  onClick={() => setBotOnline(online)}
                  style={{ height: 26, padding: "0 10px", borderRadius: ds.radius.md, border: `1px solid ${botOnline === online ? (online ? ds.accent.default : ds.severity.critical) : ds.border.default}`, backgroundColor: botOnline === online ? (online ? ds.accent.bg15 : ds.severity.criticalBg) : "transparent", color: botOnline === online ? (online ? ds.accent.default : ds.severity.critical) : ds.text.secondary, fontSize: ds.size.xs, fontWeight: ds.weight.medium, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "all 0.1s ease" }}
                >
                  {online ? "Online" : "Offline"}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: ds.size["3xl"], fontWeight: ds.weight.bold, color: ds.text.primary, lineHeight: 1.2 }}>Dashboard</h1>
          <p style={{ margin: "4px 0 0", fontSize: ds.size.sm, color: ds.text.muted }}>{today}</p>
        </div>

        <DSButton variant="primary" size="md" icon={<RefreshCw size={13} className={syncing ? "animate-spin" : ""} />} onClick={handleSync}>
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

      {activeTab === "today" && <TodayContent botOnline={botOnline} pageState={pageState} />}
      {activeTab === "historical" && <HistoricalContent timeRange={timeRange} setTimeRange={setTimeRange} pageState={pageState} />}
    </div>
  );
}
