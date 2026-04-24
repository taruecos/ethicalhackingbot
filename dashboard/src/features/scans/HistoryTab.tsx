"use client";

import React, { useState, useRef, useEffect } from "react";
import { MoreHorizontal, ExternalLink, RefreshCw, Trash2, Search, History } from "lucide-react";
import { ds } from "@/components/ds/tokens";
import { DSCard } from "@/components/ds/DSCard";
import { DSButton } from "@/components/ds/DSButton";

type HistoryStatus = "COMPLETE" | "ERROR" | "CANCELLED";

interface HistoryScan {
  id: string;
  target: string;
  program: string;
  startedAt: string;
  duration: string;
  status: HistoryStatus;
  findings: { critical: number; high: number; medium: number; low: number; info: number };
}

const HISTORY_DATA: HistoryScan[] = [
  { id: "h01", target: "api.hackerone.com", program: "HackerOne", startedAt: "2026-04-24 08:12", duration: "12m 34s", status: "COMPLETE", findings: { critical: 1, high: 2, medium: 3, low: 1, info: 4 } },
  { id: "h02", target: "app.bugcrowd.com", program: "Bugcrowd", startedAt: "2026-04-24 07:45", duration: "8m 12s", status: "COMPLETE", findings: { critical: 0, high: 1, medium: 2, low: 3, info: 5 } },
  { id: "h03", target: "admin.synack.com", program: "Synack", startedAt: "2026-04-24 07:22", duration: "2m 15s", status: "ERROR", findings: { critical: 0, high: 0, medium: 0, low: 0, info: 0 } },
  { id: "h04", target: "api.intigriti.com", program: "Intigriti", startedAt: "2026-04-24 06:58", duration: "15m 01s", status: "COMPLETE", findings: { critical: 2, high: 4, medium: 6, low: 2, info: 8 } },
  { id: "h05", target: "auth.yeswehack.com", program: "YesWeHack", startedAt: "2026-04-24 06:30", duration: "0m 45s", status: "CANCELLED", findings: { critical: 0, high: 0, medium: 0, low: 0, info: 0 } },
  { id: "h06", target: "shop.hackerone.com", program: "HackerOne", startedAt: "2026-04-23 22:15", duration: "9m 44s", status: "COMPLETE", findings: { critical: 0, high: 1, medium: 4, low: 2, info: 6 } },
  { id: "h07", target: "cdn.bugcrowd.com", program: "Bugcrowd", startedAt: "2026-04-23 21:08", duration: "6m 58s", status: "COMPLETE", findings: { critical: 0, high: 0, medium: 1, low: 4, info: 3 } },
  { id: "h08", target: "portal.intigriti.com", program: "Intigriti", startedAt: "2026-04-23 20:30", duration: "11m 22s", status: "COMPLETE", findings: { critical: 1, high: 3, medium: 5, low: 1, info: 7 } },
  { id: "h09", target: "api.bugbounty.jp", program: "JP Bug", startedAt: "2026-04-23 19:55", duration: "7m 33s", status: "COMPLETE", findings: { critical: 0, high: 2, medium: 3, low: 5, info: 2 } },
  { id: "h10", target: "app.zerocopter.com", program: "Zerocopter", startedAt: "2026-04-23 18:40", duration: "5m 17s", status: "COMPLETE", findings: { critical: 0, high: 0, medium: 2, low: 3, info: 4 } },
];

const PROGRAMS_LIST = ["All programs", ...Array.from(new Set(HISTORY_DATA.map((s) => s.program)))];
const DATE_RANGES = ["Last 24h", "Last 7d", "Last 30d", "All time"];

const STATUS_CONFIG: Record<HistoryStatus, { label: string; color: string; bg: string }> = {
  COMPLETE: { label: "Complete", color: ds.accent.default, bg: ds.accent.bg15 },
  ERROR: { label: "Error", color: ds.severity.critical, bg: ds.severity.criticalBg },
  CANCELLED: { label: "Cancelled", color: ds.text.muted, bg: "rgba(113,113,122,0.12)" },
};

export function HistoryTab() {
  const [statusFilter, setStatusFilter] = useState<Set<HistoryStatus>>(new Set(["COMPLETE", "ERROR", "CANCELLED"]));
  const [programFilter, setProgramFilter] = useState("All programs");
  const [dateRange, setDateRange] = useState("Last 7d");
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [data, setData] = useState(HISTORY_DATA);
  const [showEmpty, setShowEmpty] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleStatus = (s: HistoryStatus) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) {
        if (next.size > 1) next.delete(s);
      } else next.add(s);
      return next;
    });
  };

  const filtered = data.filter((scan) => {
    if (!statusFilter.has(scan.status)) return false;
    if (programFilter !== "All programs" && scan.program !== programFilter) return false;
    if (search && !scan.target.toLowerCase().includes(search.toLowerCase()) && !scan.program.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleDelete = (id: string) => {
    setData((prev) => prev.filter((s) => s.id !== id));
    setDeleteConfirmId(null);
    setOpenMenuId(null);
  };

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {(["COMPLETE", "ERROR", "CANCELLED"] as HistoryStatus[]).map((s) => {
            const cfg = STATUS_CONFIG[s];
            const active = statusFilter.has(s);
            return (
              <button
                key={s}
                onClick={() => toggleStatus(s)}
                style={{ height: 28, padding: "0 10px", borderRadius: ds.radius.md, cursor: "pointer", border: `1px solid ${active ? cfg.color + "50" : ds.border.default}`, backgroundColor: active ? cfg.bg : "transparent", color: active ? cfg.color : ds.text.muted, fontSize: ds.size.xs, fontWeight: ds.weight.medium, fontFamily: "Inter, sans-serif", transition: "all 0.1s ease", display: "flex", alignItems: "center", gap: 5 }}
              >
                <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: active ? cfg.color : ds.text.muted }} />
                {cfg.label}
              </button>
            );
          })}
        </div>

        <div style={{ width: 1, height: 18, backgroundColor: ds.border.default, flexShrink: 0 }} />

        <select value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} style={{ height: 28, padding: "0 8px", backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.md, color: ds.text.secondary, fontSize: ds.size.xs, cursor: "pointer", outline: "none", fontFamily: "Inter, sans-serif", colorScheme: "dark" as const }}>
          {PROGRAMS_LIST.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <div style={{ display: "flex", gap: 4 }}>
          {DATE_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              style={{ height: 28, padding: "0 10px", borderRadius: ds.radius.md, border: `1px solid ${dateRange === r ? ds.accent.default : ds.border.default}`, backgroundColor: dateRange === r ? ds.accent.bg15 : "transparent", color: dateRange === r ? ds.accent.default : ds.text.muted, fontSize: ds.size.xs, fontWeight: dateRange === r ? ds.weight.semibold : ds.weight.medium, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "all 0.1s ease" }}
            >
              {r}
            </button>
          ))}
        </div>

        <div style={{ position: "relative", flex: 1, maxWidth: 240, marginLeft: "auto" }}>
          <Search size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: ds.text.muted, pointerEvents: "none" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search target or program…" style={{ width: "100%", height: 28, boxSizing: "border-box", backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.md, fontSize: ds.size.xs, fontFamily: "Inter, sans-serif", color: ds.text.primary, paddingLeft: 26, paddingRight: 8, outline: "none" }} />
        </div>

        <button onClick={() => setShowEmpty(!showEmpty)} style={{ height: 28, padding: "0 10px", borderRadius: ds.radius.md, cursor: "pointer", border: `1px solid ${ds.border.default}`, backgroundColor: "transparent", color: ds.text.muted, fontSize: ds.size.xs, fontFamily: "Inter, sans-serif" }}>
          {showEmpty ? "Show data" : "Empty state"}
        </button>
      </div>

      {showEmpty || filtered.length === 0 ? (
        <DSCard style={{ padding: 48, textAlign: "center" }}>
          <History size={36} style={{ color: ds.text.muted, margin: "0 auto 14px" }} />
          <div style={{ fontSize: ds.size.lg, fontWeight: ds.weight.semibold, color: ds.text.secondary, marginBottom: 6 }}>No scan history yet</div>
          <div style={{ fontSize: ds.size.sm, color: ds.text.muted }}>{filtered.length === 0 && !showEmpty ? "No scans match your current filters." : "Complete your first scan to see history and analytics here."}</div>
        </DSCard>
      ) : (
        <DSCard style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "200px 110px 130px 80px 1fr 90px 40px", gap: 8, padding: "10px 16px", backgroundColor: ds.bg.elevated, borderBottom: `1px solid ${ds.border.default}` }}>
            {["Target", "Program", "Started", "Duration", "Findings", "Status", ""].map((h) => (
              <span key={h || "actions"} style={{ fontSize: 10, fontWeight: ds.weight.semibold, color: ds.text.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
            ))}
          </div>

          <div>
            {filtered.map((scan, i) => (
              <TableRow
                key={scan.id}
                scan={scan}
                isLast={i === filtered.length - 1}
                menuOpen={openMenuId === scan.id}
                onOpenMenu={() => setOpenMenuId(openMenuId === scan.id ? null : scan.id)}
                onDeleteRequest={() => setDeleteConfirmId(scan.id)}
                menuRef={openMenuId === scan.id ? menuRef : null}
              />
            ))}
          </div>

          <div style={{ padding: "10px 16px", borderTop: `1px solid ${ds.border.default}`, backgroundColor: ds.bg.elevated, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>
              {filtered.length} scan{filtered.length !== 1 ? "s" : ""} shown
            </span>
            <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>Range: {dateRange}</span>
          </div>
        </DSCard>
      )}

      {deleteConfirmId && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, backdropFilter: "blur(4px)" }}>
          <div style={{ backgroundColor: ds.bg.surface, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.xl, padding: 28, width: 360, boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}>
            <div style={{ marginBottom: 8, fontSize: ds.size.lg, fontWeight: ds.weight.semibold, color: ds.text.primary }}>Delete scan record?</div>
            <div style={{ fontSize: ds.size.sm, color: ds.text.muted, lineHeight: 1.6, marginBottom: 24 }}>This will permanently remove the scan record and all associated findings from history. This action cannot be undone.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <DSButton variant="secondary" size="md" onClick={() => setDeleteConfirmId(null)}>
                Cancel
              </DSButton>
              <DSButton variant="danger" size="md" icon={<Trash2 size={13} />} onClick={() => handleDelete(deleteConfirmId)}>
                Delete
              </DSButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TableRow({ scan, isLast, menuOpen, onOpenMenu, onDeleteRequest, menuRef }: { scan: HistoryScan; isLast: boolean; menuOpen: boolean; onOpenMenu: () => void; onDeleteRequest: () => void; menuRef: React.RefObject<HTMLDivElement | null> | null }) {
  const [rowHovered, setRowHovered] = useState(false);
  const cfg = STATUS_CONFIG[scan.status];
  const totalFindings = Object.values(scan.findings).reduce((a, b) => a + b, 0);

  return (
    <div
      onMouseEnter={() => setRowHovered(true)}
      onMouseLeave={() => setRowHovered(false)}
      style={{ display: "grid", gridTemplateColumns: "200px 110px 130px 80px 1fr 90px 40px", gap: 8, padding: "12px 16px", alignItems: "center", borderBottom: isLast ? "none" : `1px solid ${ds.border.default}`, backgroundColor: rowHovered ? ds.bg.elevated : "transparent", transition: "background 0.1s ease" }}
    >
      <div style={{ overflow: "hidden" }}>
        <div style={{ fontSize: ds.size.xs, fontFamily: "monospace", color: ds.text.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{scan.target}</div>
      </div>

      <span style={{ fontSize: ds.size.xs, color: ds.text.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{scan.program}</span>
      <span style={{ fontSize: ds.size.xs, color: ds.text.muted, fontVariantNumeric: "tabular-nums" }}>{scan.startedAt}</span>
      <span style={{ fontSize: ds.size.xs, color: ds.text.muted, fontVariantNumeric: "tabular-nums" }}>{scan.duration}</span>

      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {totalFindings === 0 ? (
          <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>—</span>
        ) : (
          Object.entries(scan.findings)
            .filter(([, n]) => n > 0)
            .map(([sev, count]) => (
              <span key={sev} style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 5px", borderRadius: ds.radius.md, fontSize: 10, fontWeight: ds.weight.medium, backgroundColor: (ds.severity as any)[`${sev}Bg`], color: (ds.severity as any)[sev] }}>
                <span style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: (ds.severity as any)[sev] }} />
                {count}
              </span>
            ))
        )}
      </div>

      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 20, padding: "0 8px", borderRadius: ds.radius.md, backgroundColor: cfg.bg, color: cfg.color, fontSize: ds.size.xs, fontWeight: ds.weight.medium, whiteSpace: "nowrap" }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: cfg.color }} />
        {cfg.label}
      </span>

      <div ref={menuRef} style={{ position: "relative" }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenMenu();
          }}
          style={{ width: 28, height: 28, borderRadius: ds.radius.md, border: `1px solid ${menuOpen ? ds.border.default : "transparent"}`, backgroundColor: menuOpen || rowHovered ? ds.bg.elevated : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: ds.text.muted, transition: "all 0.1s ease" }}
        >
          <MoreHorizontal size={14} />
        </button>

        {menuOpen && (
          <div style={{ position: "absolute", right: 0, top: 32, zIndex: 100, width: 188, backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
            <MenuItem icon={<ExternalLink size={12} />} label="View findings" sub={`/findings?scan=${scan.id}`} onClick={() => {}} />
            <div style={{ height: 1, backgroundColor: ds.border.default }} />
            <MenuItem icon={<RefreshCw size={12} />} label="Relaunch scan" sub="Opens Compose pre-filled" onClick={() => {}} />
            <div style={{ height: 1, backgroundColor: ds.border.default }} />
            <MenuItem icon={<Trash2 size={12} />} label="Delete record" sub="Cannot be undone" danger onClick={onDeleteRequest} />
          </div>
        )}
      </div>
    </div>
  );
}

function MenuItem({ icon, label, sub, onClick, danger }: { icon: React.ReactNode; label: string; sub?: string; onClick: () => void; danger?: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", border: "none", cursor: "pointer", backgroundColor: hov ? (danger ? ds.severity.criticalBg : "rgba(39,39,42,0.3)") : "transparent", color: danger ? ds.severity.critical : ds.text.secondary, textAlign: "left", fontFamily: "Inter, sans-serif", transition: "background 0.1s ease" }}
    >
      <span style={{ color: danger ? ds.severity.critical : ds.text.muted, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontSize: ds.size.xs, fontWeight: ds.weight.medium, color: danger ? ds.severity.critical : ds.text.primary }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: ds.text.muted, marginTop: 1 }}>{sub}</div>}
      </div>
    </button>
  );
}
