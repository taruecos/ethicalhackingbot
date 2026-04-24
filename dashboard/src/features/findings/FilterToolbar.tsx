"use client";

import React, { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, RotateCcw, X } from "lucide-react";
import { ds } from "@/components/ds/tokens";
import type { Severity, FindingStatus } from "./types";

export interface Filters {
  search: string;
  severities: Set<Severity>;
  statuses: Set<FindingStatus>;
  modules: Set<string>;
  scans: Set<string>;
  programs: Set<string>;
  sortBy: "severity_desc" | "date_desc" | "cvss_desc";
}

export const DEFAULT_FILTERS: Filters = {
  search: "",
  severities: new Set<Severity>(["critical", "high", "medium", "low", "info"]),
  statuses: new Set<FindingStatus>(["NEW", "CONFIRMED", "FALSE_POSITIVE", "FIXED", "ACCEPTED", "REPORTED"]),
  modules: new Set<string>(),
  scans: new Set<string>(),
  programs: new Set<string>(),
  sortBy: "severity_desc",
};

const SEV_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];
const SEV_COLORS: Record<Severity, string> = {
  critical: ds.severity.critical,
  high: ds.severity.high,
  medium: ds.severity.medium,
  low: ds.severity.low,
  info: ds.severity.info,
};
const SEV_LABELS: Record<Severity, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low", info: "Info" };

const STATUS_LIST: FindingStatus[] = ["NEW", "CONFIRMED", "FALSE_POSITIVE", "FIXED", "ACCEPTED", "REPORTED"];
const STATUS_COLORS: Record<FindingStatus, string> = {
  NEW: ds.severity.info,
  CONFIRMED: ds.severity.high,
  FALSE_POSITIVE: ds.text.muted,
  FIXED: ds.accent.default,
  ACCEPTED: ds.severity.medium,
  REPORTED: ds.severity.info,
};
const STATUS_LABELS: Record<FindingStatus, string> = {
  NEW: "New",
  CONFIRMED: "Confirmed",
  FALSE_POSITIVE: "False Positive",
  FIXED: "Fixed",
  ACCEPTED: "Accepted",
  REPORTED: "Reported",
};

function FilterChip<T extends string>({ label, allValues, selected, onSelect, renderOption, fullSet }: { label: string; allValues: T[]; selected: Set<T>; onSelect: (s: Set<T>) => void; renderOption?: (v: T) => React.ReactNode; fullSet: Set<T> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const filtered = selected.size < fullSet.size;

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const toggle = (v: T) => {
    const next = new Set(selected);
    if (next.has(v)) {
      if (next.size > 1) next.delete(v);
    } else next.add(v);
    onSelect(next);
  };

  const selectAll = () => onSelect(new Set(fullSet));

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 5, height: 30, padding: "0 10px", backgroundColor: filtered ? ds.accent.bg15 : ds.bg.elevated, border: `1px solid ${filtered ? ds.accent.default : ds.border.default}`, borderRadius: ds.radius.md, cursor: "pointer", fontFamily: "Inter, sans-serif", color: filtered ? ds.accent.default : ds.text.secondary, fontSize: ds.size.xs, fontWeight: filtered ? ds.weight.semibold : ds.weight.regular, transition: "all 0.1s ease" }}>
        {label}
        {filtered && <span style={{ fontSize: 9, fontWeight: ds.weight.bold, backgroundColor: ds.accent.default, color: "#000", padding: "1px 5px", borderRadius: 10, lineHeight: 1.5 }}>{selected.size}</span>}
        <ChevronDown size={10} style={{ opacity: 0.6 }} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 80, marginTop: 4, backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg, overflow: "hidden", minWidth: 180, boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
          <div onClick={selectAll} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", cursor: "pointer", fontSize: ds.size.xs, color: ds.text.muted, borderBottom: `1px solid ${ds.border.default}` }}>
            <div style={{ width: 14, height: 14, borderRadius: 4, flexShrink: 0, backgroundColor: !filtered ? ds.accent.default : "transparent", border: `1.5px solid ${!filtered ? ds.accent.default : "rgba(113,113,122,0.4)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {!filtered && (
                <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                  <path d="M1 3L3 5L7 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              )}
            </div>
            All {label.toLowerCase()}
          </div>
          {allValues.map((v) => {
            const isSelected = selected.has(v);
            return (
              <div key={v} onClick={() => toggle(v)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", cursor: "pointer", fontSize: ds.size.xs, color: isSelected ? ds.text.primary : ds.text.muted, backgroundColor: "transparent", transition: "background 0.1s" }}>
                <div style={{ width: 14, height: 14, borderRadius: 4, flexShrink: 0, backgroundColor: isSelected ? ds.accent.default : "transparent", border: `1.5px solid ${isSelected ? ds.accent.default : "rgba(113,113,122,0.4)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {isSelected && (
                    <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                      <path d="M1 3L3 5L7 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  )}
                </div>
                {renderOption ? renderOption(v) : v}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SortDropdown({ value, onChange }: { value: Filters["sortBy"]; onChange: (v: Filters["sortBy"]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const OPTIONS: Array<{ val: Filters["sortBy"]; label: string }> = [
    { val: "severity_desc", label: "Severity (High → Low)" },
    { val: "date_desc", label: "Date (Newest first)" },
    { val: "cvss_desc", label: "CVSS Score (High → Low)" },
  ];
  const current = OPTIONS.find((o) => o.val === value)!;

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 6, height: 30, padding: "0 10px", backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.md, cursor: "pointer", fontFamily: "Inter, sans-serif", color: ds.text.secondary, fontSize: ds.size.xs }}>
        <span style={{ color: ds.text.muted, fontSize: ds.size.xs }}>Sort:</span>
        {current.label}
        <ChevronDown size={10} style={{ opacity: 0.6 }} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", right: 0, zIndex: 80, marginTop: 4, backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg, overflow: "hidden", minWidth: 200, boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
          {OPTIONS.map((o) => (
            <div
              key={o.val}
              onClick={() => {
                onChange(o.val);
                setOpen(false);
              }}
              style={{ padding: "8px 12px", cursor: "pointer", fontSize: ds.size.xs, color: value === o.val ? ds.accent.default : ds.text.secondary, backgroundColor: value === o.val ? ds.accent.bg15 : "transparent", fontWeight: value === o.val ? ds.weight.semibold : ds.weight.regular }}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface FilterToolbarProps {
  filters: Filters;
  onChange: (f: Filters) => void;
  resultCount: number;
  allModules: string[];
  allScans: string[];
  allPrograms: string[];
}

export function FilterToolbar({ filters, onChange, resultCount, allModules, allScans, allPrograms }: FilterToolbarProps) {
  const isFiltered = filters.search !== "" || filters.severities.size < SEV_ORDER.length || filters.statuses.size < STATUS_LIST.length || filters.modules.size > 0 || filters.scans.size > 0 || filters.programs.size > 0;

  const update = (partial: Partial<Filters>) => onChange({ ...filters, ...partial });

  const FULL_SEVERITIES = new Set(SEV_ORDER);
  const FULL_STATUSES = new Set(STATUS_LIST);
  const FULL_MODULES = new Set(allModules);
  const FULL_SCANS = new Set(allScans);
  const FULL_PROGRAMS = new Set(allPrograms);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "10px 0" }}>
      <div style={{ position: "relative", flex: "0 1 280px", minWidth: 200 }}>
        <Search size={12} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: ds.text.muted, pointerEvents: "none" }} />
        <input value={filters.search} onChange={(e) => update({ search: e.target.value })} placeholder="Search title, description, URL…" style={{ width: "100%", height: 30, boxSizing: "border-box", backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.md, fontSize: ds.size.xs, fontFamily: "Inter, sans-serif", color: ds.text.primary, paddingLeft: 28, paddingRight: filters.search ? 28 : 8, outline: "none" }} />
        {filters.search && (
          <button onClick={() => update({ search: "" })} style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: ds.text.muted, display: "flex" }}>
            <X size={11} />
          </button>
        )}
      </div>

      <FilterChip label="Severity" allValues={SEV_ORDER} selected={filters.severities} fullSet={FULL_SEVERITIES} onSelect={(s) => update({ severities: s })} renderOption={(v) => (
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: SEV_COLORS[v as Severity] }} />
          {SEV_LABELS[v as Severity]}
        </span>
      )} />

      <FilterChip label="Status" allValues={STATUS_LIST} selected={filters.statuses} fullSet={FULL_STATUSES} onSelect={(s) => update({ statuses: s })} renderOption={(v) => (
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: STATUS_COLORS[v as FindingStatus] }} />
          {STATUS_LABELS[v as FindingStatus]}
        </span>
      )} />

      <FilterChip label="Module" allValues={allModules} selected={filters.modules.size > 0 ? filters.modules : FULL_MODULES} fullSet={FULL_MODULES} onSelect={(s) => update({ modules: s.size === FULL_MODULES.size ? new Set() : s })} />
      <FilterChip label="Scan" allValues={allScans} selected={filters.scans.size > 0 ? filters.scans : FULL_SCANS} fullSet={FULL_SCANS} onSelect={(s) => update({ scans: s.size === FULL_SCANS.size ? new Set() : s })} />
      <FilterChip label="Program" allValues={allPrograms} selected={filters.programs.size > 0 ? filters.programs : FULL_PROGRAMS} fullSet={FULL_PROGRAMS} onSelect={(s) => update({ programs: s.size === FULL_PROGRAMS.size ? new Set() : s })} />

      <div style={{ marginLeft: "auto" }}>
        <SortDropdown value={filters.sortBy} onChange={(v) => update({ sortBy: v })} />
      </div>

      <span style={{ fontSize: ds.size.xs, color: ds.text.muted, whiteSpace: "nowrap" }}>{resultCount} findings</span>

      {isFiltered && (
        <button onClick={() => onChange({ ...DEFAULT_FILTERS, severities: new Set(SEV_ORDER), statuses: new Set(STATUS_LIST) })} style={{ display: "flex", alignItems: "center", gap: 4, height: 28, padding: "0 10px", borderRadius: ds.radius.md, border: `1px solid ${ds.border.default}`, backgroundColor: "transparent", color: ds.text.muted, fontSize: ds.size.xs, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
          <RotateCcw size={10} /> Reset
        </button>
      )}
    </div>
  );
}
