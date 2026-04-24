"use client";

import React, { useState } from "react";
import { ShieldCheck, RotateCcw } from "lucide-react";
import { ds } from "@/components/ds/tokens";
import { DSBadge } from "@/components/ds/DSBadge";
import { DSButton } from "@/components/ds/DSButton";
import type { Finding, Severity, FindingStatus } from "./types";
import { relativeTime } from "./types";

function cvssColor(score: number): string {
  if (score >= 9.0) return ds.severity.critical;
  if (score >= 7.0) return ds.severity.high;
  if (score >= 4.0) return ds.severity.medium;
  if (score >= 0.1) return ds.severity.low;
  return ds.text.muted;
}

const COLS = "32px 90px 116px 1fr 100px 180px 64px 84px";

function Checkbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, cursor: "pointer", backgroundColor: checked ? ds.accent.default : "transparent", border: `1.5px solid ${checked ? ds.accent.default : "rgba(113,113,122,0.5)"}`, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.1s ease" }}
    >
      {checked && (
        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
          <path d="M1 3.5L3.5 6L8 1" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

function TableHeader({ allSelected, onSelectAll }: { allSelected: boolean; onSelectAll: (v: boolean) => void }) {
  const LABELS = ["", "Severity", "Status", "Title", "Module", "URL", "CVSS", "Date"];
  return (
    <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, alignItems: "center", padding: "8px 16px", backgroundColor: ds.bg.elevated, borderBottom: `1px solid ${ds.border.default}`, position: "sticky", top: 0, zIndex: 5 }}>
      <Checkbox checked={allSelected} onChange={onSelectAll} />
      {LABELS.slice(1).map((l) => (
        <span key={l} style={{ fontSize: 10, fontWeight: ds.weight.semibold, color: ds.text.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{l}</span>
      ))}
    </div>
  );
}

function TableRow({ finding, selected, onSelect, onClick }: { finding: Finding; selected: boolean; onSelect: (v: boolean) => void; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, alignItems: "center", padding: "10px 16px", backgroundColor: selected ? ds.accent.bg15 : hovered ? "rgba(39,39,42,0.3)" : "transparent", borderBottom: `1px solid ${ds.border.default}`, cursor: "pointer", transition: "background 0.1s ease", borderLeft: `3px solid ${selected ? ds.accent.default : "transparent"}` }}
    >
      <div onClick={(e) => { e.stopPropagation(); onSelect(!selected); }}>
        <Checkbox checked={selected} onChange={onSelect} />
      </div>
      <div onClick={onClick}>
        <DSBadge type="severity" severity={finding.severity as Severity} size="sm" />
      </div>
      <div onClick={onClick}>
        <DSBadge type="status" status={finding.status as FindingStatus} size="sm" />
      </div>
      <div onClick={onClick} style={{ minWidth: 0 }}>
        <span style={{ fontSize: ds.size.sm, fontWeight: ds.weight.medium, color: ds.text.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{finding.title}</span>
      </div>
      <div onClick={onClick}>
        <span style={{ fontSize: ds.size.xs, color: ds.text.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{finding.module}</span>
      </div>
      <div onClick={onClick} style={{ minWidth: 0 }}>
        <span title={finding.url} style={{ fontSize: ds.size.xs, color: ds.text.muted, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
          {finding.url.replace(/^https?:\/\//, "").slice(0, 40)}
          {finding.url.replace(/^https?:\/\//, "").length > 40 ? "…" : ""}
        </span>
      </div>
      <div onClick={onClick}>
        <span style={{ fontFamily: "monospace", fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: cvssColor(finding.cvss) }}>{finding.cvss.toFixed(1)}</span>
      </div>
      <div onClick={onClick}>
        <span style={{ fontSize: ds.size.xs, color: ds.text.muted, whiteSpace: "nowrap" }}>{relativeTime(finding.firstSeen)}</span>
      </div>
    </div>
  );
}

function Skel({ h, w }: { h: number; w: number | string }) {
  return <div className="animate-pulse" style={{ height: h, width: w, borderRadius: ds.radius.md, backgroundColor: ds.bg.elevated }} />;
}

function SkeletonRow() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, alignItems: "center", padding: "10px 16px", borderBottom: `1px solid ${ds.border.default}` }}>
      <Skel h={14} w={14} />
      <Skel h={20} w={70} />
      <Skel h={20} w={90} />
      <Skel h={13} w="80%" />
      <Skel h={13} w={60} />
      <Skel h={13} w={140} />
      <Skel h={13} w={32} />
      <Skel h={13} w={50} />
    </div>
  );
}

interface FindingsTableProps {
  findings: Finding[];
  loading?: boolean;
  isFiltered?: boolean;
  selected: Set<string>;
  onSelect: (id: string, v: boolean) => void;
  onSelectAll: (v: boolean) => void;
  onRowClick: (finding: Finding) => void;
  onResetFilters?: () => void;
}

export function FindingsTable({ findings, loading, isFiltered, selected, onSelect, onSelectAll, onRowClick, onResetFilters }: FindingsTableProps) {
  const allSelected = findings.length > 0 && findings.every((f) => selected.has(f.id));

  if (loading) {
    return (
      <div style={{ backgroundColor: ds.bg.surface, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg, overflow: "hidden" }}>
        <TableHeader allSelected={false} onSelectAll={() => {}} />
        {Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)}
      </div>
    );
  }

  if (findings.length === 0) {
    return (
      <div style={{ backgroundColor: ds.bg.surface, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg, overflow: "hidden" }}>
        <TableHeader allSelected={false} onSelectAll={() => {}} />
        <div style={{ padding: "72px 32px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <ShieldCheck size={52} style={{ color: ds.accent.default, opacity: 0.7 }} />
          {isFiltered ? (
            <>
              <div style={{ fontSize: ds.size.lg, fontWeight: ds.weight.semibold, color: ds.text.secondary }}>No findings match your filters</div>
              <div style={{ fontSize: ds.size.sm, color: ds.text.muted, maxWidth: 360 }}>Try adjusting your search or filter criteria to see more results.</div>
              <DSButton variant="secondary" size="md" icon={<RotateCcw size={13} />} onClick={onResetFilters}>
                Reset filters
              </DSButton>
            </>
          ) : (
            <>
              <div style={{ fontSize: ds.size.lg, fontWeight: ds.weight.semibold, color: ds.text.secondary }}>No vulnerabilities detected</div>
              <div style={{ fontSize: ds.size.sm, color: ds.text.muted, maxWidth: 380 }}>Your scans are clean — no findings have been reported yet. Run a scan to start discovering vulnerabilities.</div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: ds.bg.surface, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.lg, overflow: "hidden" }}>
      <TableHeader allSelected={allSelected} onSelectAll={(v) => onSelectAll(v)} />
      {findings.map((f) => (
        <TableRow key={f.id} finding={f} selected={selected.has(f.id)} onSelect={(v) => onSelect(f.id, v)} onClick={() => onRowClick(f)} />
      ))}
      <div style={{ padding: "8px 16px", backgroundColor: ds.bg.elevated, borderTop: `1px solid ${ds.border.default}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>
          {findings.length} finding{findings.length !== 1 ? "s" : ""}
          {selected.size > 0 && ` · ${selected.size} selected`}
        </span>
      </div>
    </div>
  );
}
