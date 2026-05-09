"use client";

import React, { useState } from "react";
import { ScanLine, Info, CheckCircle2, XCircle, Download } from "lucide-react";
import { ds } from "@/components/ds/tokens";
import { DSButton } from "@/components/ds/DSButton";
import type { Program, ComplianceStatus } from "./types";

export const COMPLIANCE_CFG: Record<ComplianceStatus, { label: string; color: string; bg: string; border: string }> = {
  allowed: { label: "Automated OK", color: ds.accent.default, bg: ds.accent.bg15, border: ds.border.accent20 },
  conditional: { label: "Conditional", color: ds.severity.high, bg: ds.severity.highBg, border: `${ds.severity.high}40` },
  not_allowed: { label: "Not Allowed", color: ds.severity.critical, bg: ds.severity.criticalBg, border: `${ds.severity.critical}40` },
};

interface ProgramCardProps {
  program: Program;
  forLive?: boolean;
  onDetails: (p: Program) => void;
  onScan?: (p: Program) => void;
  onImport?: (p: Program) => void;
}

export function ProgramCard({ program, forLive = false, onDetails, onScan, onImport }: ProgramCardProps) {
  const [hovered, setHovered] = useState(false);
  const [scanTooltip, setScanTooltip] = useState(false);
  const cfg = COMPLIANCE_CFG[program.complianceStatus];
  const isBlocked = program.complianceStatus === "not_allowed";

  const disabledScanReason = !program.safeHarbour ? "No safe harbour — scanning discouraged" : isBlocked ? "Automated tooling not permitted" : "";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ backgroundColor: ds.bg.surface, border: `1px solid ${hovered ? ds.border.accent20 : ds.border.default}`, borderRadius: ds.radius.lg, display: "flex", flexDirection: "column", overflow: "hidden", transition: "all 0.15s ease", transform: hovered ? "translateY(-2px)" : "none", boxShadow: hovered ? "0 4px 24px rgba(0,0,0,0.4)" : "none" }}
    >
      <div style={{ padding: "14px 16px 12px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `1px solid ${ds.border.default}` }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: ds.size.base, fontWeight: ds.weight.semibold, color: ds.text.primary, marginBottom: 2 }}>{program.name}</div>
          <div style={{ fontSize: ds.size.xs, color: ds.text.muted }}>{program.companyName}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {!program.synced && (
            <span style={{ fontSize: 10, fontWeight: ds.weight.medium, color: ds.text.muted, padding: "2px 6px", backgroundColor: "rgba(113,113,122,0.12)", border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.md }}>Not synced</span>
          )}
          <div style={{ width: 24, height: 24, borderRadius: ds.radius.md, flexShrink: 0, background: "linear-gradient(135deg, #6C3CE1 0%, #4B1FBB 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 9, fontWeight: ds.weight.bold, color: "#fff" }}>I</span>
          </div>
        </div>
      </div>

      <div style={{ padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: ds.radius.md, backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, backgroundColor: cfg.color, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 12px ${cfg.color}60` }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.3)" }} />
          </div>
          <div>
            <div style={{ fontSize: ds.size.xs, fontWeight: ds.weight.semibold, color: cfg.color }}>{cfg.label}</div>
            <div style={{ fontSize: 10, color: ds.text.muted, marginTop: 1 }}>Automated scanning policy</div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: ds.size.xs, color: ds.text.muted, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: ds.weight.medium }}>Bounty</span>
          {program.bountyType === "bounty" && program.bountyMin !== null ? (
            <span style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.accent.default, fontVariantNumeric: "tabular-nums" }}>
              €{program.bountyMin.toLocaleString()} – €{program.bountyMax!.toLocaleString()}
            </span>
          ) : (
            <span style={{ fontSize: ds.size.xs, color: ds.text.muted, fontStyle: "italic" }}>Responsible Disclosure</span>
          )}
        </div>

        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          <Tag label={program.industry} />
          <Tag label={program.confidentiality === "public" ? "Public" : "Application Only"} dim />
          {!program.safeHarbour && <Tag label="No Safe Harbour" danger />}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {program.safeHarbour ? <CheckCircle2 size={13} style={{ color: ds.accent.default }} /> : <XCircle size={13} style={{ color: ds.severity.critical }} />}
          <span style={{ fontSize: ds.size.xs, color: program.safeHarbour ? ds.text.secondary : ds.severity.critical }}>Safe harbour {program.safeHarbour ? "protected" : "not applicable"}</span>
        </div>

        <div style={{ fontSize: 10, color: ds.text.muted }}>Synced {program.synced ? program.lastSynced : "—"}</div>
      </div>

      <div style={{ padding: "10px 16px", borderTop: `1px solid ${ds.border.default}`, display: "flex", gap: 8, backgroundColor: ds.bg.elevated }}>
        {forLive ? (
          <DSButton variant="primary" size="sm" icon={<Download size={11} />} onClick={() => onImport?.(program)} style={{ flex: 1 }}>
            {program.synced ? "Re-import" : "Import to DB"}
          </DSButton>
        ) : (
          <div style={{ position: "relative", flex: 1 }} onMouseEnter={() => disabledScanReason && setScanTooltip(true)} onMouseLeave={() => setScanTooltip(false)}>
            {scanTooltip && disabledScanReason && (
              <div style={{ position: "absolute", bottom: "110%", left: 0, right: 0, padding: "5px 8px", backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}`, borderRadius: ds.radius.md, fontSize: 10, color: ds.text.secondary, zIndex: 50, textAlign: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}>
                {disabledScanReason}
              </div>
            )}
            <DSButton
              variant="primary"
              size="sm"
              icon={<ScanLine size={11} />}
              onClick={() => !isBlocked && onScan?.(program)}
              style={{ width: "100%", opacity: isBlocked ? 0.38 : 1, cursor: isBlocked ? "not-allowed" : "pointer" }}
            >
              Scan
            </DSButton>
          </div>
        )}
        <DSButton variant="ghost" size="sm" icon={<Info size={11} />} onClick={() => onDetails(program)} style={{ flex: 1 }}>
          Details
        </DSButton>
      </div>
    </div>
  );
}

function Tag({ label, dim, danger }: { label: string; dim?: boolean; danger?: boolean }) {
  return (
    <span style={{ fontSize: 10, fontWeight: ds.weight.medium, padding: "2px 7px", borderRadius: ds.radius.md, backgroundColor: danger ? ds.severity.criticalBg : dim ? "rgba(39,39,42,0.35)" : "rgba(39,39,42,0.2)", color: danger ? ds.severity.critical : dim ? ds.text.muted : ds.text.secondary, border: `1px solid ${danger ? `${ds.severity.critical}30` : ds.border.default}`, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}
