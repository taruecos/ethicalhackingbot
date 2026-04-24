"use client";

import React, { useState, useEffect, useRef } from "react";
import { SlidersHorizontal, X, ChevronDown, ChevronUp, RotateCcw, Database, Loader2, Search } from "lucide-react";
import { ds } from "@/components/ds/tokens";
import { DSButton } from "@/components/ds/DSButton";
import { ProgramCard } from "./ProgramCard";
import { ProgramDrawer } from "./ProgramDrawer";
import { SYNCED_PROGRAMS, ALL_INDUSTRIES } from "./mockData";
import type { Program, ComplianceStatus } from "./mockData";

const DEFAULT_FILTERS = {
  search: "",
  compliance: new Set<ComplianceStatus>(["allowed", "conditional", "not_allowed"]),
  safeHarbour: "all" as "yes" | "no" | "all",
  bountyType: "all" as "bounty" | "responsible_disclosure" | "all",
  industries: new Set<string>(),
  confidentiality: "all" as "public" | "application_only" | "all",
  sortBy: "recently_synced" as "recently_synced" | "highest_bounty" | "name_az",
};

type Filters = typeof DEFAULT_FILTERS;
type DemoState = "default" | "loading" | "syncing" | "empty_db";

function IndustryDropdown({ selected, onChange }: { selected: Set<string>; onChange: (s: Set<string>) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (ind: string) => {
    const next = new Set(selected);
    if (next.has(ind)) next.delete(ind);
    else next.add(ind);
    onChange(next);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", height: 30, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px", backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.md, color: selected.size ? ds.text.primary : ds.text.muted, fontSize: ds.size.xs, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
        <span>{selected.size ? `${selected.size} selected` : "All industries"}</span>
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 60, backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.md, marginTop: 4, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
          {ALL_INDUSTRIES.map((ind) => (
            <div
              key={ind}
              onClick={() => toggle(ind)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", cursor: "pointer", fontSize: ds.size.xs, color: ds.text.secondary, backgroundColor: selected.has(ind) ? ds.accent.bg15 : "transparent", transition: "background 0.1s" }}
            >
              <div style={{ width: 14, height: 14, borderRadius: 4, flexShrink: 0, backgroundColor: selected.has(ind) ? ds.accent.default : "transparent", border: `1.5px solid ${selected.has(ind) ? ds.accent.default : "rgba(113,113,122,0.5)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {selected.has(ind) && (
                  <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                    <path d="M1 3L3 5L7 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                )}
              </div>
              {ind}
            </div>
          ))}
          {selected.size > 0 && (
            <div onClick={() => onChange(new Set())} style={{ padding: "7px 10px", cursor: "pointer", fontSize: 10, color: ds.severity.critical, borderTop: `1px solid ${ds.border.default}`, textAlign: "center" }}>
              Clear selection
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RadioGroup({ value, options, onChange }: { value: string; options: Array<{ val: string; label: string }>; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {options.map(({ val, label }) => (
        <label key={val} onClick={() => onChange(val)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <div style={{ width: 14, height: 14, borderRadius: "50%", flexShrink: 0, border: `2px solid ${value === val ? ds.accent.default : "rgba(113,113,122,0.5)"}`, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.1s" }}>
            {value === val && <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: ds.accent.default }} />}
          </div>
          <span style={{ fontSize: ds.size.xs, color: value === val ? ds.text.primary : ds.text.secondary }}>{label}</span>
        </label>
      ))}
    </div>
  );
}

function FilterGroup({ label, children, noBorder }: { label: string; children: React.ReactNode; noBorder?: boolean }) {
  return (
    <div style={{ padding: "14px 0", borderBottom: noBorder ? "none" : `1px solid ${ds.border.default}` }}>
      <div style={{ fontSize: 10, fontWeight: ds.weight.semibold, color: ds.text.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>{label}</div>
      {children}
    </div>
  );
}

function FilterSidebar({ filters, onChange, onReset }: { filters: Filters; onChange: (f: Partial<Filters>) => void; onReset: () => void }) {
  const toggleCompliance = (val: ComplianceStatus) => {
    const next = new Set(filters.compliance);
    if (next.has(val)) {
      if (next.size > 1) next.delete(val);
    } else next.add(val);
    onChange({ compliance: next });
  };

  const complianceOptions: Array<{ val: ComplianceStatus; label: string; color: string }> = [
    { val: "allowed", label: "Automated Allowed", color: ds.accent.default },
    { val: "conditional", label: "Conditional", color: ds.severity.high },
    { val: "not_allowed", label: "Not Allowed", color: ds.severity.critical },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <FilterGroup label="Search">
        <div style={{ position: "relative" }}>
          <Search size={11} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: ds.text.muted, pointerEvents: "none" }} />
          <input value={filters.search} onChange={(e) => onChange({ search: e.target.value })} placeholder="Program name…" style={{ width: "100%", height: 30, boxSizing: "border-box", backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.md, fontSize: ds.size.xs, fontFamily: "Inter, sans-serif", color: ds.text.primary, paddingLeft: 26, paddingRight: 8, outline: "none" }} />
        </div>
      </FilterGroup>

      <FilterGroup label="Compliance">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {complianceOptions.map(({ val, label, color }) => (
            <label key={val} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <div
                onClick={() => toggleCompliance(val)}
                style={{ width: 14, height: 14, borderRadius: 4, flexShrink: 0, backgroundColor: filters.compliance.has(val) ? color : "transparent", border: `1.5px solid ${filters.compliance.has(val) ? color : "rgba(113,113,122,0.5)"}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.1s" }}
              >
                {filters.compliance.has(val) && (
                  <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                    <path d="M1 3L3 5L7 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                )}
              </div>
              <span style={{ fontSize: ds.size.xs, color: filters.compliance.has(val) ? color : ds.text.secondary }}>{label}</span>
            </label>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Safe Harbour">
        <RadioGroup value={filters.safeHarbour} options={[{ val: "all", label: "All" }, { val: "yes", label: "Yes" }, { val: "no", label: "No" }]} onChange={(v) => onChange({ safeHarbour: v as Filters["safeHarbour"] })} />
      </FilterGroup>

      <FilterGroup label="Bounty Type">
        <RadioGroup value={filters.bountyType} options={[{ val: "all", label: "All" }, { val: "bounty", label: "Has Bounty" }, { val: "responsible_disclosure", label: "Resp. Disclosure" }]} onChange={(v) => onChange({ bountyType: v as Filters["bountyType"] })} />
      </FilterGroup>

      <FilterGroup label="Industry">
        <IndustryDropdown selected={filters.industries} onChange={(s) => onChange({ industries: s })} />
      </FilterGroup>

      <FilterGroup label="Confidentiality">
        <RadioGroup value={filters.confidentiality} options={[{ val: "all", label: "All" }, { val: "public", label: "Public" }, { val: "application_only", label: "App Only" }]} onChange={(v) => onChange({ confidentiality: v as Filters["confidentiality"] })} />
      </FilterGroup>

      <FilterGroup label="Sort By" noBorder>
        <RadioGroup
          value={filters.sortBy}
          options={[
            { val: "recently_synced", label: "Recently Synced" },
            { val: "highest_bounty", label: "Highest Bounty" },
            { val: "name_az", label: "Name A–Z" },
          ]}
          onChange={(v) => onChange({ sortBy: v as Filters["sortBy"] })}
        />
      </FilterGroup>

      <div style={{ paddingTop: 14 }}>
        <DSButton variant="ghost" size="sm" icon={<RotateCcw size={11} />} onClick={onReset} style={{ width: "100%" }}>
          Reset filters
        </DSButton>
      </div>
    </div>
  );
}

function Skel({ w, h, mb = 0 }: { w: number | string; h: number; mb?: number }) {
  return <div className="animate-pulse" style={{ width: w, height: h, marginBottom: mb, borderRadius: ds.radius.md, backgroundColor: ds.bg.elevated }} />;
}

function SkeletonCard() {
  return (
    <div style={{ backgroundColor: ds.bg.surface, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px 12px", borderBottom: `1px solid ${ds.border.default}` }}>
        <Skel w="60%" h={14} mb={6} />
        <Skel w="40%" h={11} />
      </div>
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <Skel w="100%" h={52} />
        <Skel w="80%" h={13} />
      </div>
    </div>
  );
}

function EmptyState({ icon, title, subtitle, cta, onCta }: { icon: React.ReactNode; title: string; subtitle: string; cta?: string; onCta?: () => void }) {
  return (
    <div style={{ padding: "60px 32px", textAlign: "center", backgroundColor: ds.bg.surface, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg }}>
      <div style={{ margin: "0 auto 16px", display: "flex", justifyContent: "center" }}>{icon}</div>
      <div style={{ fontSize: ds.size.lg, fontWeight: ds.weight.semibold, color: ds.text.secondary, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: ds.size.sm, color: ds.text.muted, maxWidth: 380, margin: "0 auto 20px" }}>{subtitle}</div>
      {cta && onCta && (
        <DSButton variant="secondary" size="md" icon={<RotateCcw size={13} />} onClick={onCta}>
          {cta}
        </DSButton>
      )}
    </div>
  );
}

export function SyncedTab({ syncingExternal }: { syncingExternal?: boolean }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS, compliance: new Set(DEFAULT_FILTERS.compliance) });
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [demoState, setDemoState] = useState<DemoState>("default");
  const [syncPct, setSyncPct] = useState(0);

  useEffect(() => {
    if (syncingExternal) {
      setDemoState("syncing");
      let pct = 0;
      const iv = setInterval(() => {
        pct = Math.min(100, pct + Math.random() * 8 + 2);
        setSyncPct(pct);
        if (pct >= 100) clearInterval(iv);
      }, 120);
    }
  }, [syncingExternal]);

  const updateFilter = (partial: Partial<Filters>) => setFilters((prev) => ({ ...prev, ...partial }));
  const resetFilters = () => setFilters({ ...DEFAULT_FILTERS, compliance: new Set(DEFAULT_FILTERS.compliance) });

  const applyFilters = (programs: Program[]) => {
    let result = programs.filter((p) => {
      if (!filters.compliance.has(p.complianceStatus)) return false;
      if (filters.safeHarbour === "yes" && !p.safeHarbour) return false;
      if (filters.safeHarbour === "no" && p.safeHarbour) return false;
      if (filters.bountyType !== "all" && p.bountyType !== filters.bountyType) return false;
      if (filters.industries.size > 0 && !filters.industries.has(p.industry)) return false;
      if (filters.confidentiality !== "all" && p.confidentiality !== filters.confidentiality) return false;
      if (filters.search && !p.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
      return true;
    });
    if (filters.sortBy === "highest_bounty") result = result.sort((a, b) => (b.bountyMax ?? 0) - (a.bountyMax ?? 0));
    else if (filters.sortBy === "name_az") result = result.sort((a, b) => a.name.localeCompare(b.name));
    return result;
  };

  const filtered = applyFilters(SYNCED_PROGRAMS);
  const isFiltered = filters.search !== "" || filters.industries.size > 0 || filters.safeHarbour !== "all" || filters.bountyType !== "all" || filters.confidentiality !== "all" || filters.compliance.size < 3;

  const activeFilterCount = [filters.search ? 1 : 0, filters.industries.size > 0 ? 1 : 0, filters.safeHarbour !== "all" ? 1 : 0, filters.bountyType !== "all" ? 1 : 0, filters.confidentiality !== "all" ? 1 : 0, filters.compliance.size < 3 ? 1 : 0].reduce((a, b) => a + b, 0);

  const showLoading = demoState === "loading";
  const showSyncing = demoState === "syncing";
  const showEmptyDB = demoState === "empty_db";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "7px 12px", backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg, flexWrap: "wrap" }}>
        <span style={{ fontSize: ds.size.xs, color: ds.text.muted, fontWeight: ds.weight.semibold, textTransform: "uppercase", letterSpacing: "0.06em" }}>State</span>
        {(["default", "loading", "syncing", "empty_db"] as DemoState[]).map((s) => (
          <button
            key={s}
            onClick={() => {
              setDemoState(s);
              if (s === "syncing") setSyncPct(38);
            }}
            style={{ height: 24, padding: "0 10px", borderRadius: ds.radius.md, cursor: "pointer", border: `1px solid ${demoState === s ? ds.accent.default : ds.border.default}`, backgroundColor: demoState === s ? ds.accent.bg15 : "transparent", color: demoState === s ? ds.accent.default : ds.text.secondary, fontSize: ds.size.xs, fontFamily: "Inter, sans-serif", transition: "all 0.1s ease" }}
          >
            {s}
          </button>
        ))}
      </div>

      {showSyncing && (
        <div style={{ marginBottom: 16, padding: "12px 16px", backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Loader2 size={13} className="animate-spin" style={{ color: ds.accent.default }} />
              <span style={{ fontSize: ds.size.sm, color: ds.text.primary }}>Syncing programs with Intigriti…</span>
            </div>
            <span style={{ fontSize: ds.size.xs, color: ds.accent.default, fontVariantNumeric: "tabular-nums", fontWeight: ds.weight.semibold }}>{Math.round(syncPct * 1.2)}/120</span>
          </div>
          <div style={{ height: 4, backgroundColor: ds.bg.base, borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${syncPct}%`, height: "100%", backgroundColor: ds.accent.default, borderRadius: 2, transition: "width 0.15s ease" }} />
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        {sidebarOpen && (
          <aside style={{ width: 248, flexShrink: 0, position: "sticky", top: 0, backgroundColor: ds.bg.surface, borderRadius: ds.radius.lg, border: `1px solid ${ds.border.default}`, padding: "14px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: ds.size.xs, fontWeight: ds.weight.semibold, color: ds.text.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Filters{" "}
                {activeFilterCount > 0 && (
                  <span style={{ marginLeft: 4, fontSize: 9, fontWeight: ds.weight.bold, backgroundColor: ds.accent.default, color: "#000", padding: "1px 5px", borderRadius: ds.radius.md }}>{activeFilterCount}</span>
                )}
              </span>
              <button onClick={() => setSidebarOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: ds.text.muted, display: "flex", alignItems: "center", padding: 2 }}>
                <X size={13} />
              </button>
            </div>
            <FilterSidebar filters={filters} onChange={updateFilter} onReset={resetFilters} />
          </aside>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} style={{ display: "flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px", borderRadius: ds.radius.md, border: `1px solid ${activeFilterCount ? ds.accent.default : ds.border.default}`, backgroundColor: activeFilterCount ? ds.accent.bg15 : ds.bg.elevated, color: activeFilterCount ? ds.accent.default : ds.text.secondary, fontSize: ds.size.xs, fontWeight: ds.weight.medium, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                <SlidersHorizontal size={12} />
                Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
              </button>
            )}
            <span style={{ fontSize: ds.size.xs, color: ds.text.muted, marginLeft: "auto" }}>
              {!showLoading && !showEmptyDB && (
                <>
                  {filtered.length} program{filtered.length !== 1 ? "s" : ""}
                </>
              )}
            </span>
            {isFiltered && !showLoading && (
              <button onClick={resetFilters} style={{ display: "flex", alignItems: "center", gap: 4, height: 26, padding: "0 10px", borderRadius: ds.radius.md, border: `1px solid ${ds.border.default}`, backgroundColor: "transparent", color: ds.text.muted, fontSize: ds.size.xs, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                <RotateCcw size={10} /> Clear filters
              </button>
            )}
          </div>

          {showLoading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : showEmptyDB ? (
            <EmptyState icon={<Database size={40} style={{ color: ds.text.muted }} />} title="No programs synced yet" subtitle='Click "Sync Intigriti" in the header to import your program list from the platform.' />
          ) : filtered.length === 0 ? (
            <EmptyState icon={<SlidersHorizontal size={36} style={{ color: ds.text.muted }} />} title="No programs match your filters" subtitle="Try adjusting the filter criteria or reset to see all programs." cta="Reset filters" onCta={resetFilters} />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
              {filtered.map((p) => (
                <ProgramCard key={p.id} program={p} onDetails={setSelectedProgram} onScan={() => {}} />
              ))}
            </div>
          )}
        </div>
      </div>

      <ProgramDrawer program={selectedProgram} onClose={() => setSelectedProgram(null)} onScan={() => setSelectedProgram(null)} />
    </div>
  );
}
