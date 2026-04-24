"use client";

import React, { useState, useMemo } from "react";
import { AlertCircle, X, RefreshCw } from "lucide-react";
import { ds } from "@/components/ds/tokens";
import { DSButton } from "@/components/ds/DSButton";
import { FilterToolbar, DEFAULT_FILTERS } from "./FilterToolbar";
import type { Filters } from "./FilterToolbar";
import { BulkActionsBar } from "./BulkActionsBar";
import { FindingsTable } from "./FindingsTable";
import { FindingDrawer } from "./FindingDrawer";
import { FINDINGS, FINDING_STATS } from "./mockData";
import type { Finding, FindingStatus, Severity } from "./mockData";

const SEV_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, height: 26, padding: "0 10px", backgroundColor: `${color}15`, borderRadius: ds.radius.md, border: `1px solid ${color}30` }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: color }} />
      <span style={{ fontSize: ds.size.xs, fontWeight: ds.weight.semibold, color, fontVariantNumeric: "tabular-nums" }}>{value}</span>
      <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>{label}</span>
    </div>
  );
}

type PageState = "default" | "loading" | "error" | "empty";

export function FindingsPage() {
  const [filters, setFilters] = useState<Filters>({
    ...DEFAULT_FILTERS,
    severities: new Set(["critical", "high", "medium", "low", "info"] as Severity[]),
    statuses: new Set(["NEW", "CONFIRMED", "FALSE_POSITIVE", "FIXED", "ACCEPTED", "REPORTED"] as FindingStatus[]),
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeFinding, setActiveFinding] = useState<Finding | null>(null);
  const [findings, setFindings] = useState<Finding[]>([...FINDINGS]);
  const [pageState, setPageState] = useState<PageState>("default");
  const [errorBanner, setErrorBanner] = useState(false);

  const filtered = useMemo(() => {
    let result = findings.filter((f) => {
      if (!filters.severities.has(f.severity as Severity)) return false;
      if (!filters.statuses.has(f.status as FindingStatus)) return false;
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
      result = result.sort((a, b) => SEV_ORDER[a.severity as Severity] - SEV_ORDER[b.severity as Severity]);
    } else if (filters.sortBy === "date_desc") {
      result = result.sort((a, b) => new Date(b.firstSeen).getTime() - new Date(a.firstSeen).getTime());
    } else if (filters.sortBy === "cvss_desc") {
      result = result.sort((a, b) => b.cvss - a.cvss);
    }
    return result;
  }, [findings, filters]);

  const isFiltered = filters.search !== "" || filters.severities.size < 5 || filters.statuses.size < 6 || filters.modules.size > 0 || filters.scans.size > 0 || filters.programs.size > 0;

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

  const bulkStatusChange = (status: FindingStatus) => {
    setFindings((prev) => prev.map((f) => (selected.has(f.id) ? { ...f, status } : f)));
    clearSelection();
  };
  const bulkDelete = () => {
    setFindings((prev) => prev.filter((f) => !selected.has(f.id)));
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

  const handleStatusChange = (id: string, status: FindingStatus) => {
    setFindings((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
    setActiveFinding((prev) => (prev?.id === id ? { ...prev, status } : prev));
  };
  const handleDelete = (id: string) => {
    setFindings((prev) => prev.filter((f) => f.id !== id));
    setActiveFinding(null);
  };

  const resetFilters = () =>
    setFilters({
      ...DEFAULT_FILTERS,
      severities: new Set(["critical", "high", "medium", "low", "info"] as Severity[]),
      statuses: new Set(["NEW", "CONFIRMED", "FALSE_POSITIVE", "FIXED", "ACCEPTED", "REPORTED"] as FindingStatus[]),
    });

  const isLoading = pageState === "loading";
  const showError = pageState === "error" || errorBanner;

  return (
    <div>
      {showError && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20, padding: "12px 16px", backgroundColor: ds.severity.criticalBg, border: `1px solid ${ds.severity.critical}40`, borderRadius: ds.radius.lg }}>
          <AlertCircle size={15} style={{ color: ds.severity.critical, flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.severity.critical, marginBottom: 3 }}>Failed to load findings</div>
            <div style={{ fontSize: ds.size.xs, color: ds.text.muted }}>Could not connect to the findings service. Check your scanner configuration and try again.</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <DSButton variant="secondary" size="sm" icon={<RefreshCw size={11} />} onClick={() => setPageState("default")}>
              Retry
            </DSButton>
            <button
              onClick={() => {
                setErrorBanner(false);
                if (pageState === "error") setPageState("default");
              }}
              style={{ background: "none", border: "none", cursor: "pointer", color: ds.text.muted, display: "flex", padding: 2 }}
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <h1 style={{ margin: 0, fontSize: ds.size["3xl"], fontWeight: ds.weight.bold, color: ds.text.primary, lineHeight: 1.2 }}>Findings</h1>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <StatPill label="Total" value={FINDING_STATS.total} color={ds.text.secondary} />
            <StatPill label="Critical" value={FINDING_STATS.critical} color={ds.severity.critical} />
            <StatPill label="New" value={FINDING_STATS.newCount} color={ds.severity.info} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg }}>
          <span style={{ fontSize: 10, color: ds.text.muted, fontWeight: ds.weight.semibold, textTransform: "uppercase", letterSpacing: "0.06em" }}>State</span>
          {(["default", "loading", "error", "empty"] as PageState[]).map((s) => (
            <button
              key={s}
              onClick={() => {
                setPageState(s);
                if (s === "error") setErrorBanner(true);
                else setErrorBanner(false);
              }}
              style={{ height: 22, padding: "0 8px", borderRadius: ds.radius.md, cursor: "pointer", border: `1px solid ${pageState === s ? ds.accent.default : ds.border.default}`, backgroundColor: pageState === s ? ds.accent.bg15 : "transparent", color: pageState === s ? ds.accent.default : ds.text.secondary, fontSize: 10, fontFamily: "Inter, sans-serif" }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 12, minHeight: 46 }}>
        {selected.size > 0 ? (
          <BulkActionsBar count={selected.size} onMarkConfirmed={() => bulkStatusChange("CONFIRMED")} onMarkFP={() => bulkStatusChange("FALSE_POSITIVE")} onGenerateReport={bulkReport} onExport={bulkExport} onDelete={bulkDelete} onCancel={clearSelection} />
        ) : (
          <FilterToolbar filters={filters} onChange={setFilters} resultCount={filtered.length} />
        )}
      </div>

      {pageState === "empty" ? (
        <FindingsTable findings={[]} selected={selected} onSelect={handleSelect} onSelectAll={handleSelectAll} onRowClick={setActiveFinding} isFiltered={false} onResetFilters={resetFilters} />
      ) : (
        <FindingsTable findings={isLoading ? [] : filtered} loading={isLoading} selected={selected} onSelect={handleSelect} onSelectAll={handleSelectAll} onRowClick={setActiveFinding} isFiltered={isFiltered} onResetFilters={resetFilters} />
      )}

      <FindingDrawer finding={activeFinding} onClose={() => setActiveFinding(null)} onStatusChange={handleStatusChange} onDelete={handleDelete} />
    </div>
  );
}
