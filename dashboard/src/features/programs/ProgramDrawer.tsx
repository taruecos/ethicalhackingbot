"use client";

import React, { useState, useEffect } from "react";
import { X, ExternalLink, ScanLine, ShieldOff, CheckCircle2, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { ds } from "@/components/ds/tokens";
import { DSButton } from "@/components/ds/DSButton";
import type { Program, ScopeEntry } from "./types";
import { COMPLIANCE_CFG } from "./ProgramCard";

interface ProgramDrawerProps {
  program: Program | null;
  onClose: () => void;
  onScan: (p: Program) => void;
}

export function ProgramDrawer({ program, onClose, onScan }: ProgramDrawerProps) {
  const [roeExpanded, setRoeExpanded] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (program) {
      setVisible(false);
      setRoeExpanded(false);
      requestAnimationFrame(() => setVisible(true));
    }
  }, [program?.id]);

  if (!program) return null;

  const cfg = COMPLIANCE_CFG[program.complianceStatus];
  const inScope = program.scope.filter((s) => s.tier === "in_scope");
  const outScope = program.scope.filter((s) => s.tier === "out_scope");

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40, backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)", transition: "opacity 0.2s ease", opacity: visible ? 1 : 0 }} />

      <div
        style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 520, backgroundColor: ds.bg.surface, borderLeft: `1px solid ${ds.border.default}`, zIndex: 50, display: "flex", flexDirection: "column", transform: visible ? "translateX(0)" : "translateX(100%)", transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)", boxShadow: "-24px 0 64px rgba(0,0,0,0.6)" }}
      >
        <div style={{ flexShrink: 0, padding: "16px 20px", borderBottom: `1px solid ${ds.border.default}`, display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ width: 28, height: 28, borderRadius: ds.radius.md, flexShrink: 0, background: "linear-gradient(135deg, #6C3CE1 0%, #4B1FBB 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 11, fontWeight: ds.weight.bold, color: "#fff" }}>I</span>
              </div>
              <h2 style={{ margin: 0, fontSize: ds.size.lg, fontWeight: ds.weight.semibold, color: ds.text.primary, lineHeight: 1.2 }}>{program.name}</h2>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: ds.size.xs, color: ds.text.muted }}>{program.companyName}</span>
              <a href={`https://app.intigriti.com/programs/${program.id}`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: ds.size.xs, color: ds.severity.info, textDecoration: "none" }}>
                <ExternalLink size={10} /> View on Intigriti
              </a>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: ds.radius.md, border: `1px solid ${ds.border.default}`, backgroundColor: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: ds.text.muted, flexShrink: 0 }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Section title="Compliance">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: ds.radius.md, backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, backgroundColor: cfg.color, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 14px ${cfg.color}50` }}>
                    <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "rgba(0,0,0,0.3)" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: cfg.color }}>{cfg.label}</div>
                    <div style={{ fontSize: ds.size.xs, color: ds.text.muted, marginTop: 2 }}>Automated tooling policy</div>
                  </div>
                </div>

                <DrawerRow label="Safe Harbour">
                  <div style={{ display: "flex", alignItems: "center", gap: 5, color: program.safeHarbour ? ds.accent.default : ds.severity.critical }}>
                    {program.safeHarbour ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    <span style={{ fontSize: ds.size.xs, fontWeight: ds.weight.medium }}>{program.safeHarbour ? "Protected" : "Not applicable"}</span>
                  </div>
                </DrawerRow>

                <DrawerRow label="User-Agent">
                  <code style={{ fontSize: 11, fontFamily: "monospace", color: ds.text.secondary, backgroundColor: ds.bg.elevated, padding: "2px 6px", borderRadius: ds.radius.md, border: `1px solid ${ds.border.default}` }}>{program.userAgent}</code>
                </DrawerRow>

                {program.reqHeaders.length > 0 && (
                  <DrawerRow label="Required headers">
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {program.reqHeaders.map((h, i) => (
                        <code key={i} style={{ fontSize: 10, fontFamily: "monospace", color: ds.severity.info, backgroundColor: ds.bg.elevated, padding: "3px 7px", borderRadius: ds.radius.md, border: `1px solid ${ds.border.default}`, display: "block" }}>{h}</code>
                      ))}
                    </div>
                  </DrawerRow>
                )}
              </div>
            </Section>

            <Section title="Scope">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {inScope.length > 0 && <ScopeTable entries={inScope} tier="in_scope" />}
                {outScope.length > 0 && <ScopeTable entries={outScope} tier="out_scope" />}
              </div>
            </Section>

            <Section title="Bounty">
              {program.bountyType === "bounty" && program.bountyMin !== null ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: ds.radius.md, backgroundColor: ds.accent.bg15, border: `1px solid ${ds.border.accent20}` }}>
                  <div>
                    <div style={{ fontSize: 10, color: ds.text.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Range</div>
                    <div style={{ fontSize: ds.size["2xl"], fontWeight: ds.weight.bold, color: ds.accent.default, fontVariantNumeric: "tabular-nums" }}>
                      €{program.bountyMin.toLocaleString()} – €{program.bountyMax!.toLocaleString()}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: ds.text.muted, marginBottom: 4 }}>Currency</div>
                    <div style={{ fontSize: ds.size.sm, fontWeight: ds.weight.semibold, color: ds.text.primary }}>{program.currency}</div>
                  </div>
                </div>
              ) : (
                <div style={{ padding: "12px 16px", borderRadius: ds.radius.md, textAlign: "center", backgroundColor: ds.bg.elevated, border: `1px solid ${ds.border.default}` }}>
                  <div style={{ fontSize: ds.size.sm, color: ds.text.muted, fontStyle: "italic" }}>Responsible Disclosure — no monetary bounty</div>
                </div>
              )}
            </Section>

            <Section title="Rules of Engagement">
              <div style={{ position: "relative" }}>
                <div style={{ maxHeight: roeExpanded ? "none" : 200, overflow: "hidden", fontSize: ds.size.xs, color: ds.text.secondary, lineHeight: 1.7, padding: "12px 14px", backgroundColor: ds.bg.elevated, borderRadius: ds.radius.md, border: `1px solid ${ds.border.default}`, whiteSpace: "pre-wrap", transition: "max-height 0.3s ease" }}>
                  {program.rulesOfEngagement}
                </div>
                {!roeExpanded && (
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 56, background: `linear-gradient(to bottom, transparent, ${ds.bg.elevated})`, borderRadius: `0 0 ${ds.radius.md}px ${ds.radius.md}px`, pointerEvents: "none" }} />
                )}
                <button
                  onClick={() => setRoeExpanded(!roeExpanded)}
                  style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: ds.severity.info, fontSize: ds.size.xs, fontFamily: "Inter, sans-serif", fontWeight: ds.weight.medium }}
                >
                  {roeExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  {roeExpanded ? "Collapse" : "Read more"}
                </button>
              </div>
            </Section>
          </div>
        </div>

        <div style={{ flexShrink: 0, padding: "14px 20px", borderTop: `1px solid ${ds.border.default}`, display: "flex", gap: 10, backgroundColor: ds.bg.surface }}>
          <DSButton variant="primary" size="md" icon={<ScanLine size={14} />} onClick={() => onScan(program)} style={{ flex: 1, opacity: program.complianceStatus === "not_allowed" ? 0.38 : 1, cursor: program.complianceStatus === "not_allowed" ? "not-allowed" : "pointer" }}>
            Scan now
          </DSButton>
          <a href={`https://app.intigriti.com/programs/${program.id}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", flex: 1 }}>
            <DSButton variant="secondary" size="md" icon={<ExternalLink size={14} />} style={{ width: "100%" }}>
              Open in Intigriti
            </DSButton>
          </a>
          <DSButton variant="ghost" size="md" icon={<ShieldOff size={14} />}>
            Disable
          </DSButton>
        </div>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: ds.weight.semibold, color: ds.text.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function DrawerRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "8px 0", borderTop: `1px solid ${ds.border.default}` }}>
      <span style={{ fontSize: ds.size.xs, color: ds.text.muted, flexShrink: 0 }}>{label}</span>
      <div style={{ textAlign: "right" }}>{children}</div>
    </div>
  );
}

function ScopeTable({ entries, tier }: { entries: ScopeEntry[]; tier: "in_scope" | "out_scope" }) {
  const isIn = tier === "in_scope";
  const color = isIn ? ds.accent.default : ds.severity.critical;
  const label = isIn ? "In Scope" : "Out of Scope";

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: color }} />
        <span style={{ fontSize: 10, fontWeight: ds.weight.semibold, color, textTransform: "uppercase", letterSpacing: "0.07em" }}>
          {label} ({entries.length})
        </span>
      </div>
      <div style={{ borderRadius: ds.radius.md, overflow: "hidden", border: `1px solid ${ds.border.default}` }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 1fr", backgroundColor: ds.bg.elevated, padding: "6px 12px", gap: 8 }}>
          {["Endpoint", "Type", "Description"].map((h) => (
            <span key={h} style={{ fontSize: 10, fontWeight: ds.weight.semibold, color: ds.text.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
          ))}
        </div>
        {entries.map((entry, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 80px 1fr", padding: "8px 12px", gap: 8, alignItems: "center", borderTop: `1px solid ${ds.border.default}` }}>
            <code style={{ fontSize: 11, fontFamily: "monospace", color: ds.text.secondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.endpoint}</code>
            <span style={{ fontSize: 10, color: ds.text.muted, padding: "2px 6px", backgroundColor: "rgba(39,39,42,0.3)", borderRadius: ds.radius.md, textAlign: "center", border: `1px solid ${ds.border.default}` }}>{entry.type}</span>
            <span style={{ fontSize: 11, color: ds.text.muted }}>{entry.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
