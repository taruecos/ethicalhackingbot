"use client";

import React, { useState, useRef, useEffect } from "react";
import { MoreHorizontal, ExternalLink, RefreshCw, Trash2, Search, History } from "lucide-react";
import { ds } from "@/components/ds/tokens";
import { DSCard } from "@/components/ds/DSCard";
import { DSButton } from "@/components/ds/DSButton";

type HistoryStatus = "COMPLETE" | "ERROR" | "CANCELLED";
type DateRangeKey = "24h" | "7d" | "30d" | "all";

interface ApiScan {
  id: string;
  target: string;
  status: HistoryStatus | "QUEUED" | "RUNNING";
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  programId: string | null;
  config: any;
  stats: any;
  _count?: { findings: number };
}

interface ProgramRef {
  id: string;
  name: string;
}

const DATE_RANGES: { key: DateRangeKey; label: string }[] = [
  { key: "24h", label: "Last 24h" },
  { key: "7d", label: "Last 7d" },
  { key: "30d", label: "Last 30d" },
  { key: "all", label: "All time" },
];

const STATUS_CONFIG: Record<HistoryStatus, { label: string; color: string; bg: string }> = {
  COMPLETE: { label: "Complete", color: ds.accent.default, bg: ds.accent.bg15 },
  ERROR: { label: "Error", color: ds.severity.critical, bg: ds.severity.criticalBg },
  CANCELLED: { label: "Cancelled", color: ds.text.muted, bg: "rgba(113,113,122,0.12)" },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatStarted(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = MONTHS[d.getMonth()];
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${day} ${month} ${time}`;
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

function rangeCutoff(range: DateRangeKey): Date | null {
  const now = Date.now();
  if (range === "24h") return new Date(now - 24 * 60 * 60 * 1000);
  if (range === "7d") return new Date(now - 7 * 24 * 60 * 60 * 1000);
  if (range === "30d") return new Date(now - 30 * 24 * 60 * 60 * 1000);
  return null;
}

export function HistoryTab() {
  const [statusFilter, setStatusFilter] = useState<Set<HistoryStatus>>(new Set(["COMPLETE", "ERROR", "CANCELLED"]));
  const [programFilter, setProgramFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRangeKey>("7d");
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [scans, setScans] = useState<ApiScan[] | null>(null);
  const [programs, setPrograms] = useState<ProgramRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const loadScans = async () => {
    setLoading(true);
    setError(null);
    try {
      const [scansRes, progRes] = await Promise.all([
        fetch("/api/scans", { credentials: "same-origin" }),
        fetch("/api/programs", { credentials: "same-origin" }),
      ]);
      if (!scansRes.ok) throw new Error(`HTTP ${scansRes.status}`);
      const scansJson = await scansRes.json();
      const all: ApiScan[] = scansJson.scans ?? [];
      setScans(all.filter((s) => s.status === "COMPLETE" || s.status === "ERROR" || s.status === "CANCELLED"));
      if (progRes.ok) {
        const progJson = await progRes.json();
        const list: ProgramRef[] = (progJson.programs ?? []).map((p: any) => ({ id: p.id, name: p.name ?? p.handle ?? p.id }));
        setPrograms(list);
      }
    } catch (e: any) {
      setError(e?.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadScans();
  }, []);

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

  const programLabel = (id: string | null): string => {
    if (!id) return "—";
    const found = programs.find((p) => p.id === id);
    return found?.name ?? id;
  };

  const cutoff = rangeCutoff(dateRange);

  const filtered = (scans ?? []).filter((scan) => {
    if (!statusFilter.has(scan.status as HistoryStatus)) return false;
    if (programFilter !== "all" && scan.programId !== programFilter) return false;
    if (cutoff && scan.createdAt && new Date(scan.createdAt) < cutoff) return false;
    const progName = programLabel(scan.programId);
    if (
      search &&
      !scan.target.toLowerCase().includes(search.toLowerCase()) &&
      !progName.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/scans/${id}`, { method: "DELETE", credentials: "same-origin" });
    } catch {
      // ignore — list refresh below
    }
    setDeleteConfirmId(null);
    setOpenMenuId(null);
    await loadScans();
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
          <option value="all">All programs</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <div style={{ display: "flex", gap: 4 }}>
          {DATE_RANGES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setDateRange(key)}
              style={{ height: 28, padding: "0 10px", borderRadius: ds.radius.md, border: `1px solid ${dateRange === key ? ds.accent.default : ds.border.default}`, backgroundColor: dateRange === key ? ds.accent.bg15 : "transparent", color: dateRange === key ? ds.accent.default : ds.text.muted, fontSize: ds.size.xs, fontWeight: dateRange === key ? ds.weight.semibold : ds.weight.medium, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "all 0.1s ease" }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ position: "relative", flex: 1, maxWidth: 240, marginLeft: "auto" }}>
          <Search size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: ds.text.muted, pointerEvents: "none" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search target or program…" style={{ width: "100%", height: 28, boxSizing: "border-box", backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.md, fontSize: ds.size.xs, fontFamily: "Inter, sans-serif", color: ds.text.primary, paddingLeft: 26, paddingRight: 8, outline: "none" }} />
        </div>
      </div>

      {loading && !scans ? (
        <DSCard style={{ padding: 48, textAlign: "center", color: ds.text.muted, fontSize: ds.size.sm }}>Loading history…</DSCard>
      ) : error ? (
        <DSCard style={{ padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: ds.size.sm, color: ds.severity.critical, marginBottom: 12 }}>Failed to load history: {error}</div>
          <DSButton variant="secondary" size="sm" onClick={loadScans}>Retry</DSButton>
        </DSCard>
      ) : filtered.length === 0 ? (
        <DSCard style={{ padding: 48, textAlign: "center" }}>
          <History size={36} style={{ color: ds.text.muted, margin: "0 auto 14px" }} />
          <div style={{ fontSize: ds.size.lg, fontWeight: ds.weight.semibold, color: ds.text.secondary, marginBottom: 6 }}>
            {(scans?.length ?? 0) === 0 ? "No scan history yet" : "No matching scans"}
          </div>
          <div style={{ fontSize: ds.size.sm, color: ds.text.muted }}>
            {(scans?.length ?? 0) === 0
              ? "Complete your first scan to see history and analytics here."
              : "No scans match your current filters."}
          </div>
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
                programLabel={programLabel(scan.programId)}
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
            <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>Range: {DATE_RANGES.find((r) => r.key === dateRange)?.label}</span>
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

function TableRow({ scan, programLabel, isLast, menuOpen, onOpenMenu, onDeleteRequest, menuRef }: { scan: ApiScan; programLabel: string; isLast: boolean; menuOpen: boolean; onOpenMenu: () => void; onDeleteRequest: () => void; menuRef: React.RefObject<HTMLDivElement | null> | null }) {
  const [rowHovered, setRowHovered] = useState(false);
  const cfg = STATUS_CONFIG[scan.status as HistoryStatus] ?? STATUS_CONFIG.COMPLETE;
  const findings = getFindingsBreakdown(scan);
  const totalFindings = Object.values(findings).reduce((a, b) => a + b, 0);

  return (
    <div
      onMouseEnter={() => setRowHovered(true)}
      onMouseLeave={() => setRowHovered(false)}
      style={{ display: "grid", gridTemplateColumns: "200px 110px 130px 80px 1fr 90px 40px", gap: 8, padding: "12px 16px", alignItems: "center", borderBottom: isLast ? "none" : `1px solid ${ds.border.default}`, backgroundColor: rowHovered ? ds.bg.elevated : "transparent", transition: "background 0.1s ease" }}
    >
      <div style={{ overflow: "hidden" }}>
        <div style={{ fontSize: ds.size.xs, fontFamily: "monospace", color: ds.text.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{scan.target}</div>
      </div>

      <span style={{ fontSize: ds.size.xs, color: ds.text.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{programLabel}</span>
      <span style={{ fontSize: ds.size.xs, color: ds.text.muted, fontVariantNumeric: "tabular-nums" }}>{formatStarted(scan.startedAt ?? scan.createdAt)}</span>
      <span style={{ fontSize: ds.size.xs, color: ds.text.muted, fontVariantNumeric: "tabular-nums" }}>{formatDuration(scan.startedAt, scan.finishedAt)}</span>

      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {totalFindings === 0 ? (
          (scan._count?.findings ?? 0) > 0 ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 6px", borderRadius: ds.radius.md, fontSize: 10, fontWeight: ds.weight.semibold, backgroundColor: ds.bg.elevated, color: ds.text.secondary, border: `1px solid ${ds.border.default}` }}>
              {scan._count?.findings}
            </span>
          ) : (
            <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>{scan.status === "COMPLETE" ? "0" : "—"}</span>
          )
        ) : (
          Object.entries(findings)
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
            <MenuItem icon={<ExternalLink size={12} />} label="View findings" sub={`/findings?scan=${scan.id}`} onClick={() => { window.location.href = `/findings?scan=${scan.id}`; }} />
            <div style={{ height: 1, backgroundColor: ds.border.default }} />
            <MenuItem icon={<RefreshCw size={12} />} label="Relaunch scan" sub="Opens Compose pre-filled" onClick={async () => {
              try {
                await fetch(`/api/scans/${scan.id}/relaunch`, { method: "POST", credentials: "same-origin" });
              } catch {
                // ignore
              }
              window.location.href = "/scans?tab=compose";
            }} />
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
