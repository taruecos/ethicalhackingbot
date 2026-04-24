"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MoreHorizontal, ExternalLink, RefreshCw, Trash2, Search, History, WifiOff, RotateCcw, Loader2 } from "lucide-react";
import { ds } from "@/components/ds/tokens";
import { DSCard } from "@/components/ds/DSCard";
import { DSButton } from "@/components/ds/DSButton";

type ApiStatus = "QUEUED" | "RUNNING" | "COMPLETE" | "ERROR" | "CANCELLED";
type HistoryStatus = "COMPLETE" | "ERROR" | "CANCELLED";
const HISTORY_STATUSES: HistoryStatus[] = ["COMPLETE", "ERROR", "CANCELLED"];

interface ApiScan {
  id: string;
  target: string;
  status: ApiStatus;
  programId: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  config: unknown;
  stats: Record<string, unknown> | null;
  _count?: { findings: number };
}

interface HistoryRow {
  id: string;
  target: string;
  program: string;
  programId: string | null;
  startedAt: string;
  startedAtMs: number;
  duration: string;
  status: HistoryStatus;
  findings: { critical: number; high: number; medium: number; low: number; info: number };
}

const STATUS_CONFIG: Record<HistoryStatus, { label: string; color: string; bg: string }> = {
  COMPLETE: { label: "Complete", color: ds.accent.default, bg: ds.accent.bg15 },
  ERROR: { label: "Error", color: ds.severity.critical, bg: ds.severity.criticalBg },
  CANCELLED: { label: "Cancelled", color: ds.text.muted, bg: "rgba(113,113,122,0.12)" },
};

const DATE_RANGES: Array<{ id: string; label: string; ms: number | null }> = [
  { id: "24h", label: "Last 24h", ms: 24 * 60 * 60 * 1000 },
  { id: "7d", label: "Last 7d", ms: 7 * 24 * 60 * 60 * 1000 },
  { id: "30d", label: "Last 30d", ms: 30 * 24 * 60 * 60 * 1000 },
  { id: "all", label: "All time", ms: null },
];

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function computeDuration(start: string | null, end: string | null, fallbackCreated: string): string {
  const startIso = start ?? fallbackCreated;
  if (!startIso) return "—";
  const startMs = new Date(startIso).getTime();
  const endMs = end ? new Date(end).getTime() : startMs;
  const sec = Math.max(0, Math.round((endMs - startMs) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function extractFindings(stats: Record<string, unknown> | null): HistoryRow["findings"] {
  const empty = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  if (!stats) return empty;
  const direct = stats.findings as Record<string, unknown> | undefined;
  if (direct && typeof direct === "object") {
    return {
      critical: Number(direct.critical ?? 0) || 0,
      high: Number(direct.high ?? 0) || 0,
      medium: Number(direct.medium ?? 0) || 0,
      low: Number(direct.low ?? 0) || 0,
      info: Number(direct.info ?? 0) || 0,
    };
  }
  const sev = stats.severityBreakdown as Record<string, unknown> | undefined;
  if (sev && typeof sev === "object") {
    return {
      critical: Number(sev.critical ?? 0) || 0,
      high: Number(sev.high ?? 0) || 0,
      medium: Number(sev.medium ?? 0) || 0,
      low: Number(sev.low ?? 0) || 0,
      info: Number(sev.info ?? 0) || 0,
    };
  }
  return empty;
}

export function HistoryTab() {
  const [statusFilter, setStatusFilter] = useState<Set<HistoryStatus>>(new Set(HISTORY_STATUSES));
  const [programFilter, setProgramFilter] = useState("All programs");
  const [dateRange, setDateRange] = useState("7d");
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [data, setData] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // The route doesn't support comma-separated statuses; fetch all and filter client-side.
      const res = await fetch("/api/scans", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const scans = (json.scans ?? []) as ApiScan[];
      const rows: HistoryRow[] = scans
        .filter((s) => s.status === "COMPLETE" || s.status === "ERROR" || s.status === "CANCELLED")
        .map((s) => ({
          id: s.id,
          target: s.target,
          program: s.programId ?? "—",
          programId: s.programId,
          startedAt: formatDateTime(s.startedAt ?? s.createdAt),
          startedAtMs: new Date(s.startedAt ?? s.createdAt).getTime(),
          duration: computeDuration(s.startedAt, s.finishedAt, s.createdAt),
          status: s.status as HistoryStatus,
          findings: extractFindings(s.stats),
        }));
      setData(rows);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const programOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of data) if (r.programId) set.add(r.programId);
    return ["All programs", ...Array.from(set).sort()];
  }, [data]);

  const toggleStatus = (s: HistoryStatus) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) {
        if (next.size > 1) next.delete(s);
      } else next.add(s);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const rangeMs = DATE_RANGES.find((r) => r.id === dateRange)?.ms ?? null;
    const cutoff = rangeMs !== null ? Date.now() - rangeMs : null;
    const q = search.trim().toLowerCase();
    return data.filter((scan) => {
      if (!statusFilter.has(scan.status)) return false;
      if (programFilter !== "All programs" && scan.programId !== programFilter) return false;
      if (cutoff !== null && scan.startedAtMs < cutoff) return false;
      if (q && !scan.target.toLowerCase().includes(q) && !scan.program.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, statusFilter, programFilter, dateRange, search]);

  const handleDelete = async (id: string) => {
    setActioning(id);
    try {
      const res = await fetch(`/api/scans/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeleteConfirmId(null);
      setOpenMenuId(null);
      setActioning(null);
    }
  };

  const handleRelaunch = async (id: string) => {
    setActioning(id);
    try {
      const res = await fetch(`/api/scans/${id}/relaunch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `HTTP ${res.status}`);
      }
      setOpenMenuId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to relaunch");
    } finally {
      setActioning(null);
    }
  };

  const dateRangeLabel = DATE_RANGES.find((r) => r.id === dateRange)?.label ?? dateRange;

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {HISTORY_STATUSES.map((s) => {
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
          {programOptions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <div style={{ display: "flex", gap: 4 }}>
          {DATE_RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setDateRange(r.id)}
              style={{ height: 28, padding: "0 10px", borderRadius: ds.radius.md, border: `1px solid ${dateRange === r.id ? ds.accent.default : ds.border.default}`, backgroundColor: dateRange === r.id ? ds.accent.bg15 : "transparent", color: dateRange === r.id ? ds.accent.default : ds.text.muted, fontSize: ds.size.xs, fontWeight: dateRange === r.id ? ds.weight.semibold : ds.weight.medium, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "all 0.1s ease" }}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div style={{ position: "relative", flex: 1, maxWidth: 240, marginLeft: "auto" }}>
          <Search size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: ds.text.muted, pointerEvents: "none" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search target or program…" style={{ width: "100%", height: 28, boxSizing: "border-box", backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.md, fontSize: ds.size.xs, fontFamily: "Inter, sans-serif", color: ds.text.primary, paddingLeft: 26, paddingRight: 8, outline: "none" }} />
        </div>

        <DSButton variant="secondary" size="sm" icon={<RefreshCw size={12} className={loading ? "animate-spin" : ""} />} onClick={load}>
          {loading ? "Loading…" : "Refresh"}
        </DSButton>
      </div>

      {error && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: ds.radius.lg, backgroundColor: ds.severity.criticalBg, border: `1px solid ${ds.severity.critical}40`, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <WifiOff size={16} style={{ color: ds.severity.critical, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.severity.critical }}>Unable to load scan history</div>
              <div style={{ fontSize: ds.size.xs, color: ds.text.muted, marginTop: 2 }}>{error}</div>
            </div>
          </div>
          <DSButton variant="danger" size="sm" icon={<RotateCcw size={12} />} onClick={load}>Retry</DSButton>
        </div>
      )}

      {loading && data.length === 0 && !error ? (
        <DSCard style={{ padding: 48, textAlign: "center" }}>
          <Loader2 size={28} className="animate-spin" style={{ color: ds.text.muted, margin: "0 auto 14px" }} />
          <div style={{ fontSize: ds.size.sm, color: ds.text.muted }}>Loading scan history…</div>
        </DSCard>
      ) : !error && filtered.length === 0 ? (
        <DSCard style={{ padding: 48, textAlign: "center" }}>
          <History size={36} style={{ color: ds.text.muted, margin: "0 auto 14px" }} />
          <div style={{ fontSize: ds.size.lg, fontWeight: ds.weight.semibold, color: ds.text.secondary, marginBottom: 6 }}>No scan history yet</div>
          <div style={{ fontSize: ds.size.sm, color: ds.text.muted }}>{data.length > 0 ? "No scans match your current filters." : "Complete your first scan to see history and analytics here."}</div>
        </DSCard>
      ) : !error ? (
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
                actioning={actioning === scan.id}
                onOpenMenu={() => setOpenMenuId(openMenuId === scan.id ? null : scan.id)}
                onDeleteRequest={() => setDeleteConfirmId(scan.id)}
                onRelaunch={() => handleRelaunch(scan.id)}
                menuRef={openMenuId === scan.id ? menuRef : null}
              />
            ))}
          </div>

          <div style={{ padding: "10px 16px", borderTop: `1px solid ${ds.border.default}`, backgroundColor: ds.bg.elevated, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>
              {filtered.length} scan{filtered.length !== 1 ? "s" : ""} shown
            </span>
            <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>Range: {dateRangeLabel}</span>
          </div>
        </DSCard>
      ) : null}

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

function TableRow({ scan, isLast, menuOpen, actioning, onOpenMenu, onDeleteRequest, onRelaunch, menuRef }: { scan: HistoryRow; isLast: boolean; menuOpen: boolean; actioning: boolean; onOpenMenu: () => void; onDeleteRequest: () => void; onRelaunch: () => void; menuRef: React.RefObject<HTMLDivElement | null> | null }) {
  const [rowHovered, setRowHovered] = useState(false);
  const cfg = STATUS_CONFIG[scan.status];
  const totalFindings = Object.values(scan.findings).reduce((a, b) => a + b, 0);

  return (
    <div
      onMouseEnter={() => setRowHovered(true)}
      onMouseLeave={() => setRowHovered(false)}
      style={{ display: "grid", gridTemplateColumns: "200px 110px 130px 80px 1fr 90px 40px", gap: 8, padding: "12px 16px", alignItems: "center", borderBottom: isLast ? "none" : `1px solid ${ds.border.default}`, backgroundColor: rowHovered ? ds.bg.elevated : "transparent", transition: "background 0.1s ease", opacity: actioning ? 0.5 : 1 }}
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
          {actioning ? <Loader2 size={14} className="animate-spin" /> : <MoreHorizontal size={14} />}
        </button>

        {menuOpen && !actioning && (
          <div style={{ position: "absolute", right: 0, top: 32, zIndex: 100, width: 188, backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
            <MenuItem icon={<ExternalLink size={12} />} label="View findings" sub={`/findings?scan=${scan.id}`} onClick={() => { window.location.href = `/findings?scanId=${scan.id}`; }} />
            <div style={{ height: 1, backgroundColor: ds.border.default }} />
            <MenuItem icon={<RefreshCw size={12} />} label="Relaunch scan" sub="Creates a fresh QUEUED scan" onClick={onRelaunch} />
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
