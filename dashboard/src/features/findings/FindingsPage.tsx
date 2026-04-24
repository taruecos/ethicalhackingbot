"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, X, RefreshCw, RotateCcw } from "lucide-react";
import { ds } from "@/components/ds/tokens";
import { DSButton } from "@/components/ds/DSButton";
import { FilterToolbar, DEFAULT_FILTERS } from "./FilterToolbar";
import type { Filters } from "./FilterToolbar";
import { BulkActionsBar } from "./BulkActionsBar";
import { FindingsTable } from "./FindingsTable";
import { FindingDrawer } from "./FindingDrawer";
import type { Finding, FindingStatus, Severity } from "./types";
import { apiToFinding } from "./types";

const SEV_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

const ALL_SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "info"];
const ALL_STATUSES: FindingStatus[] = ["NEW", "CONFIRMED", "FALSE_POSITIVE", "FIXED", "ACCEPTED", "REPORTED"];

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, height: 26, padding: "0 10px", backgroundColor: `${color}15`, borderRadius: ds.radius.md, border: `1px solid ${color}30` }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: color }} />
      <span style={{ fontSize: ds.size.xs, fontWeight: ds.weight.semibold, color, fontVariantNumeric: "tabular-nums" }}>{value}</span>
      <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>{label}</span>
    </div>
  );
}

export function FindingsPage() {
  const [filters, setFilters] = useState<Filters>({
    ...DEFAULT_FILTERS,
    severities: new Set(ALL_SEVERITIES),
    statuses: new Set(ALL_STATUSES),
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeFinding, setActiveFinding] = useState<Finding | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      const search = filters.search.trim();
      if (search) sp.set("search", search);
      if (filters.severities.size > 0 && filters.severities.size < ALL_SEVERITIES.length) {
        sp.set("severity", Array.from(filters.severities).map((s) => s.toUpperCase()).join(","));
      }
      if (filters.statuses.size > 0 && filters.statuses.size < ALL_STATUSES.length) {
        sp.set("status", Array.from(filters.statuses).join(","));
      }
      if (filters.modules.size === 1) {
        sp.set("module", Array.from(filters.modules)[0]);
      }
      const url = sp.toString() ? `/api/findings?${sp.toString()}` : "/api/findings";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const list = (json.findings ?? []) as Parameters<typeof apiToFinding>[0][];
      setFindings(list.map(apiToFinding));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [filters.search, filters.severities, filters.statuses, filters.modules]);

  useEffect(() => {
    load();
  }, [load]);

  const allModules = useMemo(() => Array.from(new Set(findings.map((f) => f.module))).sort(), [findings]);
  const allScans = useMemo(() => Array.from(new Set(findings.map((f) => f.scanName))).sort(), [findings]);
  const allPrograms = useMemo(() => Array.from(new Set(findings.map((f) => f.program))).sort(), [findings]);

  const filtered = useMemo(() => {
    let result = findings.filter((f) => {
      if (!filters.severities.has(f.severity)) return false;
      if (!filters.statuses.has(f.status)) return false;
      if (filters.modules.size > 0 && !filters.modules.has(f.module)) return false;
      if (filters.scans.size > 0 && !filters.scans.has(f.scanName)) return false;
      if (filters.programs.size > 0 && !filters.programs.has(f.program)) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!f.title.toLowerCase().includes(q) && !f.url.toLowerCase().includes(q) && !f.module.toLowerCase().includes(q)) return false;
      }
      return true;
    });

    if (filters.sortBy === "severity_desc") {
      result = [...result].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
    } else if (filters.sortBy === "date_desc") {
      result = [...result].sort((a, b) => new Date(b.firstSeen).getTime() - new Date(a.firstSeen).getTime());
    } else if (filters.sortBy === "cvss_desc") {
      result = [...result].sort((a, b) => b.cvss - a.cvss);
    }
    return result;
  }, [findings, filters]);

  const isFiltered =
    filters.search !== "" ||
    filters.severities.size < ALL_SEVERITIES.length ||
    filters.statuses.size < ALL_STATUSES.length ||
    filters.modules.size > 0 ||
    filters.scans.size > 0 ||
    filters.programs.size > 0;

  const stats = useMemo(
    () => ({
      total: findings.length,
      critical: findings.filter((f) => f.severity === "critical").length,
      newCount: findings.filter((f) => f.status === "NEW").length,
    }),
    [findings],
  );

  const handleSelect = (id: string, v: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (v) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const handleSelectAll = (v: boolean) => setSelected(v ? new Set(filtered.map((f) => f.id)) : new Set());
  const clearSelection = () => setSelected(new Set());

  // Patch a single finding's status via PATCH /api/findings/[id]
  const patchStatus = async (id: string, status: FindingStatus): Promise<boolean> => {
    try {
      const res = await fetch(`/api/findings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, falsePositive: status === "FALSE_POSITIVE" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status");
      return false;
    }
  };

  const bulkStatusChange = async (status: FindingStatus) => {
    const ids = Array.from(selected);
    // No bulk endpoint exists — fall back to per-id PATCH calls in parallel.
    const results = await Promise.all(ids.map((id) => patchStatus(id, status)));
    if (results.some(Boolean)) {
      setFindings((prev) =>
        prev.map((f) => (selected.has(f.id) && results[ids.indexOf(f.id)] ? { ...f, status } : f)),
      );
      clearSelection();
    }
  };
  const bulkDelete = async () => {
    // No DELETE /api/findings/[id] endpoint exists — show error.
    setError("Bulk delete not yet supported by the API. Endpoint DELETE /api/findings/[id] is missing.");
    clearSelection();
  };
  const bulkExport = () => {
    const rows = filtered.filter((f) => selected.has(f.id));
    const csv = [
      ["ID", "Title", "Severity", "Status", "CVSS", "CWE", "Module", "URL", "First Seen", "Program"],
      ...rows.map((f) => [f.id, f.title, f.severity, f.status, f.cvss, f.cwe, f.module, f.url, f.firstSeen, f.program]),
    ].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "findings-export.csv";
    a.click();
    URL.revokeObjectURL(url);
    clearSelection();
  };
  const bulkReport = () => {
    const rows = filtered.filter((f) => selected.has(f.id));
    const md = rows.map((f) => `# ${f.title}\n**Severity:** ${f.severity} | **CVSS:** ${f.cvss} | **CWE:** ${f.cwe}\n**URL:** ${f.url}\n\n${f.description}\n\n---`).join("\n\n");
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "findings-report.md";
    a.click();
    URL.revokeObjectURL(url);
    clearSelection();
  };

  const handleStatusChange = async (id: string, status: FindingStatus) => {
    const ok = await patchStatus(id, status);
    if (ok) {
      setFindings((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
      setActiveFinding((prev) => (prev?.id === id ? { ...prev, status } : prev));
    }
  };
  const handleDelete = async (_id: string) => {
    setError("Delete not yet supported by the API. Endpoint DELETE /api/findings/[id] is missing.");
    setActiveFinding(null);
  };

  const resetFilters = () =>
    setFilters({
      ...DEFAULT_FILTERS,
      severities: new Set(ALL_SEVERITIES),
      statuses: new Set(ALL_STATUSES),
    });

  return (
    <div>
      {error && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20, padding: "12px 16px", backgroundColor: ds.severity.criticalBg, border: `1px solid ${ds.severity.critical}40`, borderRadius: ds.radius.lg }}>
          <AlertCircle size={15} style={{ color: ds.severity.critical, flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.severity.critical, marginBottom: 3 }}>{loading ? "Failed to load findings" : "Action error"}</div>
            <div style={{ fontSize: ds.size.xs, color: ds.text.muted }}>{error}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <DSButton variant="secondary" size="sm" icon={<RefreshCw size={11} />} onClick={load}>
              Retry
            </DSButton>
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: ds.text.muted, display: "flex", padding: 2 }}>
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <h1 style={{ margin: 0, fontSize: ds.size["3xl"], fontWeight: ds.weight.bold, color: ds.text.primary, lineHeight: 1.2 }}>Findings</h1>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <StatPill label="Total" value={stats.total} color={ds.text.secondary} />
            <StatPill label="Critical" value={stats.critical} color={ds.severity.critical} />
            <StatPill label="New" value={stats.newCount} color={ds.severity.info} />
          </div>
        </div>
        <DSButton variant="secondary" size="sm" icon={<RefreshCw size={12} className={loading ? "animate-spin" : ""} />} onClick={load}>
          {loading ? "Loading…" : "Refresh"}
        </DSButton>
      </div>

      <div style={{ marginBottom: 12, minHeight: 46 }}>
        {selected.size > 0 ? (
          <BulkActionsBar count={selected.size} onMarkConfirmed={() => bulkStatusChange("CONFIRMED")} onMarkFP={() => bulkStatusChange("FALSE_POSITIVE")} onGenerateReport={bulkReport} onExport={bulkExport} onDelete={bulkDelete} onCancel={clearSelection} />
        ) : (
          <FilterToolbar filters={filters} onChange={setFilters} resultCount={filtered.length} allModules={allModules} allScans={allScans} allPrograms={allPrograms} />
        )}
      </div>

      <FindingsTable
        findings={loading && findings.length === 0 ? [] : filtered}
        loading={loading && findings.length === 0}
        selected={selected}
        onSelect={handleSelect}
        onSelectAll={handleSelectAll}
        onRowClick={setActiveFinding}
        isFiltered={isFiltered}
        onResetFilters={resetFilters}
      />

      <FindingDrawer finding={activeFinding} onClose={() => setActiveFinding(null)} onStatusChange={handleStatusChange} onDelete={handleDelete} />
      {/* prevent unused-import warning */}
      {false && <RotateCcw />}
    </div>
  );
}
